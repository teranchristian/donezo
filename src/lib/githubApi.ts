export type GitHubConnectionStatus = 'not-connected' | 'testing' | 'connected' | 'invalid' | 'error';
export type GitHubPullRequestState = 'open' | 'merged' | 'closed';

export type GitHubNotification = {
  id: string;
  unread: boolean;
  last_read_at?: string | null;
  updated_at: string;
  reason: string;
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
  repositoryName: string;
  owner: string;
  repo: string;
  pullNumber: number;
  authorLogin: string;
  isDraft: boolean;
  updatedAt: string;
  url: string;
  source: 'authored' | 'review-requested';
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
  detailsLoaded: boolean;
};

export type GitHubDashboardData = {
  connectionStatus: GitHubConnectionStatus;
  notificationsCount: number;
  openPrsCount: number;
  reviewRequestedCount: number;
  notifications: GitHubNotification[];
  pullRequests: GitHubPullRequestItem[];
  errorMessage: string | null;
  missingUsername: boolean;
  lastUpdatedAt: number | null;
};

export type GitHubPullRequestNotificationSignal = {
  id: string;
  updatedAt: string;
};

type GitHubSearchResponse = {
  items: GitHubPullRequestItem[];
  total_count: number;
};

type GitHubGraphQlResponse = {
  data?: {
    authoredPullRequests: GitHubGraphQlSearchResult;
    reviewRequestedPullRequests: GitHubGraphQlSearchResult;
  };
  errors?: Array<{
    message: string;
    type?: string;
    path?: Array<string | number>;
  }>;
};

type GitHubGraphQlSearchResult = {
  issueCount: number;
  nodes: GitHubGraphQlPullRequestNode[];
};

type GitHubGraphQlPullRequestNode = {
  __typename: 'PullRequest';
  number: number;
  title: string;
  url: string;
  isDraft: boolean;
  updatedAt: string;
  reviewDecision: 'APPROVED' | 'CHANGES_REQUESTED' | 'REVIEW_REQUIRED' | null;
  mergeStateStatus:
    | 'BEHIND'
    | 'BLOCKED'
    | 'CLEAN'
    | 'DIRTY'
    | 'DRAFT'
    | 'HAS_HOOKS'
    | 'UNKNOWN'
    | 'UNSTABLE';
  author: {
    login: string;
  } | null;
  repository: {
    name: string;
    owner: {
      login: string;
    };
  };
  reviewRequests: {
    nodes: Array<{
      requestedReviewer:
        | {
            __typename: 'User';
            login: string;
          }
        | {
            __typename: 'Team';
            slug: string;
            organization: {
              login: string;
            } | null;
          }
        | null;
    }>;
  };
  commits: {
    nodes: Array<{
      commit: {
        statusCheckRollup: {
          state: 'SUCCESS' | 'FAILURE' | 'ERROR' | 'PENDING' | 'EXPECTED' | null;
        } | null;
      } | null;
    }>;
  };
};

type GitHubPullRequestDetail = {
  number: number;
  state: 'open' | 'closed';
  merged: boolean;
  head: {
    sha: string;
  };
  base: {
    repo: {
      name: string;
      owner: {
        login: string;
      };
    };
  };
};

type CachedGitHubDashboardData = {
  cacheToken: string;
  fetchedAt: number;
  data: GitHubDashboardData;
};

type CachedGitHubNotificationSignals = {
  cacheToken: string;
  signals: GitHubPullRequestNotificationSignal[];
};

const CACHE_KEY = 'github-dashboard-cache';
const NOTIFICATION_SIGNALS_CACHE_KEY = 'github-notification-signals';
const CACHE_TTL_MS = 5 * 60 * 1000;
const GITHUB_GRAPHQL_URL = 'https://api.github.com/graphql';
const GRAPHQL_PULL_REQUEST_PAGE_SIZE = 50;
const GITHUB_PULL_REQUESTS_QUERY = `
  query DashboardPullRequests(
    $authoredQuery: String!
    $reviewRequestedQuery: String!
    $first: Int!
  ) {
    authoredPullRequests: search(query: $authoredQuery, type: ISSUE, first: $first) {
      issueCount
      nodes {
        ...PullRequestFields
      }
    }
    reviewRequestedPullRequests: search(query: $reviewRequestedQuery, type: ISSUE, first: $first) {
      issueCount
      nodes {
        ...PullRequestFields
      }
    }
  }

  fragment PullRequestFields on PullRequest {
    number
    title
    url
    isDraft
    updatedAt
    reviewDecision
    mergeStateStatus
    author {
      login
    }
    repository {
      name
      owner {
        login
      }
    }
    reviewRequests(first: 20) {
      nodes {
        requestedReviewer {
          __typename
          ... on User {
            login
          }
          ... on Team {
            slug
            organization {
              login
            }
          }
        }
      }
    }
    commits(last: 1) {
      nodes {
        commit {
          statusCheckRollup {
            state
          }
        }
      }
    }
  }
`;

export function getEmptyGitHubDashboardData(
  connectionStatus: GitHubConnectionStatus = 'not-connected'
): GitHubDashboardData {
  return {
    connectionStatus,
    notificationsCount: 0,
    openPrsCount: 0,
    reviewRequestedCount: 0,
    notifications: [],
    pullRequests: [],
    errorMessage: null,
    missingUsername: false,
    lastUpdatedAt: null
  };
}

export async function testGitHubConnection(token: string): Promise<GitHubConnectionStatus> {
  const trimmedToken = token.trim();
  if (!trimmedToken) {
    return 'not-connected';
  }

  try {
    await fetchGitHub('https://api.github.com/user', trimmedToken);
    return 'connected';
  } catch (error) {
    if (error instanceof GitHubApiError && error.status === 401) {
      return 'invalid';
    }

    return 'error';
  }
}

export async function getGitHubNotifications(token: string): Promise<GitHubNotification[]> {
  const notifications: GitHubNotification[] = [];
  let page = 1;

  while (true) {
    const response = await fetchGitHub(
      `https://api.github.com/notifications?all=true&per_page=50&page=${page}`,
      token
    );
    const pageNotifications = (await response.json()) as GitHubNotification[];

    notifications.push(...pageNotifications);

    if (pageNotifications.length < 50) {
      break;
    }

    page += 1;
  }

  return notifications;
}

export function getPullRequestNotificationSignals(notifications: GitHubNotification[]) {
  return notifications
    .filter((notification) => notification.subject.type === 'PullRequest')
    .map((notification) => ({
      id: notification.id,
      updatedAt: notification.updated_at
    }));
}

export async function getMyOpenPRs(username: string, token: string): Promise<GitHubSearchResponse> {
  const result = await getDashboardPullRequests(username, token);
  return result.authored;
}

export async function getReviewRequestedPRs(
  username: string,
  token: string
): Promise<GitHubSearchResponse> {
  const result = await getDashboardPullRequests(username, token);
  return result.reviewRequested;
}

export async function getLatestGitHubDashboardData(options: {
  username: string;
  token: string;
}) {
  const username = options.username.trim();
  const token = options.token.trim();

  if (!token) {
    return null;
  }

  return getCachedGitHubDashboardData(createCacheToken(username, token), { ignoreExpiration: true });
}

export async function loadGitHubDashboardData(options: {
  username: string;
  token: string;
  forceRefresh?: boolean;
}): Promise<GitHubDashboardData> {
  const username = options.username.trim();
  const token = options.token.trim();

  if (!token) {
    return getEmptyGitHubDashboardData('not-connected');
  }

  const cacheToken = createCacheToken(username, token);
  if (!options.forceRefresh) {
    const cached = await getCachedGitHubDashboardData(cacheToken);
    if (cached) {
      return cached;
    }
  }

  const connectionStatus = await testGitHubConnection(token);
  if (connectionStatus === 'invalid') {
    return {
      ...getEmptyGitHubDashboardData('invalid'),
      errorMessage: 'GitHub rejected the saved token.'
    };
  }

  if (connectionStatus === 'error') {
    return {
      ...getEmptyGitHubDashboardData('error'),
      errorMessage: 'GitHub could not be reached right now.'
    };
  }

  if (!username) {
    const data = {
      ...getEmptyGitHubDashboardData('connected'),
      missingUsername: true,
      errorMessage: 'Add your GitHub username in Settings to load pull requests.',
      lastUpdatedAt: Date.now()
    };

    await saveCachedGitHubDashboardData(cacheToken, data);
    return data;
  }

  try {
    const [notifications, pullRequestResult] = await Promise.all([
      getGitHubNotifications(token),
      getDashboardPullRequests(username, token)
    ]);
    const pullRequests = mergePullRequestSeeds(
      pullRequestResult.authored.items,
      pullRequestResult.reviewRequested.items
    );

    const data: GitHubDashboardData = {
      connectionStatus: 'connected',
      notificationsCount: notifications.length,
      openPrsCount: pullRequestResult.authored.total_count,
      reviewRequestedCount: pullRequestResult.reviewRequested.total_count,
      notifications,
      pullRequests,
      errorMessage: null,
      missingUsername: false,
      lastUpdatedAt: Date.now()
    };

    await Promise.all([
      saveCachedGitHubDashboardData(cacheToken, data),
      saveCachedGitHubNotificationSignals(cacheToken, notifications)
    ]);
    return data;
  } catch (error) {
    return mapGitHubDashboardError(error);
  }
}

export async function pollGitHubNotificationActivity(options: {
  username: string;
  token: string;
}) {
  const username = options.username.trim();
  const token = options.token.trim();

  if (!token) {
    return {
      hasChanges: false,
      changedNotificationIds: []
    };
  }

  const cacheToken = createCacheToken(username, token);
  const previousSignals = await getCachedGitHubNotificationSignals(cacheToken);
  const notifications = await getGitHubNotifications(token);
  const nextSignals = getPullRequestNotificationSignals(notifications);
  const changedNotificationIds = getChangedNotificationIds(previousSignals, nextSignals);

  await saveCachedGitHubNotificationSignals(cacheToken, notifications);

  return {
    hasChanges: changedNotificationIds.length > 0,
    changedNotificationIds
  };
}

async function fetchGitHub(url: string, token: string) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new GitHubApiError(response.status);
  }

  return response;
}

async function fetchGitHubGraphQL<TData>(
  query: string,
  variables: Record<string, string | number>,
  token: string
) {
  let response: Response;

  try {
    response = await fetch(GITHUB_GRAPHQL_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query, variables })
    });
  } catch (error) {
    throw new GitHubApiError(0, 'network', 'GitHub could not be reached right now.');
  }

  let result: GitHubGraphQlResponse;
  try {
    result = (await response.json()) as GitHubGraphQlResponse;
  } catch (error) {
    throw new GitHubApiError(response.status, 'graphql', 'GitHub returned an invalid response.');
  }

  if (!response.ok) {
    throw createGitHubApiErrorFromResponse(response.status, result.errors);
  }

  if (result.errors?.length) {
    throw createGitHubGraphQlError(result.errors);
  }

  if (!result.data) {
    throw new GitHubApiError(response.status, 'graphql', 'GitHub returned an empty response.');
  }

  return result.data as TData;
}

function mergePullRequests(items: GitHubPullRequestItem[]) {
  const deduped = new Map<string, GitHubPullRequestItem>();
  for (const item of items) {
    const existing = deduped.get(item.url);
    if (!existing || new Date(item.updatedAt).getTime() > new Date(existing.updatedAt).getTime()) {
      deduped.set(item.url, item);
    }
  }

  return [...deduped.values()]
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
}

function mergePullRequestSeeds(
  myItems: GitHubPullRequestItem[],
  reviewItems: GitHubPullRequestItem[]
) {
  return mergePullRequests([
    ...myItems.map((item) => mapPullRequestSeed(item, 'authored')),
    ...reviewItems.map((item) => mapPullRequestSeed(item, 'review-requested'))
  ]);
}

function mapPullRequestSeed(
  item: GitHubPullRequestItem,
  source: GitHubPullRequestItem['source']
): GitHubPullRequestItem {
  return {
    ...item,
    source
  };
}

async function getDashboardPullRequests(username: string, token: string): Promise<{
  authored: GitHubSearchResponse;
  reviewRequested: GitHubSearchResponse;
}> {
  const data = await fetchGitHubGraphQL<GitHubGraphQlResponse['data']>(
    GITHUB_PULL_REQUESTS_QUERY,
    {
      authoredQuery: `is:pr is:open author:${username}`,
      reviewRequestedQuery: `is:pr is:open review-requested:${username}`,
      first: GRAPHQL_PULL_REQUEST_PAGE_SIZE
    },
    token
  );

  const authored = data?.authoredPullRequests;
  const reviewRequested = data?.reviewRequestedPullRequests;

  return {
    authored: {
      items: (authored?.nodes ?? []).map((node) => mapGraphQlPullRequest(node, 'authored')),
      total_count: authored?.issueCount ?? 0
    },
    reviewRequested: {
      items: (reviewRequested?.nodes ?? []).map((node) =>
        mapGraphQlPullRequest(node, 'review-requested')
      ),
      total_count: reviewRequested?.issueCount ?? 0
    }
  };
}

function mapGraphQlPullRequest(
  pullRequest: GitHubGraphQlPullRequestNode,
  source: GitHubPullRequestItem['source']
): GitHubPullRequestItem {
  const owner = pullRequest.repository.owner.login;
  const repo = pullRequest.repository.name;

  return {
    id: getPullRequestStableId(owner, repo, pullRequest.number),
    title: pullRequest.title,
    repositoryName: `${owner}/${repo}`,
    owner,
    repo,
    pullNumber: pullRequest.number,
    authorLogin: pullRequest.author?.login ?? '',
    isDraft: pullRequest.isDraft,
    updatedAt: pullRequest.updatedAt,
    url: pullRequest.url,
    source,
    reviewStatus: getReviewStatusFromDecision(pullRequest.isDraft, pullRequest.reviewDecision),
    ciStatus: getCiStatusFromRollup(pullRequest.commits.nodes[0]?.commit?.statusCheckRollup ?? null),
    mergeStateStatus: pullRequest.mergeStateStatus,
    detailsLoaded: true
  };
}

export async function getGitHubPullRequestState(options: {
  owner: string;
  repo: string;
  pullNumber: number;
  token: string;
}): Promise<GitHubPullRequestState> {
  const detail = await getPullRequestDetail(
    options.owner,
    options.repo,
    options.pullNumber,
    options.token
  );

  if (detail.merged) {
    return 'merged';
  }

  return detail.state === 'open' ? 'open' : 'closed';
}

async function getPullRequestDetail(
  owner: string,
  repo: string,
  pullNumber: number,
  token: string
) {
  const response = await fetchGitHub(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${pullNumber}`,
    token
  );
  return (await response.json()) as GitHubPullRequestDetail;
}

function getReviewStatusFromDecision(
  isDraft: boolean,
  reviewDecision: GitHubGraphQlPullRequestNode['reviewDecision']
): GitHubPullRequestItem['reviewStatus'] {
  if (isDraft) {
    return 'draft';
  }

  if (reviewDecision === 'APPROVED') {
    return 'approved';
  }

  if (reviewDecision === 'CHANGES_REQUESTED') {
    return 'changes-requested';
  }

  if (reviewDecision === 'REVIEW_REQUIRED') {
    return 'waiting-review';
  }

  return 'open';
}

function getCiStatusFromRollup(
  statusCheckRollup:
    | {
        state: 'SUCCESS' | 'FAILURE' | 'ERROR' | 'PENDING' | 'EXPECTED' | null;
      }
    | null
): GitHubPullRequestItem['ciStatus'] {
  const state = statusCheckRollup?.state;

  if (!state) {
    return 'no-checks';
  }

  if (state === 'FAILURE' || state === 'ERROR') {
    return 'failing';
  }

  if (state === 'PENDING' || state === 'EXPECTED') {
    return 'pending';
  }

  if (state === 'SUCCESS') {
    return 'passing';
  }

  return 'no-checks';
}

async function getCachedGitHubDashboardData(
  cacheToken: string,
  options: { ignoreExpiration?: boolean } = {}
) {
  const cached = await readStorageValue<CachedGitHubDashboardData | null>(CACHE_KEY, null);
  if (!cached) {
    return null;
  }

  const isExpired = Date.now() - cached.fetchedAt > CACHE_TTL_MS;
  if (cached.cacheToken !== cacheToken || (!options.ignoreExpiration && isExpired)) {
    return null;
  }

  return cached.data;
}

async function saveCachedGitHubDashboardData(cacheToken: string, data: GitHubDashboardData) {
  const cacheEntry: CachedGitHubDashboardData = {
    cacheToken,
    fetchedAt: Date.now(),
    data
  };

  await writeStorageValue(CACHE_KEY, cacheEntry);
}

async function getCachedGitHubNotificationSignals(cacheToken: string) {
  const cached = await readStorageValue<CachedGitHubNotificationSignals | null>(
    NOTIFICATION_SIGNALS_CACHE_KEY,
    null
  );
  if (!cached || cached.cacheToken !== cacheToken) {
    return [];
  }

  return cached.signals;
}

async function saveCachedGitHubNotificationSignals(
  cacheToken: string,
  notifications: GitHubNotification[]
) {
  const cacheEntry: CachedGitHubNotificationSignals = {
    cacheToken,
    signals: getPullRequestNotificationSignals(notifications)
  };

  await writeStorageValue(NOTIFICATION_SIGNALS_CACHE_KEY, cacheEntry);
}

function createCacheToken(username: string, token: string) {
  const input = `${username}:${token}`;
  let hash = 5381;

  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 33) ^ input.charCodeAt(index);
  }

  return `${username}:${(hash >>> 0).toString(16)}`;
}

function getPullRequestStableId(owner: string, repo: string, pullNumber: number) {
  const input = `${owner}/${repo}#${pullNumber}`;
  let hash = 0;

  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) | 0;
  }

  return Math.abs(hash);
}

function createGitHubApiErrorFromResponse(
  status: number,
  errors?: GitHubGraphQlResponse['errors']
) {
  if (status === 401) {
    return new GitHubApiError(status, 'invalid-token', 'GitHub rejected the saved token.');
  }

  if (status === 403) {
    return new GitHubApiError(status, 'rate-limit', 'GitHub rate limit reached. Try again soon.');
  }

  const message = errors?.[0]?.message ?? `GitHub API error: ${status}`;
  return new GitHubApiError(status, 'graphql', message);
}

function createGitHubGraphQlError(errors: NonNullable<GitHubGraphQlResponse['errors']>) {
  const invalidToken = errors.some((error) =>
    error.type === 'FORBIDDEN' && /resource not accessible|bad credentials/i.test(error.message)
  );
  if (invalidToken) {
    return new GitHubApiError(401, 'invalid-token', 'GitHub rejected the saved token.');
  }

  const rateLimit = errors.some((error) => /rate limit/i.test(error.message));
  if (rateLimit) {
    return new GitHubApiError(403, 'rate-limit', 'GitHub rate limit reached. Try again soon.');
  }

  return new GitHubApiError(200, 'graphql', errors.map((error) => error.message).join(' '));
}

function mapGitHubDashboardError(error: unknown): GitHubDashboardData {
  if (error instanceof GitHubApiError) {
    if (error.kind === 'invalid-token') {
      return {
        ...getEmptyGitHubDashboardData('invalid'),
        errorMessage: 'GitHub rejected the saved token.'
      };
    }

    if (error.kind === 'rate-limit') {
      return {
        ...getEmptyGitHubDashboardData('error'),
        errorMessage: 'GitHub rate limit reached. Try again soon.'
      };
    }

    if (error.kind === 'graphql') {
      return {
        ...getEmptyGitHubDashboardData('error'),
        errorMessage: error.message || 'GitHub returned a GraphQL error.'
      };
    }

    if (error.kind === 'network') {
      return {
        ...getEmptyGitHubDashboardData('error'),
        errorMessage: 'GitHub could not be reached right now.'
      };
    }
  }

  return {
    ...getEmptyGitHubDashboardData('error'),
    errorMessage: 'GitHub data could not be loaded right now.'
  };
}

function getChangedNotificationIds(
  previousSignals: GitHubPullRequestNotificationSignal[],
  nextSignals: GitHubPullRequestNotificationSignal[]
) {
  const previousById = new Map(previousSignals.map((signal) => [signal.id, signal.updatedAt]));
  const changedIds: string[] = [];

  for (const signal of nextSignals) {
    if (previousById.get(signal.id) !== signal.updatedAt) {
      changedIds.push(signal.id);
    }
  }

  return changedIds;
}

function hasChromeStorage() {
  return typeof chrome !== 'undefined' && Boolean(chrome.storage?.local);
}

async function readStorageValue<T>(key: string, fallback: T) {
  if (hasChromeStorage()) {
    const result = await chrome.storage.local.get(key);
    return (result[key] as T | undefined) ?? fallback;
  }

  const raw = localStorage.getItem(key);
  if (!raw) {
    return fallback;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeStorageValue(key: string, value: unknown) {
  if (hasChromeStorage()) {
    await chrome.storage.local.set({ [key]: value });
    return;
  }

  localStorage.setItem(key, JSON.stringify(value));
}

class GitHubApiError extends Error {
  status: number;
  kind: 'invalid-token' | 'rate-limit' | 'graphql' | 'network' | 'http';

  constructor(
    status: number,
    kind: 'invalid-token' | 'rate-limit' | 'graphql' | 'network' | 'http' = 'http',
    message = `GitHub API error: ${status}`
  ) {
    super(message);
    this.status = status;
    this.kind = kind;
    this.name = 'GitHubApiError';
  }
}
