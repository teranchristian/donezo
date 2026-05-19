import type { GitHubDashboardData } from './githubApi';
import {
  buildRecentOpenPullRequestsQuery,
  calculateGitHubSummaryCounts,
  filterGitHubPullRequests,
  getGitHubViewContent,
  getPullRequestNewCommentCountByKey,
  sortGitHubItems,
  shouldDisplayNotification,
} from './githubCardDomain';
import type {
  ActiveGitHubView,
  GitHubHiddenRepository,
  GitHubListSort,
  GitHubPrNotificationSeenAtState,
  GitHubPrReadyState,
  GitHubPrStatusFilter,
  GitHubPrWarningState,
} from './storage';

export function getGitHubCardPullRequestGroups(options: {
  data: GitHubDashboardData;
  username: string;
  ownerFilter: string;
  hiddenRepositories: GitHubHiddenRepository[];
  isMockMode: boolean;
}) {
  const { data, username, ownerFilter, hiddenRepositories, isMockMode } =
    options;
  const organizationFilter = isMockMode ? 'all' : ownerFilter.trim() || 'all';
  const resolvedPullRequests = data.pullRequests;
  const myOpenPullRequests = resolvedPullRequests.filter(
    (pullRequest) => pullRequest.source === 'authored',
  );
  const reviewRequestedPullRequests = resolvedPullRequests.filter(
    (pullRequest) => pullRequest.source === 'review-requested',
  );
  const recentOpenPullRequests = data.recentPullRequests ?? [];
  const normalizedUsername = username.trim().toLowerCase();
  const hiddenRepositoryFullNames = new Set(
    hiddenRepositories.map((repository) => repository.fullName),
  );
  const ownerFilteredMyOpenPullRequests = filterGitHubPullRequests(
    myOpenPullRequests,
    organizationFilter,
  );
  const ownerFilteredReviewRequestedPullRequests = filterGitHubPullRequests(
    reviewRequestedPullRequests,
    organizationFilter,
  );
  const ownerFilteredRecentOpenPullRequests = filterGitHubPullRequests(
    recentOpenPullRequests,
    organizationFilter,
  );
  const nonAuthoredRecentOpenPullRequests =
    ownerFilteredRecentOpenPullRequests.filter(
      (pullRequest) =>
        !normalizedUsername ||
        pullRequest.authorLogin.trim().toLowerCase() !== normalizedUsername,
    );
  const visibleRecentOpenPullRequests =
    nonAuthoredRecentOpenPullRequests.filter(
      (pullRequest) =>
        !hiddenRepositoryFullNames.has(pullRequest.repositoryName),
    );
  const recentViewQuery = buildRecentOpenPullRequestsQuery(ownerFilter);

  return {
    organizationFilter,
    resolvedPullRequests,
    myOpenPullRequests,
    reviewRequestedPullRequests,
    recentOpenPullRequests,
    ownerFilteredMyOpenPullRequests,
    ownerFilteredReviewRequestedPullRequests,
    visibleRecentOpenPullRequests,
    myPrsViewAllUrl: `https://github.com/pulls?q=${encodeURIComponent(
      `is:pr is:open author:${username.trim()}`,
    )}`,
    recentPrsViewAllUrl: `https://github.com/pulls?q=${encodeURIComponent(
      recentViewQuery,
    )}`,
  };
}

export function getGitHubCardViewModel(options: {
  data: GitHubDashboardData;
  groups: ReturnType<typeof getGitHubCardPullRequestGroups>;
  activeView: ActiveGitHubView;
  prStatusFilter: GitHubPrStatusFilter;
  sortOrder: GitHubListSort;
  hasLoadedNotificationSeenAtState: boolean;
  notificationSeenAtState: GitHubPrNotificationSeenAtState;
  readyState: GitHubPrReadyState;
  warningState: GitHubPrWarningState;
}) {
  const {
    data,
    groups,
    activeView,
    prStatusFilter,
    sortOrder,
    hasLoadedNotificationSeenAtState,
    notificationSeenAtState,
    readyState,
    warningState,
  } = options;
  const notifications = (data.notifications ?? []).filter(
    shouldDisplayNotification,
  );
  const pullRequestNewCommentCountByKey = hasLoadedNotificationSeenAtState
    ? getPullRequestNewCommentCountByKey(notifications, notificationSeenAtState)
    : {};
  const filteredMyOpenPullRequests = filterGitHubPullRequests(
    groups.myOpenPullRequests,
    groups.organizationFilter,
    prStatusFilter,
  );
  const filteredReviewRequestedPullRequests =
    groups.ownerFilteredReviewRequestedPullRequests;
  const filteredRecentOpenPullRequests = groups.visibleRecentOpenPullRequests;
  const summaryCounts = calculateGitHubSummaryCounts({
    resolvedPullRequests: groups.resolvedPullRequests,
    myOpenPullRequests: groups.myOpenPullRequests,
    ownerFilteredMyOpenPullRequests: groups.ownerFilteredMyOpenPullRequests,
    ownerFilteredReviewRequestedPullRequests:
      groups.ownerFilteredReviewRequestedPullRequests,
    notifications: hasLoadedNotificationSeenAtState ? notifications : [],
    notificationSeenAtState,
    readyState,
    warningState,
  });
  const currentView = getGitHubViewContent({
    activeGitHubView: activeView,
    data,
    myOpenPullRequests: filteredMyOpenPullRequests,
    recentOpenPullRequests: filteredRecentOpenPullRequests,
    reviewRequestedPullRequests: filteredReviewRequestedPullRequests,
  });

  return {
    pullRequestNewCommentCountByKey,
    filteredMyOpenPullRequests,
    filteredReviewRequestedPullRequests,
    filteredRecentOpenPullRequests,
    filteredMyOpenPullRequestCount: filteredMyOpenPullRequests.length,
    filteredReviewRequestedPullRequestCount:
      filteredReviewRequestedPullRequests.length,
    filteredRecentOpenPullRequestCount: filteredRecentOpenPullRequests.length,
    summaryCounts,
    currentView,
    filteredItems: sortGitHubItems(currentView.items, sortOrder),
  };
}
