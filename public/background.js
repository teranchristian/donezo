const JIRA_ISSUES_CACHE_KEY = 'jira-issues-cache-v4';
const JIRA_CACHE_TTL_MS = 5 * 60 * 1000;
const JIRA_ACTIVE_ISSUES_JQL =
  'assignee = currentUser() AND statusCategory != Done ORDER BY priority DESC, updated DESC';

const GITHUB_DASHBOARD_CACHE_KEY = 'github-dashboard-cache';
const GITHUB_NOTIFICATION_SIGNALS_CACHE_KEY = 'github-notification-signals';
const GITHUB_PULL_REQUEST_SIGNALS_CACHE_KEY = 'github-pull-request-signals';
const GITHUB_CACHE_TTL_MS = 5 * 60 * 1000;
const GITHUB_NOTIFICATIONS_WINDOW_DAYS = 7;
const GITHUB_NOTIFICATIONS_PAGE_SIZE = 50;
const GITHUB_GRAPHQL_URL = 'https://api.github.com/graphql';
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
const GITHUB_PULL_REQUEST_PAGE_SIZE = 50;

const gitHubDashboardRequests = new Map();
const gitHubActivityPollRequests = new Map();
const gitHubPullRequestStateRequests = new Map();
const gitHubPullRequestStatesRequests = new Map();

function normalizeJiraBaseUrl(baseUrl) {
  return String(baseUrl ?? '').trim().replace(/\/+$/, '');
}

function encodeBasicAuth(email, apiToken) {
  return btoa(`${email}:${apiToken}`);
}

function createJiraCredentialsKey(jiraBaseUrl, jiraEmail, jiraApiToken) {
  return JSON.stringify({
    jiraBaseUrl,
    jiraEmail,
    jiraApiToken
  });
}

async function getCachedJiraIssues(credentialsKey) {
  const result = await chrome.storage.local.get(JIRA_ISSUES_CACHE_KEY);
  const cached = result[JIRA_ISSUES_CACHE_KEY];

  if (!cached || cached.credentialsKey !== credentialsKey) {
    return null;
  }

  if (Date.now() - cached.fetchedAt > JIRA_CACHE_TTL_MS) {
    return null;
  }

  return cached.issues;
}

async function saveCachedJiraIssues(credentialsKey, issues) {
  await chrome.storage.local.set({
    [JIRA_ISSUES_CACHE_KEY]: {
      credentialsKey,
      fetchedAt: Date.now(),
      issues
    }
  });
}

function getEmptyGitHubDashboardData(connectionStatus = 'not-connected') {
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

function normalizeGitHubUsername(username) {
  return String(username ?? '').trim();
}

function normalizeGitHubToken(token) {
  return String(token ?? '').trim();
}

function createGitHubCacheToken(username, token) {
  const input = `${username}:${token}`;
  let hash = 5381;

  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 33) ^ input.charCodeAt(index);
  }

  return `${username}:${(hash >>> 0).toString(16)}`;
}

async function getCachedGitHubDashboardData(cacheToken, options = {}) {
  const result = await chrome.storage.local.get(GITHUB_DASHBOARD_CACHE_KEY);
  const cached = result[GITHUB_DASHBOARD_CACHE_KEY];
  if (!cached) {
    return null;
  }

  const isExpired = Date.now() - cached.fetchedAt > GITHUB_CACHE_TTL_MS;
  if (cached.cacheToken !== cacheToken || (!options.ignoreExpiration && isExpired)) {
    return null;
  }

  return cached.data;
}

async function saveCachedGitHubDashboardData(cacheToken, data) {
  await chrome.storage.local.set({
    [GITHUB_DASHBOARD_CACHE_KEY]: {
      cacheToken,
      fetchedAt: Date.now(),
      data
    }
  });
}

async function getCachedGitHubNotificationSignals(cacheToken) {
  const result = await chrome.storage.local.get(GITHUB_NOTIFICATION_SIGNALS_CACHE_KEY);
  const cached = result[GITHUB_NOTIFICATION_SIGNALS_CACHE_KEY];

  if (!cached || cached.cacheToken !== cacheToken) {
    return [];
  }

  return cached.signals ?? [];
}

async function saveCachedGitHubNotificationSignals(cacheToken, notifications) {
  await chrome.storage.local.set({
    [GITHUB_NOTIFICATION_SIGNALS_CACHE_KEY]: {
      cacheToken,
      signals: getPullRequestNotificationSignals(notifications)
    }
  });
}

async function getCachedGitHubPullRequestSignals(cacheToken) {
  const result = await chrome.storage.local.get(GITHUB_PULL_REQUEST_SIGNALS_CACHE_KEY);
  const cached = result[GITHUB_PULL_REQUEST_SIGNALS_CACHE_KEY];

  if (!cached || cached.cacheToken !== cacheToken) {
    return [];
  }

  return cached.signals ?? [];
}

async function saveCachedGitHubPullRequestSignals(cacheToken, pullRequests) {
  await chrome.storage.local.set({
    [GITHUB_PULL_REQUEST_SIGNALS_CACHE_KEY]: {
      cacheToken,
      signals: getDashboardPullRequestSignals(pullRequests)
    }
  });
}

function getPullRequestNotificationSignals(notifications) {
  return notifications
    .filter((notification) => notification.subject?.type === 'PullRequest')
    .map((notification) => ({
      id: notification.id,
      updatedAt: notification.updated_at,
      unread: Boolean(notification.unread)
    }));
}

function getDashboardPullRequestSignals(pullRequests) {
  return pullRequests.map((pullRequest) => ({
    id: pullRequest.url,
    updatedAt: pullRequest.updatedAt,
    reviewStatus: pullRequest.reviewStatus,
    ciStatus: pullRequest.ciStatus,
    mergeStateStatus: pullRequest.mergeStateStatus,
    isDraft: Boolean(pullRequest.isDraft)
  }));
}

function getChangedSignalIds(previousSignals, nextSignals) {
  const previousById = new Map(previousSignals.map((signal) => [signal.id, JSON.stringify(signal)]));
  const nextIds = new Set(nextSignals.map((signal) => signal.id));
  const changedIds = [];

  for (const signal of nextSignals) {
    if (previousById.get(signal.id) !== JSON.stringify(signal)) {
      changedIds.push(signal.id);
    }
  }

  for (const previousSignal of previousSignals) {
    if (!nextIds.has(previousSignal.id)) {
      changedIds.push(previousSignal.id);
    }
  }

  return changedIds;
}

async function fetchGitHub(url, token) {
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

async function fetchGitHubGraphQL(query, variables, token) {
  let response;

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

  let result;
  try {
    result = await response.json();
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

  return result.data;
}

async function testGitHubConnection(token) {
  const trimmedToken = normalizeGitHubToken(token);
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

function getGitHubNotificationsSinceIso() {
  return new Date(Date.now() - GITHUB_NOTIFICATIONS_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

async function getGitHubNotifications(token) {
  const notifications = [];
  let page = 1;
  const since = getGitHubNotificationsSinceIso();

  while (true) {
    const searchParams = new URLSearchParams({
      all: 'true',
      per_page: String(GITHUB_NOTIFICATIONS_PAGE_SIZE),
      page: String(page),
      since
    });
    const response = await fetchGitHub(
      `https://api.github.com/notifications?${searchParams.toString()}`,
      token
    );
    const pageNotifications = await response.json();

    notifications.push(...pageNotifications);

    if (pageNotifications.length < GITHUB_NOTIFICATIONS_PAGE_SIZE) {
      break;
    }

    page += 1;
  }

  return notifications;
}

function getPullRequestIdentityFromNotification(notification) {
  const subjectUrl = String(notification?.subject?.url ?? '').trim();
  if (!subjectUrl) {
    return null;
  }

  const apiPath = subjectUrl.replace('https://api.github.com/repos/', '');
  const [owner, repo, resource, pullNumber] = apiPath.split('/');

  if (resource !== 'pulls' || !owner || !repo || !pullNumber) {
    return null;
  }

  const parsedPullNumber = Number(pullNumber);
  if (!Number.isFinite(parsedPullNumber) || parsedPullNumber <= 0) {
    return null;
  }

  return {
    owner,
    repo,
    pullNumber: parsedPullNumber
  };
}

function buildGitHubNotificationAuthorsQuery(pullRequests) {
  const queryBody = pullRequests
    .map(
      (pullRequest, index) => `
      pr${index}: repository(owner: ${JSON.stringify(pullRequest.owner)}, name: ${JSON.stringify(pullRequest.repo)}) {
        pullRequest(number: ${pullRequest.pullNumber}) {
          author {
            login
          }
        }
      }`
    )
    .join('\n');

  return `query NotificationPullRequestAuthors {${queryBody}
  }`;
}

async function getGitHubNotificationAuthorLogins(notifications, token) {
  const uniquePullRequests = [];
  const notificationIdsByPullRequestKey = new Map();

  for (const notification of notifications) {
    if (notification?.subject?.type !== 'PullRequest') {
      continue;
    }

    const pullRequestIdentity = getPullRequestIdentityFromNotification(notification);
    if (!pullRequestIdentity) {
      continue;
    }

    const key = `${pullRequestIdentity.owner}/${pullRequestIdentity.repo}#${pullRequestIdentity.pullNumber}`;
    if (!notificationIdsByPullRequestKey.has(key)) {
      notificationIdsByPullRequestKey.set(key, []);
      uniquePullRequests.push(pullRequestIdentity);
    }

    notificationIdsByPullRequestKey.get(key).push(notification.id);
  }

  if (uniquePullRequests.length === 0) {
    return {};
  }

  const data = await fetchGitHubGraphQL(
    buildGitHubNotificationAuthorsQuery(uniquePullRequests),
    {},
    token
  );
  const authorLoginsByNotificationId = {};

  uniquePullRequests.forEach((pullRequest, index) => {
    const authorLogin = data?.[`pr${index}`]?.pullRequest?.author?.login ?? '';
    if (!authorLogin) {
      return;
    }

    const key = `${pullRequest.owner}/${pullRequest.repo}#${pullRequest.pullNumber}`;
    const notificationIds = notificationIdsByPullRequestKey.get(key) ?? [];

    notificationIds.forEach((notificationId) => {
      authorLoginsByNotificationId[notificationId] = authorLogin;
    });
  });

  return authorLoginsByNotificationId;
}

async function getDashboardPullRequests(username, token) {
  const data = await fetchGitHubGraphQL(
    GITHUB_PULL_REQUESTS_QUERY,
    {
      authoredQuery: `is:pr is:open author:${username}`,
      reviewRequestedQuery: `is:pr is:open review-requested:${username}`,
      first: GITHUB_PULL_REQUEST_PAGE_SIZE
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

function mergePullRequests(items) {
  const deduped = new Map();
  for (const item of items) {
    const existing = deduped.get(item.url);
    if (!existing || new Date(item.updatedAt).getTime() > new Date(existing.updatedAt).getTime()) {
      deduped.set(item.url, item);
    }
  }

  return [...deduped.values()].sort(
    (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
  );
}

function mergePullRequestSeeds(myItems, reviewItems) {
  return mergePullRequests([
    ...myItems.map((item) => ({ ...item, source: 'authored' })),
    ...reviewItems.map((item) => ({ ...item, source: 'review-requested' }))
  ]);
}

function mapGraphQlPullRequest(pullRequest, source) {
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

function getReviewStatusFromDecision(isDraft, reviewDecision) {
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

function getCiStatusFromRollup(statusCheckRollup) {
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

function getPullRequestStableId(owner, repo, pullNumber) {
  const input = `${owner}/${repo}#${pullNumber}`;
  let hash = 0;

  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) | 0;
  }

  return Math.abs(hash);
}

function createGitHubApiErrorFromResponse(status, errors) {
  if (status === 401) {
    return new GitHubApiError(status, 'invalid-token', 'GitHub rejected the saved token.');
  }

  if (status === 403) {
    return new GitHubApiError(status, 'rate-limit', 'GitHub rate limit reached. Try again soon.');
  }

  const message = errors?.[0]?.message ?? `GitHub API error: ${status}`;
  return new GitHubApiError(status, 'graphql', message);
}

function createGitHubGraphQlError(errors) {
  const invalidToken = errors.some(
    (error) =>
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

function mapGitHubDashboardError(error) {
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

async function loadGitHubDashboardData(payload) {
  const username = normalizeGitHubUsername(payload.username);
  const token = normalizeGitHubToken(payload.token);

  if (!token) {
    return getEmptyGitHubDashboardData('not-connected');
  }

  const cacheToken = createGitHubCacheToken(username, token);
  if (!payload.forceRefresh) {
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
    const notificationAuthorLogins = await getGitHubNotificationAuthorLogins(notifications, token);
    const enrichedNotifications = notifications.map((notification) =>
      notificationAuthorLogins[notification.id]
        ? { ...notification, authorLogin: notificationAuthorLogins[notification.id] }
        : notification
    );
    const pullRequests = mergePullRequestSeeds(
      pullRequestResult.authored.items,
      pullRequestResult.reviewRequested.items
    );

    const data = {
      connectionStatus: 'connected',
      notificationsCount: enrichedNotifications.length,
      openPrsCount: pullRequestResult.authored.total_count,
      reviewRequestedCount: pullRequestResult.reviewRequested.total_count,
      notifications: enrichedNotifications,
      pullRequests,
      errorMessage: null,
      missingUsername: false,
      lastUpdatedAt: Date.now()
    };

    await Promise.all([
      saveCachedGitHubDashboardData(cacheToken, data),
      saveCachedGitHubNotificationSignals(cacheToken, enrichedNotifications),
      saveCachedGitHubPullRequestSignals(cacheToken, pullRequests)
    ]);
    return data;
  } catch (error) {
    return mapGitHubDashboardError(error);
  }
}

async function pollGitHubNotificationActivity(payload) {
  const username = normalizeGitHubUsername(payload.username);
  const token = normalizeGitHubToken(payload.token);

  if (!token) {
    return {
      hasChanges: false,
      changedNotificationIds: []
    };
  }

  const cacheToken = createGitHubCacheToken(username, token);
  const [previousNotificationSignals, previousPullRequestSignals] = await Promise.all([
    getCachedGitHubNotificationSignals(cacheToken),
    getCachedGitHubPullRequestSignals(cacheToken)
  ]);
  const [notifications, pullRequestResult] = await Promise.all([
    getGitHubNotifications(token),
    username ? getDashboardPullRequests(username, token) : null
  ]);
  const pullRequests = pullRequestResult
    ? mergePullRequestSeeds(pullRequestResult.authored.items, pullRequestResult.reviewRequested.items)
    : [];
  const nextNotificationSignals = getPullRequestNotificationSignals(notifications);
  const nextPullRequestSignals = getDashboardPullRequestSignals(pullRequests);
  const changedNotificationIds = getChangedSignalIds(
    previousNotificationSignals,
    nextNotificationSignals
  );
  const changedPullRequestIds = getChangedSignalIds(previousPullRequestSignals, nextPullRequestSignals);

  await Promise.all([
    saveCachedGitHubNotificationSignals(cacheToken, notifications),
    saveCachedGitHubPullRequestSignals(cacheToken, pullRequests)
  ]);

  return {
    hasChanges: changedNotificationIds.length > 0 || changedPullRequestIds.length > 0,
    changedNotificationIds: [...new Set([...changedNotificationIds, ...changedPullRequestIds])]
  };
}

async function getGitHubPullRequestState(payload) {
  const response = await fetchGitHub(
    `https://api.github.com/repos/${payload.owner}/${payload.repo}/pulls/${payload.pullNumber}`,
    normalizeGitHubToken(payload.token)
  );
  const detail = await response.json();

  if (detail.merged) {
    return 'merged';
  }

  return detail.state === 'open' ? 'open' : 'closed';
}

function buildGitHubPullRequestStatesQuery(pullRequests) {
  const queryBody = pullRequests
    .map(
      (pullRequest, index) => `
      pr${index}: repository(owner: ${JSON.stringify(pullRequest.owner)}, name: ${JSON.stringify(pullRequest.repo)}) {
        pullRequest(number: ${pullRequest.pullNumber}) {
          state
          merged
        }
      }`
    )
    .join('\n');

  return `query NotificationPullRequestStates {${queryBody}
  }`;
}

async function getGitHubPullRequestStates(payload) {
  const token = normalizeGitHubToken(payload.token);
  const inputPullRequests = Array.isArray(payload.pullRequests) ? payload.pullRequests : [];
  const uniquePullRequests = [];
  const requestIdsByPullRequestKey = new Map();

  for (const pullRequest of inputPullRequests) {
    const owner = String(pullRequest?.owner ?? '').trim();
    const repo = String(pullRequest?.repo ?? '').trim();
    const pullNumber = Number(pullRequest?.pullNumber);
    const id = String(pullRequest?.id ?? '').trim();

    if (!owner || !repo || !Number.isFinite(pullNumber) || pullNumber <= 0 || !id) {
      continue;
    }

    const key = `${owner}/${repo}#${pullNumber}`;
    if (!requestIdsByPullRequestKey.has(key)) {
      requestIdsByPullRequestKey.set(key, []);
      uniquePullRequests.push({ owner, repo, pullNumber });
    }

    requestIdsByPullRequestKey.get(key).push(id);
  }

  if (uniquePullRequests.length === 0) {
    return {};
  }

  const data = await fetchGitHubGraphQL(
    buildGitHubPullRequestStatesQuery(uniquePullRequests),
    {},
    token
  );
  const statesById = {};

  uniquePullRequests.forEach((pullRequest, index) => {
    const result = data?.[`pr${index}`]?.pullRequest;
    const state = result?.merged ? 'merged' : result?.state === 'OPEN' ? 'open' : 'closed';
    const key = `${pullRequest.owner}/${pullRequest.repo}#${pullRequest.pullNumber}`;
    const requestIds = requestIdsByPullRequestKey.get(key) ?? [];

    requestIds.forEach((id) => {
      statesById[id] = state;
    });
  });

  return statesById;
}

function withSharedPromise(map, key, factory) {
  const existing = map.get(key);
  if (existing) {
    return existing;
  }

  const promise = Promise.resolve()
    .then(factory)
    .finally(() => {
      map.delete(key);
    });

  map.set(key, promise);
  return promise;
}

function normalizeJiraIssue(issue) {
  const issueLinks = Array.isArray(issue?.fields?.issuelinks) ? issue.fields.issuelinks : [];
  const blockingIssues = getBlockingIssues(issue);
  const blockedByIssues = getBlockedByIssues(issue);

  console.log('Normalized Jira issue:', {
    key: issue?.key,
    issueLinks,
    blockingIssues,
    blockedByIssues
  });

  return {
    id: String(issue?.id ?? ''),
    key: String(issue?.key ?? ''),
    summary: String(issue?.fields?.summary ?? ''),
    updated: String(issue?.fields?.updated ?? ''),
    project: issue?.fields?.project
      ? {
          key: issue.fields.project.key,
          name: issue.fields.project.name
        }
      : undefined,
    blockingCount: blockingIssues.length,
    blockingIssues,
    blockedByIssues,
    status: {
      name: String(issue?.fields?.status?.name ?? 'Unknown'),
      statusCategory: issue?.fields?.status?.statusCategory
        ? {
            key: issue.fields.status.statusCategory.key,
            name: issue.fields.status.statusCategory.name
          }
        : undefined
    },
    priority: issue?.fields?.priority
      ? {
          name: issue.fields.priority.name
        }
      : undefined,
    issuelinks: issueLinks
  };
}

function getBlockingIssues(issue) {
  return getIssueLinks(issue)
    .filter((link) => getIssueRelationshipType(link) === 'blocks')
    .map((link) => getRelatedIssue(link))
    .filter((linkedIssue) => Boolean(linkedIssue.key));
}

function getBlockedByIssues(issue) {
  return getIssueLinks(issue)
    .filter((link) => getIssueRelationshipType(link) === 'blocked-by')
    .map((link) => getRelatedIssue(link))
    .filter((linkedIssue) => Boolean(linkedIssue.key));
}

function getIssueLinks(issue) {
  return Array.isArray(issue?.fields?.issuelinks) ? issue.fields.issuelinks : [];
}

function getIssueRelationshipType(link) {
  if (link?.type?.name !== 'Blocks') {
    return null;
  }

  const inwardLabel = String(link?.type?.inward ?? '').trim().toLowerCase();
  const outwardLabel = String(link?.type?.outward ?? '').trim().toLowerCase();

  if (outwardLabel === 'blocks') {
    if (link?.inwardIssue) {
      return 'blocks';
    }

    if (link?.outwardIssue) {
      return 'blocked-by';
    }
  }

  if (inwardLabel === 'is blocked by') {
    if (link?.inwardIssue) {
      return 'blocked-by';
    }

    if (link?.outwardIssue) {
      return 'blocks';
    }
  }

  if (link?.outwardIssue) {
    return 'blocks';
  }

  if (link?.inwardIssue) {
    return 'blocked-by';
  }

  return null;
}

function getRelatedIssue(link) {
  const relationshipType = getIssueRelationshipType(link);
  const linkedIssue =
    relationshipType === 'blocks'
      ? (link?.inwardIssue ?? link?.outwardIssue)
      : (link?.outwardIssue ?? link?.inwardIssue);

  return {
    key: String(linkedIssue?.key ?? ''),
    summary: linkedIssue?.fields?.summary,
    status: linkedIssue?.fields?.status?.name,
    assignee: linkedIssue?.fields?.assignee?.displayName
  };
}

function getMissingBlockingIssueKeys(issues) {
  const missingKeys = new Set();

  issues.forEach((issue) => {
    [...getBlockingIssues(issue), ...getBlockedByIssues(issue)].forEach((linkedIssue) => {
      if (!linkedIssue.summary || !linkedIssue.status || !linkedIssue.assignee) {
        missingKeys.add(linkedIssue.key);
      }
    });
  });

  return Array.from(missingKeys);
}

function escapeJqlValue(value) {
  return String(value ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function mergeBlockingIssueDetails(issues, issueDetailsByKey) {
  return issues.map((issue) => {
    const issueLinks = Array.isArray(issue?.fields?.issuelinks) ? issue.fields.issuelinks : [];

    return {
      ...issue,
      fields: {
        ...issue.fields,
        issuelinks: issueLinks.map((link) => {
          const linkedIssue = getRelatedIssue(link);
          if (!linkedIssue.key || !issueDetailsByKey[linkedIssue.key]) {
            return link;
          }

          const linkedIssueKey = linkedIssue.key;
          const relationshipType = getIssueRelationshipType(link);
          const targetField =
            relationshipType === 'blocks'
              ? (link?.inwardIssue ? 'inwardIssue' : 'outwardIssue')
              : (link?.outwardIssue ? 'outwardIssue' : 'inwardIssue');

          return {
            ...link,
            [targetField]: {
              ...link[targetField],
              fields: {
                ...link[targetField]?.fields,
                ...issueDetailsByKey[linkedIssueKey]
              }
            }
          };
        })
      }
    };
  });
}

async function fetchBlockingIssueDetails(jiraBaseUrl, auth, issueKeys) {
  if (issueKeys.length === 0) {
    return {};
  }

  const result = await fetchJira(`${jiraBaseUrl}/rest/api/3/search/jql`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      jql: `issuekey in (${issueKeys.map((issueKey) => `"${escapeJqlValue(issueKey)}"`).join(', ')})`,
      fields: ['summary', 'status', 'assignee'],
      maxResults: issueKeys.length
    })
  });

  if (!result.success) {
    return {};
  }

  const data = await result.response.json();
  const issues = Array.isArray(data.issues) ? data.issues : [];

  return issues.reduce((accumulator, issue) => {
    const issueKey = String(issue?.key ?? '');
    if (!issueKey) {
      return accumulator;
    }

    accumulator[issueKey] = {
      summary: issue?.fields?.summary,
      status: issue?.fields?.status
        ? {
            name: issue.fields.status.name
          }
        : undefined,
      assignee: issue?.fields?.assignee
        ? {
            displayName: issue.fields.assignee.displayName
          }
        : undefined
    };

    return accumulator;
  }, {});
}

async function fetchJiraIssuesByJql(jiraBaseUrl, auth, jql, maxResults) {
  const result = await fetchJira(`${jiraBaseUrl}/rest/api/3/search/jql`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      jql,
      fields: ['summary', 'status', 'priority', 'updated', 'issuelinks', 'project'],
      maxResults
    })
  });

  if (!result.success) {
    throw new Error(result.error ?? 'Failed to load Jira issues');
  }

  const data = await result.response.json();
  const fetchedIssues = Array.isArray(data.issues) ? data.issues : [];
  const missingBlockingIssueKeys = getMissingBlockingIssueKeys(fetchedIssues);
  const blockingIssueDetailsByKey = await fetchBlockingIssueDetails(
    jiraBaseUrl,
    auth,
    missingBlockingIssueKeys
  );

  return mergeBlockingIssueDetails(fetchedIssues, blockingIssueDetailsByKey).map(normalizeJiraIssue);
}

async function fetchJiraIssuesByKeys(jiraBaseUrl, auth, issueKeys) {
  const uniqueIssueKeys = Array.from(new Set(issueKeys.map((issueKey) => String(issueKey).trim().toUpperCase())));
  if (uniqueIssueKeys.length === 0) {
    return [];
  }

  const jql = `issuekey in (${uniqueIssueKeys.map((issueKey) => `"${escapeJqlValue(issueKey)}"`).join(', ')})`;
  return fetchJiraIssuesByJql(jiraBaseUrl, auth, jql, uniqueIssueKeys.length);
}

async function fetchJira(endpoint, options) {
  const response = await fetch(endpoint, options);

  if (response.status === 401) {
    return { success: false, status: 401, error: 'Invalid credentials' };
  }

  if (!response.ok) {
    return {
      success: false,
      status: response.status,
      error: `Jira request failed with status ${response.status}`
    };
  }

  return { success: true, response };
}

class GitHubApiError extends Error {
  constructor(status, kind = 'http', message = `GitHub API error: ${status}`) {
    super(message);
    this.status = status;
    this.kind = kind;
    this.name = 'GitHubApiError';
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (
    ![
      'TEST_GITHUB_CONNECTION',
      'FETCH_GITHUB_DASHBOARD',
      'POLL_GITHUB_ACTIVITY',
      'FETCH_GITHUB_PULL_REQUEST_STATE',
      'FETCH_GITHUB_PULL_REQUEST_STATES',
      'TEST_JIRA_CONNECTION',
      'FETCH_JIRA_ISSUES',
      'FETCH_JIRA_ISSUES_BY_KEYS'
    ].includes(message?.type)
  ) {
    return false;
  }

  void (async () => {
    const payload = message?.payload ?? {};

    if (message.type === 'TEST_GITHUB_CONNECTION') {
      try {
        const status = await testGitHubConnection(payload.token);
        sendResponse({ success: true, status });
      } catch (error) {
        sendResponse({
          success: false,
          status: 'error',
          error: error instanceof Error ? error.message : 'Failed to reach GitHub'
        });
      }

      return;
    }

    if (message.type === 'FETCH_GITHUB_DASHBOARD') {
      const username = normalizeGitHubUsername(payload.username);
      const token = normalizeGitHubToken(payload.token);
      const requestKey = JSON.stringify({
        type: message.type,
        username,
        token,
        forceRefresh: Boolean(payload.forceRefresh)
      });

      try {
        const data = await withSharedPromise(gitHubDashboardRequests, requestKey, () =>
          loadGitHubDashboardData(payload)
        );
        sendResponse({ success: true, data });
      } catch (error) {
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to load GitHub dashboard'
        });
      }

      return;
    }

    if (message.type === 'POLL_GITHUB_ACTIVITY') {
      const username = normalizeGitHubUsername(payload.username);
      const token = normalizeGitHubToken(payload.token);
      const requestKey = JSON.stringify({
        type: message.type,
        username,
        token
      });

      try {
        const result = await withSharedPromise(gitHubActivityPollRequests, requestKey, () =>
          pollGitHubNotificationActivity(payload)
        );
        sendResponse({ success: true, ...result });
      } catch (error) {
        sendResponse({
          success: false,
          hasChanges: false,
          changedNotificationIds: [],
          error: error instanceof Error ? error.message : 'Failed to poll GitHub activity'
        });
      }

      return;
    }

    if (message.type === 'FETCH_GITHUB_PULL_REQUEST_STATE') {
      const requestKey = JSON.stringify({
        type: message.type,
        owner: payload.owner,
        repo: payload.repo,
        pullNumber: payload.pullNumber,
        token: normalizeGitHubToken(payload.token)
      });

      try {
        const state = await withSharedPromise(gitHubPullRequestStateRequests, requestKey, () =>
          getGitHubPullRequestState(payload)
        );
        sendResponse({ success: true, state });
      } catch (error) {
        sendResponse({
          success: false,
          state: 'closed',
          error: error instanceof Error ? error.message : 'Failed to load GitHub pull request state'
        });
      }

      return;
    }

    if (message.type === 'FETCH_GITHUB_PULL_REQUEST_STATES') {
      const token = normalizeGitHubToken(payload.token);
      const pullRequests = Array.isArray(payload.pullRequests) ? payload.pullRequests : [];
      const requestKey = JSON.stringify({
        type: message.type,
        token,
        pullRequests: pullRequests
          .map((pullRequest) => ({
            id: String(pullRequest?.id ?? ''),
            owner: String(pullRequest?.owner ?? ''),
            repo: String(pullRequest?.repo ?? ''),
            pullNumber: Number(pullRequest?.pullNumber ?? 0)
          }))
          .sort((left, right) =>
            `${left.owner}/${left.repo}#${left.pullNumber}:${left.id}`.localeCompare(
              `${right.owner}/${right.repo}#${right.pullNumber}:${right.id}`
            )
          )
      });

      try {
        const states = await withSharedPromise(gitHubPullRequestStatesRequests, requestKey, () =>
          getGitHubPullRequestStates(payload)
        );
        sendResponse({ success: true, states });
      } catch (error) {
        sendResponse({
          success: false,
          states: {},
          error: error instanceof Error ? error.message : 'Failed to load GitHub pull request states'
        });
      }

      return;
    }

    const jiraBaseUrl = normalizeJiraBaseUrl(payload.jiraBaseUrl);
    const jiraEmail = String(payload.jiraEmail ?? '').trim();
    const jiraApiToken = String(payload.jiraApiToken ?? '').trim();

    if (!jiraBaseUrl || !jiraEmail || !jiraApiToken) {
      sendResponse({ success: false, error: 'Missing Jira credentials' });
      return;
    }

    const auth = encodeBasicAuth(jiraEmail, jiraApiToken);

    if (message.type === 'TEST_JIRA_CONNECTION') {
      try {
        const result = await fetchJira(`${jiraBaseUrl}/rest/api/3/myself`, {
          method: 'GET',
          headers: {
            Authorization: `Basic ${auth}`,
            Accept: 'application/json'
          }
        });

        if (!result.success) {
          sendResponse(result);
          return;
        }

        const data = await result.response.json();
        sendResponse({ success: true, user: data });
      } catch (error) {
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to reach Jira'
        });
      }

      return;
    }

    if (message.type === 'FETCH_JIRA_ISSUES_BY_KEYS') {
      const issueKeys = Array.isArray(payload.issueKeys) ? payload.issueKeys : [];

      try {
        const issues = await fetchJiraIssuesByKeys(jiraBaseUrl, auth, issueKeys);
        sendResponse({ success: true, issues });
      } catch (error) {
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to load Jira issues'
        });
      }

      return;
    }

    const forceRefresh = Boolean(payload.forceRefresh);
    const credentialsKey = createJiraCredentialsKey(jiraBaseUrl, jiraEmail, jiraApiToken);

    try {
      if (!forceRefresh) {
        const cachedIssues = await getCachedJiraIssues(credentialsKey);
        if (cachedIssues) {
          sendResponse({ success: true, issues: cachedIssues });
          return;
        }
      }

      const issues = await fetchJiraIssuesByJql(jiraBaseUrl, auth, JIRA_ACTIVE_ISSUES_JQL, 50);
      await saveCachedJiraIssues(credentialsKey, issues);
      sendResponse({ success: true, issues });
    } catch (error) {
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load Jira issues'
      });
    }
  })();

  return true;
});
