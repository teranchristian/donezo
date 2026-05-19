import type {
  GitHubConnectionStatus,
  GitHubDashboardData,
  GitHubNotification,
  GitHubPullRequestItem,
} from './githubApi';
import { mapGitHubPullRequestToFocusItem } from './focusMapping';
import {
  getGitHubPullRequestAttentionStateKey,
  getGitHubPullRequestWarningStateKey,
  isGitHubPrReadyHighlighted,
  isPullRequestOutOfDate,
  isPullRequestReadyToMerge,
} from './githubDomain';
import type {
  ActiveGitHubView,
  GitHubListSort,
  GitHubPrNotificationSeenAtState,
  GitHubPrReadyState,
  GitHubPrStatusFilter,
  GitHubTeamPrTrackerState,
  GitHubPrWarningState,
} from './storage';

export type GitHubViewItem =
  {
    kind: 'pull-request';
    key: string;
    owner: string;
    repositoryName: string;
    title: string;
    updatedAt: string;
    value: GitHubPullRequestItem;
  };

export function mapPullRequestViewItem(
  pullRequest: GitHubPullRequestItem,
): GitHubViewItem {
  return {
    kind: 'pull-request',
    key: pullRequest.url,
    owner: getOwnerFromRepositoryName(pullRequest.repositoryName),
    repositoryName: pullRequest.repositoryName,
    title: pullRequest.title,
    updatedAt: pullRequest.updatedAt,
    value: pullRequest,
  };
}

export function mapPullRequestToFocusItem(
  pullRequest: GitHubPullRequestItem,
) {
  return mapGitHubPullRequestToFocusItem(pullRequest);
}

export function getOwnerFromRepositoryName(repositoryName: string) {
  return repositoryName.split('/')[0] ?? '';
}

export function getRepositoryLabel(repositoryName: string) {
  const segments = repositoryName.split('/');
  return segments[segments.length - 1] ?? repositoryName;
}

export function filterGitHubPullRequests(
  pullRequests: GitHubPullRequestItem[],
  organizationFilter: string,
  prStatusFilter: GitHubPrStatusFilter = 'all',
) {
  const organizationFilteredPullRequests =
    organizationFilter === 'all'
      ? pullRequests
      : pullRequests.filter(
          (pullRequest) => pullRequest.owner === organizationFilter,
        );

  if (prStatusFilter === 'approved') {
    return organizationFilteredPullRequests.filter(
      (pullRequest) => pullRequest.reviewStatus === 'approved',
    );
  }

  if (prStatusFilter === 'ready-to-merge') {
    return organizationFilteredPullRequests.filter((pullRequest) =>
      isPullRequestReadyToMerge(pullRequest),
    );
  }

  if (prStatusFilter === 'waiting-review') {
    return organizationFilteredPullRequests.filter(
      (pullRequest) =>
        pullRequest.reviewStatus === 'waiting-review' ||
        pullRequest.reviewStatus === 'changes-requested',
    );
  }

  return organizationFilteredPullRequests;
}

export function sortGitHubItems(
  items: GitHubViewItem[],
  sortOrder: GitHubListSort,
) {
  const sortedItems = [...items];

  sortedItems.sort((left, right) => {
    if (sortOrder === 'oldest-updated') {
      return (
        new Date(left.updatedAt).getTime() - new Date(right.updatedAt).getTime()
      );
    }

    if (sortOrder === 'repository-asc') {
      return left.repositoryName.localeCompare(right.repositoryName);
    }

    if (sortOrder === 'title-asc') {
      return left.title.localeCompare(right.title);
    }

    return (
      new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
    );
  });

  return sortedItems;
}

export function getGitHubViewContent(options: {
  activeGitHubView: ActiveGitHubView;
  data: GitHubDashboardData;
  myOpenPullRequests: GitHubPullRequestItem[];
  recentOpenPullRequests: GitHubPullRequestItem[];
  reviewRequestedPullRequests: GitHubPullRequestItem[];
}) {
  const {
    activeGitHubView,
    data,
    myOpenPullRequests,
    recentOpenPullRequests,
    reviewRequestedPullRequests,
  } = options;

  if (activeGitHubView === 'review') {
    return {
      count: data.reviewRequestedCount,
      countLabel: `${data.reviewRequestedCount} review requests`,
      itemLabel: 'PRs',
      emptyMessage:
        data.connectionStatus === 'connected'
          ? 'No pull requests need your review.'
          : getEmptyListMessage(data),
      items: reviewRequestedPullRequests.map(mapPullRequestViewItem),
    };
  }

  if (activeGitHubView === 'team-prs') {
    return {
      count: data.recentOpenPrsCount,
      countLabel: `${data.recentOpenPrsCount} open PRs`,
      itemLabel: 'PRs',
      emptyMessage:
        data.connectionStatus === 'connected'
          ? 'No open pull requests created in the last 24 hours.'
          : getEmptyListMessage(data),
      items: recentOpenPullRequests.map(mapPullRequestViewItem),
    };
  }

  return {
    count: data.openPrsCount,
    countLabel: `${data.openPrsCount} open PRs`,
    itemLabel: 'PRs',
    emptyMessage: getEmptyListMessage(data),
    items: myOpenPullRequests.map(mapPullRequestViewItem),
  };
}

export function getNoFilterResultsMessage(itemLabel: string) {
  return `No ${itemLabel} match the current filters.`;
}

export function buildRecentOpenPullRequestsQuery(ownerFilter: string) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const normalizedOwnerFilter = ownerFilter.trim();
  const ownerScope =
    normalizedOwnerFilter && normalizedOwnerFilter !== 'all'
      ? ` user:${normalizedOwnerFilter}`
      : '';

  return `is:pr is:open draft:false created:>=${since}${ownerScope}`;
}

export function shouldDisplayNotification(notification: GitHubNotification) {
  return notification.subject.type === 'PullRequest';
}

export function getPullRequestNewNotificationCountByKey(
  notifications: GitHubNotification[],
  gitHubPrNotificationSeenAtState: GitHubPrNotificationSeenAtState,
) {
  return notifications.reduce<Record<string, number>>((counts, notification) => {
    const identity = getPullRequestIdentityFromNotification(notification);
    if (!identity) {
      return counts;
    }

    const key = getPullRequestIdentityKey(identity);
    const seenAt = gitHubPrNotificationSeenAtState[key];
    const updatedAt = Date.parse(notification.updated_at);
    const isNew =
      typeof seenAt !== 'number' ||
      (Number.isFinite(updatedAt) && updatedAt > seenAt);

    if (isNew) {
      counts[key] = (counts[key] ?? 0) + 1;
    }

    return counts;
  }, {});
}

export function getPullRequestNewCommentCountByKey(
  notifications: GitHubNotification[],
  gitHubPrNotificationSeenAtState: GitHubPrNotificationSeenAtState,
) {
  return getPullRequestNewNotificationCountByKey(
    notifications.filter((notification) => notification.reason === 'comment'),
    gitHubPrNotificationSeenAtState,
  );
}

export function getPullRequestIdentityFromNotification(
  notification: GitHubNotification,
) {
  if (!notification.subject.url) {
    return null;
  }

  const apiPath = notification.subject.url.replace(
    'https://api.github.com/repos/',
    '',
  );
  const [owner, repo, resource, pullNumber] = apiPath.split('/');

  if (resource !== 'pulls' || !owner || !repo || !pullNumber) {
    return null;
  }

  return {
    owner,
    repo,
    pullNumber: Number(pullNumber),
  };
}

export function calculateGitHubSummaryCounts(options: {
  resolvedPullRequests: GitHubPullRequestItem[];
  myOpenPullRequests: GitHubPullRequestItem[];
  ownerFilteredMyOpenPullRequests: GitHubPullRequestItem[];
  ownerFilteredReviewRequestedPullRequests: GitHubPullRequestItem[];
  notifications: GitHubNotification[];
  notificationSeenAtState: GitHubPrNotificationSeenAtState;
  readyState: GitHubPrReadyState;
  warningState: GitHubPrWarningState;
}) {
  const {
    resolvedPullRequests,
    myOpenPullRequests,
    ownerFilteredMyOpenPullRequests,
    ownerFilteredReviewRequestedPullRequests,
    notifications,
    notificationSeenAtState,
    readyState,
    warningState,
  } = options;

  const pullRequestNewCommentCountByKey = getPullRequestNewCommentCountByKey(
    notifications,
    notificationSeenAtState,
  );
  const highlightedReadyCount = resolvedPullRequests.filter((pullRequest) =>
    isGitHubPrReadyHighlighted(readyState, pullRequest),
  ).length;
  const readyToMergeCount = resolvedPullRequests.filter((pullRequest) =>
    isPullRequestReadyToMerge(pullRequest),
  ).length;
  const failedBuildCount = resolvedPullRequests.filter(
    (pullRequest) => pullRequest.ciStatus === 'failing',
  ).length;
  const failedBuildBadgeCount = resolvedPullRequests.filter(
    (pullRequest) =>
      pullRequest.ciStatus === 'failing' &&
      Boolean(
        warningState[getGitHubPullRequestWarningStateKey(pullRequest)]?.highlighted,
      ),
  ).length;
  const highlightedCommentCount = myOpenPullRequests.reduce(
    (count, pullRequest) =>
      count +
      (pullRequestNewCommentCountByKey[
        getGitHubPullRequestAttentionStateKey(pullRequest)
      ] ?? 0),
    0,
  );
  const highlightedWarningCount = resolvedPullRequests.filter((pullRequest) => {
    const warningEntry =
      warningState[getGitHubPullRequestWarningStateKey(pullRequest)];
    if (!warningEntry?.highlighted) {
      return false;
    }

    return warningEntry.activeCaseKeys.some(
      (caseKey) => caseKey !== 'failed-checks',
    );
  }).length;
  const approvedPrCount = ownerFilteredMyOpenPullRequests.filter(
    (pullRequest) =>
      pullRequest.reviewStatus === 'approved' &&
      !isPullRequestOutOfDate(pullRequest),
  ).length;
  const reviewRequestedCount = ownerFilteredReviewRequestedPullRequests.length;
  const relevantPrCount =
    ownerFilteredMyOpenPullRequests.length + reviewRequestedCount;

  return {
    readyToMergeCount,
    failedBuildCount,
    failedBuildBadgeCount,
    highlightedCommentCount,
    highlightedReadyCount,
    highlightedWarningCount,
    reviewRequestedCount,
    approvedPrCount,
    relevantPrCount,
    pullRequestNewCommentCountByKey,
  };
}

export function getNextGitHubTeamPrTrackerState(options: {
  currentState: GitHubTeamPrTrackerState;
  visibleRecentOpenPullRequests: GitHubPullRequestItem[];
  lastUpdatedAt: number | null;
}) {
  const { currentState, visibleRecentOpenPullRequests, lastUpdatedAt } = options;
  const currentTeamPrKeys = visibleRecentOpenPullRequests.map((pullRequest) =>
    getGitHubPullRequestAttentionStateKey(pullRequest),
  );
  const currentTeamPrKeySet = new Set(currentTeamPrKeys);
  const refreshUpdatedAt =
    typeof lastUpdatedAt === 'number' && Number.isFinite(lastUpdatedAt)
      ? lastUpdatedAt
      : null;
  const existingPendingNewKeys = currentState.pendingNewKeys.filter((key) =>
    currentTeamPrKeySet.has(key),
  );

  if (refreshUpdatedAt === null) {
    if (
      arraysEqual(currentState.snapshotKeys, currentTeamPrKeys) &&
      arraysEqual(currentState.pendingNewKeys, existingPendingNewKeys)
    ) {
      return currentState;
    }

    return {
      ...currentState,
      snapshotKeys: currentTeamPrKeys,
      pendingNewKeys: existingPendingNewKeys,
    };
  }

  if (currentState.lastProcessedUpdatedAt === refreshUpdatedAt) {
    if (
      arraysEqual(currentState.snapshotKeys, currentTeamPrKeys) &&
      arraysEqual(currentState.pendingNewKeys, existingPendingNewKeys)
    ) {
      return currentState;
    }

    return {
      ...currentState,
      snapshotKeys: currentTeamPrKeys,
      pendingNewKeys: existingPendingNewKeys,
    };
  }

  const hasExistingSnapshot = currentState.snapshotKeys.length > 0;
  const currentSnapshotKeySet = new Set(currentState.snapshotKeys);
  const newlyDiscoveredKeys = hasExistingSnapshot
    ? currentTeamPrKeys.filter((key) => !currentSnapshotKeySet.has(key))
    : [];
  const nextPendingNewKeys = [
    ...new Set([...existingPendingNewKeys, ...newlyDiscoveredKeys]),
  ];

  if (
    arraysEqual(currentState.snapshotKeys, currentTeamPrKeys) &&
    arraysEqual(currentState.pendingNewKeys, nextPendingNewKeys) &&
    currentState.lastProcessedUpdatedAt === refreshUpdatedAt
  ) {
    return currentState;
  }

  return {
    snapshotKeys: currentTeamPrKeys,
    pendingNewKeys: nextPendingNewKeys,
    lastProcessedUpdatedAt: refreshUpdatedAt,
  };
}

export function arraysEqual(left: string[], right: string[]) {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

export function areGitHubPrReadyStatesEqual(
  left: GitHubPrReadyState,
  right: GitHubPrReadyState,
) {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);

  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  for (const key of leftKeys) {
    const leftEntry = left[key];
    const rightEntry = right[key];

    if (
      !rightEntry ||
      leftEntry.isReady !== rightEntry.isReady ||
      leftEntry.highlighted !== rightEntry.highlighted
    ) {
      return false;
    }
  }

  return true;
}

export function areGitHubPrReadyStatesExactlyEqual(
  left: GitHubPrReadyState,
  right: GitHubPrReadyState,
) {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);

  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  for (const key of leftKeys) {
    const leftEntry = left[key];
    const rightEntry = right[key];

    if (
      !rightEntry ||
      leftEntry.isReady !== rightEntry.isReady ||
      leftEntry.highlighted !== rightEntry.highlighted ||
      leftEntry.updatedAt !== rightEntry.updatedAt
    ) {
      return false;
    }
  }

  return true;
}

export function areGitHubPrWarningStatesEqual(
  left: GitHubPrWarningState,
  right: GitHubPrWarningState,
) {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);

  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  for (const key of leftKeys) {
    const leftEntry = left[key];
    const rightEntry = right[key];

    if (!rightEntry || leftEntry.highlighted !== rightEntry.highlighted) {
      return false;
    }

    if (leftEntry.activeCaseKeys.length !== rightEntry.activeCaseKeys.length) {
      return false;
    }

    for (let index = 0; index < leftEntry.activeCaseKeys.length; index += 1) {
      if (
        leftEntry.activeCaseKeys[index] !== rightEntry.activeCaseKeys[index]
      ) {
        return false;
      }
    }
  }

  return true;
}

export function areGitHubPrWarningStatesExactlyEqual(
  left: GitHubPrWarningState,
  right: GitHubPrWarningState,
) {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);

  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  for (const key of leftKeys) {
    const leftEntry = left[key];
    const rightEntry = right[key];

    if (
      !rightEntry ||
      leftEntry.highlighted !== rightEntry.highlighted ||
      leftEntry.updatedAt !== rightEntry.updatedAt ||
      !arraysEqual(leftEntry.activeCaseKeys, rightEntry.activeCaseKeys)
    ) {
      return false;
    }
  }

  return true;
}

export function areGitHubPrNotificationSeenAtStatesEqual(
  left: GitHubPrNotificationSeenAtState,
  right: GitHubPrNotificationSeenAtState,
) {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);

  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  return leftKeys.every((key) => left[key] === right[key]);
}

export function areGitHubTeamPrTrackerStatesEqual(
  left: GitHubTeamPrTrackerState,
  right: GitHubTeamPrTrackerState,
) {
  return (
    arraysEqual(left.snapshotKeys, right.snapshotKeys) &&
    arraysEqual(left.pendingNewKeys, right.pendingNewKeys) &&
    left.lastProcessedUpdatedAt === right.lastProcessedUpdatedAt
  );
}

function getPullRequestIdentityKey(pullRequestIdentity: {
  owner: string;
  repo: string;
  pullNumber: number;
}) {
  return `${pullRequestIdentity.owner}/${pullRequestIdentity.repo}#${pullRequestIdentity.pullNumber}`;
}

function getEmptyListMessage(data: GitHubDashboardData) {
  if (data.connectionStatus === 'not-connected') {
    return 'Connect GitHub to load pull requests.';
  }

  if (data.connectionStatus === 'invalid') {
    return 'Update the saved token in Settings, then refresh.';
  }

  if (data.missingUsername) {
    return 'Add your GitHub username in Settings to load your pull requests.';
  }

  if (data.connectionStatus === 'error') {
    return 'GitHub data is temporarily unavailable.';
  }

  return 'No open pull requests or review requests right now.';
}

export function getGitHubConnectionCopy(
  connectionStatus: GitHubConnectionStatus,
) {
  if (connectionStatus === 'not-connected') {
    return {
      label: 'Not connected',
      tone: 'bg-white/6 text-stone-300',
      message:
        'Add a personal access token in Settings to enable GitHub integration.',
    };
  }

  if (connectionStatus === 'testing') {
    return {
      label: 'Testing',
      tone: 'bg-amber-200/10 text-amber-100',
      message: 'Checking the saved GitHub credentials.',
    };
  }

  if (connectionStatus === 'connected') {
    return {
      label: 'Connected',
      tone: 'bg-emerald-200/10 text-emerald-100',
      message: 'GitHub activity is live on the dashboard.',
    };
  }

  if (connectionStatus === 'invalid') {
    return {
      label: 'Invalid token',
      tone: 'bg-rose-200/10 text-rose-100',
      message:
        'GitHub returned 401 for the saved token. Update the token and test again.',
    };
  }

  return {
    label: 'Connection error',
    tone: 'bg-amber-200/10 text-amber-100',
    message: 'GitHub data could not be loaded right now.',
  };
}
