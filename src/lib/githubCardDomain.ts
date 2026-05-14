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
  GitHubPrWarningState,
} from './storage';

export type GitHubViewItem =
  | {
      kind: 'notification';
      key: string;
      owner: string;
      repositoryName: string;
      title: string;
      updatedAt: string;
      value: GitHubNotification;
    }
  | {
      kind: 'pull-request';
      key: string;
      owner: string;
      repositoryName: string;
      title: string;
      updatedAt: string;
      value: GitHubPullRequestItem;
    };

export function mapNotificationViewItem(
  notification: GitHubNotification,
): GitHubViewItem {
  return {
    kind: 'notification',
    key: notification.id,
    owner: getOwnerFromRepositoryName(notification.repository.full_name),
    repositoryName: notification.repository.full_name,
    title: notification.subject.title,
    updatedAt: notification.updated_at,
    value: notification,
  };
}

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

export function filterGitHubItems(
  items: GitHubViewItem[],
  organizationFilter: string,
) {
  if (organizationFilter === 'all') {
    return items;
  }

  return items.filter((item) => item.owner === organizationFilter);
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
  notifications: GitHubNotification[];
  myOpenPullRequests: GitHubPullRequestItem[];
  reviewRequestedPullRequests: GitHubPullRequestItem[];
}) {
  const {
    activeGitHubView,
    data,
    notifications,
    myOpenPullRequests,
    reviewRequestedPullRequests,
  } = options;

  if (activeGitHubView === 'notifications') {
    return {
      count: notifications.length,
      countLabel: `${notifications.length} notifications`,
      itemLabel: 'notifications',
      emptyMessage:
        data.connectionStatus === 'connected'
          ? 'No notifications right now.'
          : getEmptyListMessage(data),
      items: notifications.map(mapNotificationViewItem),
    };
  }

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

export function shouldDisplayNotification(notification: GitHubNotification) {
  return notification.subject.type === 'PullRequest';
}

export function getNotificationTypeLabel(notification: GitHubNotification) {
  if (notification.reason === 'review_requested') {
    return 'Review requested';
  }

  return formatReason(notification.reason);
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

export function getNotificationIconKind(
  subjectType: string,
): 'pull-request' | 'issue' | 'commit' | 'discussion' {
  if (subjectType === 'Issue') {
    return 'issue';
  }

  if (subjectType === 'Commit') {
    return 'commit';
  }

  if (subjectType === 'Discussion') {
    return 'discussion';
  }

  return 'pull-request';
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

export function getNotificationUrl(notification: GitHubNotification) {
  if (notification.subject.url) {
    const apiPath = notification.subject.url.replace(
      'https://api.github.com/repos/',
      '',
    );
    const [owner, repo, resource, id] = apiPath.split('/');

    if (resource === 'pulls') {
      return `https://github.com/${owner}/${repo}/pull/${id}`;
    }

    if (resource === 'issues') {
      return `https://github.com/${owner}/${repo}/issues/${id}`;
    }
  }

  return `https://github.com/${notification.repository.full_name}`;
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

function formatReason(reason: string) {
  return reason.replace(/-/g, ' ');
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
