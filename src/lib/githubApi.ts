import { getStoredJsonValue } from './storage/backend';

export type GitHubConnectionStatus = 'not-connected' | 'testing' | 'connected' | 'invalid' | 'error';
export type GitHubPullRequestState = 'open' | 'merged' | 'closed' | 'not-found';

export type GitHubNotification = {
  id: string;
  unread: boolean;
  last_read_at?: string | null;
  updated_at: string;
  reason: string;
  authorLogin?: string;
  pullRequestState?: GitHubPullRequestState;
  repository: {
    full_name: string;
  };
  subject: {
    title: string;
    type: string;
    url: string | null;
    latest_comment_url?: string | null;
  };
};

export type GitHubPullRequestItem = {
  id: number;
  title: string;
  headRefName: string;
  repositoryId: number;
  repositoryName: string;
  repositoryUrl: string;
  owner: string;
  repo: string;
  pullNumber: number;
  totalCommentCount: number;
  authorLogin: string;
  isDraft: boolean;
  createdAt: string;
  updatedAt: string;
  url: string;
  source: 'authored' | 'review-requested' | 'recent';
  reviewStatus: 'approved' | 'changes-requested' | 'waiting-review' | 'draft' | 'open';
  ciStatus: 'passing' | 'failing' | 'pending' | 'no-checks';
  mergeStateStatus:
    | 'BEHIND'
    | 'BLOCKED'
    | 'CLEAN'
    | 'DIRTY'
    | 'DRAFT'
    | 'HAS_HOOKS'
    | 'UNKNOWN'
    | 'UNSTABLE';
  mergeQueueEntry: {
    position: number;
    state: 'AWAITING_CHECKS' | 'LOCKED' | 'MERGEABLE' | 'QUEUED' | 'UNMERGEABLE';
  } | null;
  detailsLoaded: boolean;
};

export type GitHubDashboardData = {
  connectionStatus: GitHubConnectionStatus;
  notificationsCount: number;
  openPrsCount: number;
  recentOpenPrsCount: number;
  reviewRequestedCount: number;
  notifications: GitHubNotification[];
  pullRequests: GitHubPullRequestItem[];
  recentPullRequests: GitHubPullRequestItem[];
  errorMessage: string | null;
  missingUsername: boolean;
  lastUpdatedAt: number | null;
};

export type GitHubRepository = {
  id: number;
  name: string;
  fullName: string;
  owner: string;
  url: string;
  isPrivate: boolean;
  updatedAt: string;
  description: string;
};

type CachedGitHubDashboardData = {
  cacheToken: string;
  fetchedAt: number;
  data: GitHubDashboardData;
};

type CachedGitHubRepoIndex = {
  cacheToken: string;
  fetchedAt: number;
  data: GitHubRepository[];
};

type GitHubDashboardResponse = {
  success: boolean;
  data?: GitHubDashboardData;
  error?: string;
};

type GitHubConnectionResponse = {
  success: boolean;
  status?: GitHubConnectionStatus;
  error?: string;
};

type GitHubOwnerOptionsResponse = {
  success: boolean;
  owners?: string[];
  error?: string;
};

type GitHubNotificationActivityResponse = {
  success: boolean;
  hasChanges?: boolean;
  data?: GitHubDashboardData;
  changedNotificationIds?: string[];
  error?: string;
};

type GitHubPullRequestStateResponse = {
  success: boolean;
  state?: GitHubPullRequestState;
  error?: string;
};

type GitHubPullRequestStatesResponse = {
  success: boolean;
  states?: Record<string, GitHubPullRequestState>;
  error?: string;
};

type GitHubRepoIndexResponse = {
  success: boolean;
  repos?: GitHubRepository[];
  error?: string;
};

const CACHE_KEY = 'github-dashboard-cache';
const REPO_INDEX_CACHE_KEY = 'github-repo-index-cache';

export function getEmptyGitHubDashboardData(
  connectionStatus: GitHubConnectionStatus = 'not-connected'
): GitHubDashboardData {
  return {
    connectionStatus,
    notificationsCount: 0,
    openPrsCount: 0,
    recentOpenPrsCount: 0,
    reviewRequestedCount: 0,
    notifications: [],
    pullRequests: [],
    recentPullRequests: [],
    errorMessage: null,
    missingUsername: false,
    lastUpdatedAt: null
  };
}

function normalizeGitHubDashboardData(
  data: GitHubDashboardData | null | undefined
): GitHubDashboardData | null {
  if (!data) {
    return null;
  }

  const normalizePullRequestItem = (pullRequest: GitHubPullRequestItem) => ({
    ...pullRequest,
    headRefName:
      typeof pullRequest.headRefName === 'string'
        ? pullRequest.headRefName.trim()
        : '',
    repositoryId:
      Number.isFinite(pullRequest.repositoryId) && pullRequest.repositoryId > 0
        ? pullRequest.repositoryId
        : pullRequest.id,
    repositoryUrl:
      typeof pullRequest.repositoryUrl === 'string' &&
      pullRequest.repositoryUrl.trim()
        ? pullRequest.repositoryUrl.trim()
        : `https://github.com/${pullRequest.owner}/${pullRequest.repo}`,
  });

  return {
    ...getEmptyGitHubDashboardData(data.connectionStatus),
    ...data,
    notifications: Array.isArray(data.notifications) ? data.notifications : [],
    pullRequests: Array.isArray(data.pullRequests)
      ? data.pullRequests.map(normalizePullRequestItem)
      : [],
    recentPullRequests: Array.isArray(data.recentPullRequests)
      ? data.recentPullRequests.map(normalizePullRequestItem)
      : [],
    recentOpenPrsCount: Number.isFinite(data.recentOpenPrsCount)
      ? data.recentOpenPrsCount
      : Array.isArray(data.recentPullRequests)
        ? data.recentPullRequests.length
        : 0,
  };
}

export async function testGitHubConnection(token: string): Promise<GitHubConnectionStatus> {
  const trimmedToken = token.trim();
  if (!trimmedToken) {
    return 'not-connected';
  }

  if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
    return 'error';
  }

  try {
    const response = await sendMessage<GitHubConnectionResponse>({
      type: 'TEST_GITHUB_CONNECTION',
      payload: {
        token: trimmedToken
      }
    });

    return response?.status ?? 'error';
  } catch {
    return 'error';
  }
}

export async function fetchGitHubOwnerOptions(options: {
  token: string;
  username?: string;
}): Promise<string[]> {
  const trimmedToken = options.token.trim();
  const trimmedUsername = options.username?.trim() ?? '';
  if (!trimmedToken) {
    return [];
  }

  if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
    return [];
  }

  try {
    const response = await sendMessage<GitHubOwnerOptionsResponse>({
      type: 'FETCH_GITHUB_OWNER_OPTIONS',
      payload: {
        token: trimmedToken,
        username: trimmedUsername
      }
    });

    return Array.isArray(response?.owners) ? response.owners : [];
  } catch {
    return [];
  }
}

export async function getLatestGitHubDashboardData(options: {
  username: string;
  token: string;
  ownerFilter?: string;
}) {
  const username = options.username.trim();
  const token = options.token.trim();
  const ownerFilter = options.ownerFilter?.trim() ?? '';

  if (!token) {
    return null;
  }

  return getCachedGitHubDashboardData(createCacheToken(username, token, ownerFilter), { ignoreExpiration: true });
}

export async function getLatestGitHubRepoIndex(options: {
  username: string;
  token: string;
  ownerFilter?: string;
}) {
  const username = options.username.trim();
  const token = options.token.trim();
  const ownerFilter = options.ownerFilter?.trim() ?? '';

  if (!token) {
    return [];
  }

  return (await getCachedGitHubRepoIndex(createCacheToken(username, token, ownerFilter), {
    ignoreExpiration: true
  })) ?? [];
}

export async function loadGitHubDashboardData(options: {
  username: string;
  token: string;
  ownerFilter?: string;
  forceRefresh?: boolean;
  source?: string;
  requestId?: string;
}): Promise<GitHubDashboardData> {
  const username = options.username.trim();
  const token = options.token.trim();
  const ownerFilter = options.ownerFilter?.trim() ?? '';

  if (!token) {
    return getEmptyGitHubDashboardData('not-connected');
  }

  if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
    return {
      ...getEmptyGitHubDashboardData('error'),
      errorMessage: 'chrome.runtime.sendMessage is unavailable'
    };
  }

  try {
    const response = await sendMessage<GitHubDashboardResponse>({
      type: 'FETCH_GITHUB_DASHBOARD',
      payload: {
        username,
        token,
        ownerFilter,
        forceRefresh: Boolean(options.forceRefresh),
        source: options.source,
        requestId: options.requestId
      }
    });

    if (response?.success && response.data) {
      return normalizeGitHubDashboardData(response.data) ?? getEmptyGitHubDashboardData('error');
    }

    return {
      ...getEmptyGitHubDashboardData('error'),
      errorMessage: response?.error ?? 'GitHub data could not be loaded right now.'
    };
  } catch (error) {
    return {
      ...getEmptyGitHubDashboardData('error'),
      errorMessage: error instanceof Error ? error.message : 'Unknown GitHub message bridge failure'
    };
  }
}

export async function loadGitHubRepoIndex(options: {
  username: string;
  token: string;
  ownerFilter?: string;
  forceRefresh?: boolean;
}): Promise<GitHubRepository[]> {
  const username = options.username.trim();
  const token = options.token.trim();
  const ownerFilter = options.ownerFilter?.trim() ?? '';

  if (!token) {
    return [];
  }

  if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
    return [];
  }

  try {
    const response = await sendMessage<GitHubRepoIndexResponse>({
      type: 'FETCH_GITHUB_REPO_INDEX',
      payload: {
        username,
        token,
        ownerFilter,
        forceRefresh: Boolean(options.forceRefresh)
      }
    });

    return Array.isArray(response?.repos) ? response.repos : [];
  } catch {
    return [];
  }
}

export async function pollGitHubNotificationActivity(options: {
  username: string;
  token: string;
  ownerFilter?: string;
}) {
  const username = options.username.trim();
  const token = options.token.trim();
  const ownerFilter = options.ownerFilter?.trim() ?? '';

  if (!token) {
    return {
      hasChanges: false,
      data: undefined,
      changedNotificationIds: []
    };
  }

  if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
    return {
      hasChanges: false,
      data: undefined,
      changedNotificationIds: []
    };
  }

  try {
    const response = await sendMessage<GitHubNotificationActivityResponse>({
      type: 'POLL_GITHUB_ACTIVITY',
      payload: {
        username,
        token,
        ownerFilter
      }
    });

    return {
      hasChanges: Boolean(response?.hasChanges),
      data: response?.data,
      changedNotificationIds: response?.changedNotificationIds ?? []
    };
  } catch {
    return {
      hasChanges: false,
      data: undefined,
      changedNotificationIds: []
    };
  }
}

export async function getGitHubPullRequestState(options: {
  owner: string;
  repo: string;
  pullNumber: number;
  token: string;
}): Promise<GitHubPullRequestState> {
  const token = options.token.trim();
  if (!token) {
    return 'closed';
  }

  if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
    return 'closed';
  }

  try {
    const response = await sendMessage<GitHubPullRequestStateResponse>({
      type: 'FETCH_GITHUB_PULL_REQUEST_STATE',
      payload: {
        owner: options.owner,
        repo: options.repo,
        pullNumber: options.pullNumber,
        token
      }
    });

    return response?.state ?? 'closed';
  } catch {
    return 'closed';
  }
}

export async function getGitHubPullRequestStates(options: {
  token: string;
  pullRequests: Array<{
    id: string;
    owner: string;
    repo: string;
    pullNumber: number;
  }>;
}): Promise<Record<string, GitHubPullRequestState>> {
  const token = options.token.trim();
  if (!token || options.pullRequests.length === 0) {
    return {};
  }

  if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
    return {};
  }

  try {
    const response = await sendMessage<GitHubPullRequestStatesResponse>({
      type: 'FETCH_GITHUB_PULL_REQUEST_STATES',
      payload: {
        token,
        pullRequests: options.pullRequests
      }
    });

    return response?.states ?? {};
  } catch {
    return {};
  }
}

async function getCachedGitHubDashboardData(
  cacheToken: string,
  options: { ignoreExpiration?: boolean } = {}
) {
  const cached =
    (await getStoredJsonValue<CachedGitHubDashboardData>(CACHE_KEY)) ?? null;
  if (!cached) {
    return null;
  }

  const cacheTtlMs = 5 * 60 * 1000;
  const isExpired = Date.now() - cached.fetchedAt > cacheTtlMs;
  if (cached.cacheToken !== cacheToken || (!options.ignoreExpiration && isExpired)) {
    return null;
  }

  return normalizeGitHubDashboardData(cached.data);
}

async function getCachedGitHubRepoIndex(
  cacheToken: string,
  options: { ignoreExpiration?: boolean } = {}
) {
  const cached = await getStoredJsonValue<CachedGitHubRepoIndex>(REPO_INDEX_CACHE_KEY);
  if (!cached) {
    return null;
  }

  const isExpired = Date.now() - cached.fetchedAt > 30 * 60 * 1000;
  if (cached.cacheToken !== cacheToken || (!options.ignoreExpiration && isExpired)) {
    return null;
  }

  return cached.data;
}

function createCacheToken(username: string, token: string, ownerFilter = '') {
  const input = `${username}:${token}:${ownerFilter}`;
  let hash = 5381;

  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 33) ^ input.charCodeAt(index);
  }

  return `${username}:${(hash >>> 0).toString(16)}`;
}

function sendMessage<TResponse>(message: unknown) {
  return new Promise<TResponse>((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      resolve(response as TResponse);
    });
  });
}
