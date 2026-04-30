export type GitHubConnectionStatus = 'not-connected' | 'testing' | 'connected' | 'invalid' | 'error';

export type GitHubNotification = {
  id: string;
  unread: boolean;
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
  headSha: string;
  updatedAt: string;
  url: string;
  source: 'authored' | 'review-requested';
  reviewStatus: 'approved' | 'changes-requested' | 'waiting-review';
  ciStatus: 'passing' | 'failing' | 'pending' | 'unknown';
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

type GitHubSearchResponse = {
  items: Array<{
    id: number;
    title: string;
    number: number;
    updated_at: string;
    html_url: string;
    repository_url: string;
  }>;
  total_count: number;
};

type GitHubPullRequestDetail = {
  number: number;
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

type GitHubReview = {
  state: string;
  submitted_at?: string;
};

type GitHubCheckRunsResponse = {
  check_runs: Array<{
    status: string;
    conclusion: string | null;
  }>;
};

type CachedGitHubDashboardData = {
  cacheToken: string;
  fetchedAt: number;
  data: GitHubDashboardData;
};

const CACHE_KEY = 'github-dashboard-cache';
const CACHE_TTL_MS = 5 * 60 * 1000;
const STATUS_CONCURRENCY = 3;

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
  const response = await fetchGitHub('https://api.github.com/notifications', token);
  return (await response.json()) as GitHubNotification[];
}

export async function getMyOpenPRs(username: string, token: string): Promise<GitHubSearchResponse> {
  const query = encodeURIComponent(`is:pr is:open author:${username}`);
  const response = await fetchGitHub(`https://api.github.com/search/issues?q=${query}`, token);
  return (await response.json()) as GitHubSearchResponse;
}

export async function getReviewRequestedPRs(
  username: string,
  token: string
): Promise<GitHubSearchResponse> {
  const query = encodeURIComponent(`is:pr is:open review-requested:${username}`);
  const response = await fetchGitHub(`https://api.github.com/search/issues?q=${query}`, token);
  return (await response.json()) as GitHubSearchResponse;
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
    const [notifications, myOpenPrs, reviewRequestedPrs] = await Promise.all([
      getGitHubNotifications(token),
      getMyOpenPRs(username, token),
      getReviewRequestedPRs(username, token)
    ]);

    const pullRequests = mergePullRequestSeeds(myOpenPrs.items, reviewRequestedPrs.items);

    const data: GitHubDashboardData = {
      connectionStatus: 'connected',
      notificationsCount: notifications.length,
      openPrsCount: myOpenPrs.total_count,
      reviewRequestedCount: reviewRequestedPrs.total_count,
      notifications,
      pullRequests,
      errorMessage: null,
      missingUsername: false,
      lastUpdatedAt: Date.now()
    };

    await saveCachedGitHubDashboardData(cacheToken, data);
    return data;
  } catch (error) {
    if (error instanceof GitHubApiError && error.status === 401) {
      return {
        ...getEmptyGitHubDashboardData('invalid'),
        errorMessage: 'GitHub rejected the saved token.'
      };
    }

    return {
      ...getEmptyGitHubDashboardData('error'),
      errorMessage: 'GitHub data could not be loaded right now.'
    };
  }
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
  myItems: GitHubSearchResponse['items'],
  reviewItems: GitHubSearchResponse['items']
) {
  return mergePullRequests([
    ...myItems.map((item) => mapPullRequestSeed(item, 'authored')),
    ...reviewItems.map((item) => mapPullRequestSeed(item, 'review-requested'))
  ]);
}

function mapPullRequestSeed(
  item: GitHubSearchResponse['items'][number],
  source: GitHubPullRequestItem['source']
): GitHubPullRequestItem {
  const { owner, repo } = parseRepository(item.repository_url);

  return {
    id: item.id,
    title: item.title,
    repositoryName: `${owner}/${repo}`,
    owner,
    repo,
    pullNumber: item.number,
    headSha: '',
    updatedAt: item.updated_at,
    url: item.html_url,
    source,
    reviewStatus: 'waiting-review',
    ciStatus: 'unknown',
    detailsLoaded: false
  };
}

export async function enrichGitHubPullRequests(
  pullRequests: GitHubPullRequestItem[],
  token: string
) {
  return runWithConcurrency(
    pullRequests,
    STATUS_CONCURRENCY,
    async (pullRequest) => enrichPullRequest(pullRequest, token)
  );
}

async function enrichPullRequest(
  pullRequest: GitHubPullRequestItem,
  token: string
): Promise<GitHubPullRequestItem> {
  try {
    const detail = await getPullRequestDetail(
      pullRequest.owner,
      pullRequest.repo,
      pullRequest.pullNumber,
      token
    );

    const owner = detail.base.repo.owner.login;
    const repo = detail.base.repo.name;
    const headSha = detail.head.sha;

    const [reviews, checkRuns] = await Promise.all([
      getPullRequestReviews(owner, repo, pullRequest.pullNumber, token).catch(() => []),
      getCommitCheckRuns(owner, repo, headSha, token).catch(() => [])
    ]);

    return {
      ...pullRequest,
      owner,
      repo,
      repositoryName: `${owner}/${repo}`,
      headSha,
      reviewStatus: getReviewStatus(reviews),
      ciStatus: getCiStatus(checkRuns),
      detailsLoaded: true
    };
  } catch {
    return {
      ...pullRequest,
      reviewStatus: 'waiting-review',
      ciStatus: 'unknown',
      detailsLoaded: true
    };
  }
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

async function getPullRequestReviews(
  owner: string,
  repo: string,
  pullNumber: number,
  token: string
) {
  const response = await fetchGitHub(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${pullNumber}/reviews`,
    token
  );
  return (await response.json()) as GitHubReview[];
}

async function getCommitCheckRuns(owner: string, repo: string, headSha: string, token: string) {
  const response = await fetchGitHub(
    `https://api.github.com/repos/${owner}/${repo}/commits/${headSha}/check-runs`,
    token
  );
  const result = (await response.json()) as GitHubCheckRunsResponse;
  return result.check_runs ?? [];
}

function getReviewStatus(reviews: GitHubReview[]): GitHubPullRequestItem['reviewStatus'] {
  if (reviews.length === 0) {
    return 'waiting-review';
  }

  const sorted = [...reviews].sort((left, right) => {
    const leftTime = left.submitted_at ? new Date(left.submitted_at).getTime() : 0;
    const rightTime = right.submitted_at ? new Date(right.submitted_at).getTime() : 0;
    return rightTime - leftTime;
  });

  for (const review of sorted) {
    if (review.state === 'CHANGES_REQUESTED') {
      return 'changes-requested';
    }

    if (review.state === 'APPROVED') {
      return 'approved';
    }

    if (review.state === 'COMMENTED') {
      return 'waiting-review';
    }
  }

  return 'waiting-review';
}

function getCiStatus(
  checkRuns: GitHubCheckRunsResponse['check_runs']
): GitHubPullRequestItem['ciStatus'] {
  if (checkRuns.length === 0) {
    return 'unknown';
  }

  if (
    checkRuns.some((checkRun) =>
      ['failure', 'cancelled', 'timed_out', 'action_required'].includes(checkRun.conclusion ?? '')
    )
  ) {
    return 'failing';
  }

  if (
    checkRuns.some((checkRun) =>
      ['queued', 'in_progress', 'waiting', 'requested', 'pending'].includes(checkRun.status)
    )
  ) {
    return 'pending';
  }

  if (
    checkRuns.every((checkRun) =>
      ['success', 'neutral', 'skipped'].includes(checkRun.conclusion ?? '')
    )
  ) {
    return 'passing';
  }

  return 'unknown';
}

function parseRepository(repositoryUrl: string) {
  const normalized = repositoryUrl.replace('https://api.github.com/repos/', '');
  const [owner, repo] = normalized.split('/');
  return { owner, repo };
}

async function getCachedGitHubDashboardData(cacheToken: string) {
  const cached = await readStorageValue<CachedGitHubDashboardData | null>(CACHE_KEY, null);
  if (!cached) {
    return null;
  }

  const isExpired = Date.now() - cached.fetchedAt > CACHE_TTL_MS;
  if (cached.cacheToken !== cacheToken || isExpired) {
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

function createCacheToken(username: string, token: string) {
  const input = `${username}:${token}`;
  let hash = 5381;

  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 33) ^ input.charCodeAt(index);
  }

  return `${username}:${(hash >>> 0).toString(16)}`;
}

async function runWithConcurrency<TInput, TResult>(
  items: TInput[],
  concurrency: number,
  mapper: (item: TInput) => Promise<TResult>
) {
  const results: TResult[] = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const currentIndex = cursor;
      cursor += 1;
      results[currentIndex] = await mapper(items[currentIndex]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
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

  constructor(status: number) {
    super(`GitHub API error: ${status}`);
    this.status = status;
  }
}
