export type GitHubConnectionStatus = 'not-connected' | 'testing' | 'connected' | 'invalid' | 'error';

export type GitHubNotification = {
  id: string;
};

export type GitHubPullRequestItem = {
  id: number;
  title: string;
  repositoryName: string;
  updatedAt: string;
  url: string;
  source: 'authored' | 'review-requested';
};

export type GitHubDashboardData = {
  connectionStatus: GitHubConnectionStatus;
  notificationsCount: number;
  openPrsCount: number;
  reviewRequestedCount: number;
  pullRequests: GitHubPullRequestItem[];
  errorMessage: string | null;
  missingUsername: boolean;
  lastUpdatedAt: number | null;
};

type GitHubSearchResponse = {
  items: Array<{
    id: number;
    title: string;
    updated_at: string;
    html_url: string;
    repository_url: string;
  }>;
  total_count: number;
};

type CachedGitHubDashboardData = {
  cacheToken: string;
  fetchedAt: number;
  data: GitHubDashboardData;
};

const CACHE_KEY = 'github-dashboard-cache';
const CACHE_TTL_MS = 5 * 60 * 1000;

export function getEmptyGitHubDashboardData(
  connectionStatus: GitHubConnectionStatus = 'not-connected'
): GitHubDashboardData {
  return {
    connectionStatus,
    notificationsCount: 0,
    openPrsCount: 0,
    reviewRequestedCount: 0,
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

    const data: GitHubDashboardData = {
      connectionStatus: 'connected',
      notificationsCount: notifications.length,
      openPrsCount: myOpenPrs.total_count,
      reviewRequestedCount: reviewRequestedPrs.total_count,
      pullRequests: mergePullRequests(myOpenPrs.items, reviewRequestedPrs.items),
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

function mergePullRequests(
  myItems: GitHubSearchResponse['items'],
  reviewItems: GitHubSearchResponse['items']
) {
  const items = [
    ...myItems.map((item) => mapPullRequest(item, 'authored')),
    ...reviewItems.map((item) => mapPullRequest(item, 'review-requested'))
  ];

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

function mapPullRequest(
  item: GitHubSearchResponse['items'][number],
  source: GitHubPullRequestItem['source']
): GitHubPullRequestItem {
  return {
    id: item.id,
    title: item.title,
    repositoryName: item.repository_url.replace('https://api.github.com/repos/', ''),
    updatedAt: item.updated_at,
    url: item.html_url,
    source
  };
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
