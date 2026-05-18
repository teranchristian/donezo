import { type KeyboardEvent, type MouseEvent, ReactNode, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  GitHubConnectionStatus,
  GitHubDashboardData,
  GitHubPullRequestItem,
} from '../lib/githubApi';
import {
  calculateGitHubSummaryCounts,
  filterGitHubPullRequests,
  getGitHubViewContent,
  getNoFilterResultsMessage,
  getPullRequestNewCommentCountByKey,
  getRepositoryLabel,
  mapPullRequestToFocusItem,
  sortGitHubItems,
  shouldDisplayNotification,
} from '../lib/githubCardDomain';
import { formatRelativeTime } from '../lib/date';
import {
  buildGitHubPrReadyState,
  buildGitHubPrWarningState,
  getGitHubPullRequestAttentionStateKey,
  getGitHubPullRequestWarningStateKey,
  getPullRequestDisplayStatus,
  isGitHubPrReadyHighlighted,
  isGitHubPrWarningHighlighted,
  isPullRequestOutOfDate,
  isPullRequestQueued,
  isPullRequestReadyToMerge,
} from '../lib/githubDomain';
import {
  getStoredGitHubPrNotificationSeenAtState,
  getStoredGitHubPrReadyState,
  getStoredGitHubTeamPrTrackerState,
  getStoredGitHubPrWarningState,
  getStoredGitHubSortOrder,
  saveStoredGitHubPrNotificationSeenAtState,
  saveStoredGitHubPrReadyState,
  saveStoredGitHubTeamPrTrackerState,
  saveStoredGitHubPrWarningState,
  saveStoredGitHubSortOrder,
  type ActiveGitHubView,
  type GitHubHiddenRepository,
  type GitHubPrReadyState,
  type GitHubPrNotificationSeenAtState,
  type GitHubTeamPrTrackerState,
  type GitHubPrWarningState,
  type GitHubPrStatusFilter,
  type GitHubListSort,
} from '../lib/storage';
import { CardTabMenu } from './CardTabMenu';
import { CardShell } from './CardShell';
import { StatusBadge } from './StatusBadge';
import { TODAY_FOCUS_DRAG_MIME } from './SummaryCard';
import { TodayFocusIndicator } from './TodayFocusIndicator';

type GitHubCardProps = {
  topBar?: ReactNode;
  data: GitHubDashboardData;
  todayFocusItemIds: Set<string>;
  username: string;
  ownerFilter: string;
  hiddenRepositories: GitHubHiddenRepository[];
  isMockMode?: boolean;
  isLoading: boolean;
  onSummaryMetricsChange: (metrics: GitHubSummaryMetrics) => void;
  activeView: ActiveGitHubView;
  prStatusFilter: GitHubPrStatusFilter;
  onViewChange: (view: ActiveGitHubView) => void;
  onPrStatusFilterChange: (filter: GitHubPrStatusFilter) => void;
  onHideRepository: (repository: GitHubHiddenRepository) => Promise<void>;
};

export type GitHubSummaryMetrics = {
  connectionStatus: GitHubConnectionStatus;
  missingUsername: boolean;
  openTeamPrCount: number;
  readyToMergeCount: number;
  failedBuildCount: number;
  failedBuildBadgeCount: number;
  highlightedCommentCount: number;
  highlightedReadyCount: number;
  highlightedWarningCount: number;
  reviewRequestedCount: number;
  approvedPrCount: number | null;
  relevantPrCount: number;
};

export function GitHubCard({
  topBar,
  data,
  todayFocusItemIds,
  username,
  ownerFilter,
  hiddenRepositories,
  isMockMode = false,
  isLoading,
  onSummaryMetricsChange,
  activeView,
  prStatusFilter,
  onViewChange,
  onPrStatusFilterChange,
  onHideRepository,
}: GitHubCardProps) {
  const filterControlClass =
    'flex h-9 min-w-0 items-center gap-1.5 rounded-[10px] border border-white/[0.035] bg-white/[0.025] px-2.5 text-[0.8rem] text-white/40 transition hover:bg-white/[0.04] hover:text-white/54';
  const filterSelectClass =
    'min-w-0 bg-transparent pr-5 text-[0.8rem] font-medium text-white/76 outline-none';
  const [sortOrder, setSortOrder] =
    useState<GitHubListSort>('recently-updated');
  const [hasLoadedSortOrder, setHasLoadedSortOrder] = useState(false);
  const [gitHubPrReadyState, setGitHubPrReadyState] =
    useState<GitHubPrReadyState>({});
  const [hasLoadedGitHubPrReadyState, setHasLoadedGitHubPrReadyState] =
    useState(false);
  const [gitHubPrWarningState, setGitHubPrWarningState] =
    useState<GitHubPrWarningState>({});
  const [hasLoadedGitHubPrWarningState, setHasLoadedGitHubPrWarningState] =
    useState(false);
  const [gitHubPrNotificationSeenAtState, setGitHubPrNotificationSeenAtState] =
    useState<GitHubPrNotificationSeenAtState>({});
  const [
    hasLoadedGitHubPrNotificationSeenAtState,
    setHasLoadedGitHubPrNotificationSeenAtState,
  ] = useState(false);
  const [gitHubTeamPrTrackerState, setGitHubTeamPrTrackerState] =
    useState<GitHubTeamPrTrackerState>({
      snapshotKeys: [],
      pendingNewKeys: [],
      lastProcessedUpdatedAt: null,
    });
  const [hasLoadedGitHubTeamPrTrackerState, setHasLoadedGitHubTeamPrTrackerState] =
    useState(false);
  const organizationFilter = isMockMode ? 'all' : ownerFilter.trim() || 'all';
  const resolvedPullRequests = data.pullRequests;
  const myOpenPRs = resolvedPullRequests.filter(
    (pullRequest) => pullRequest.source === 'authored',
  );
  const reviewRequestedPRs = resolvedPullRequests.filter(
    (pullRequest) => pullRequest.source === 'review-requested',
  );
  const recentOpenPRs = data.recentPullRequests ?? [];
  const notifications = (data.notifications ?? []).filter(
    shouldDisplayNotification,
  );
  const pullRequestNewCommentCountByKey =
    hasLoadedGitHubPrNotificationSeenAtState
      ? getPullRequestNewCommentCountByKey(
          notifications,
          gitHubPrNotificationSeenAtState,
        )
      : {};
  const recentViewQuery = buildRecentOpenPullRequestsQuery(ownerFilter);
  const myPrsViewAllUrl = `https://github.com/pulls?q=${encodeURIComponent(`is:pr is:open author:${username.trim()}`)}`;
  const recentPrsViewAllUrl = `https://github.com/pulls?q=${encodeURIComponent(recentViewQuery)}`;
  const hiddenRepositoryFullNames = new Set(
    hiddenRepositories.map((repository) => repository.fullName),
  );
  const ownerFilteredMyOpenPRs = filterGitHubPullRequests(
    myOpenPRs,
    organizationFilter,
  );
  const ownerFilteredReviewRequestedPRs = filterGitHubPullRequests(
    reviewRequestedPRs,
    organizationFilter,
  );
  const ownerFilteredRecentOpenPRs = filterGitHubPullRequests(
    recentOpenPRs,
    organizationFilter,
  );
  const visibleRecentOpenPRs = ownerFilteredRecentOpenPRs.filter(
    (pullRequest) => !hiddenRepositoryFullNames.has(pullRequest.repositoryName),
  );
  const filteredMyOpenPRs = filterGitHubPullRequests(
    myOpenPRs,
    organizationFilter,
    prStatusFilter,
  );
  const filteredReviewRequestedPRs = ownerFilteredReviewRequestedPRs;
  const filteredRecentOpenPRs = visibleRecentOpenPRs;
  const filteredMyOpenPrCount = filteredMyOpenPRs.length;
  const filteredRecentOpenPrCount = filteredRecentOpenPRs.length;
  const filteredReviewRequestedCount = filteredReviewRequestedPRs.length;
  const summaryCounts = calculateGitHubSummaryCounts({
    resolvedPullRequests,
    myOpenPullRequests: myOpenPRs,
    ownerFilteredMyOpenPullRequests: ownerFilteredMyOpenPRs,
    ownerFilteredReviewRequestedPullRequests: ownerFilteredReviewRequestedPRs,
    notifications: hasLoadedGitHubPrNotificationSeenAtState ? notifications : [],
    notificationSeenAtState: gitHubPrNotificationSeenAtState,
    readyState: gitHubPrReadyState,
    warningState: gitHubPrWarningState,
  });
  const currentView = getGitHubViewContent({
    activeGitHubView: activeView,
    data,
    myOpenPullRequests: filteredMyOpenPRs,
    recentOpenPullRequests: filteredRecentOpenPRs,
    reviewRequestedPullRequests: filteredReviewRequestedPRs,
  });
  const filteredItems = sortGitHubItems(currentView.items, sortOrder);
  const tabItems = [
    {
      key: 'my-prs',
      label: 'My PRs',
      value: formatCount(filteredMyOpenPrCount, isLoading),
      isActive: activeView === 'my-prs',
      title: isLoading
        ? undefined
        : `${filteredMyOpenPrCount} of ${myOpenPRs.length} PRs`,
      onClick: () => onViewChange('my-prs'),
    },
    {
      key: 'team-prs',
      label: 'Team PRs',
      value: formatCount(filteredRecentOpenPrCount, isLoading),
      isActive: activeView === 'team-prs',
      title: isLoading
        ? undefined
        : `${filteredRecentOpenPrCount} of ${recentOpenPRs.length} PRs`,
      onClick: () => onViewChange('team-prs'),
    },
    {
      key: 'review',
      label: 'Review',
      value: formatCount(filteredReviewRequestedCount, isLoading),
      isActive: activeView === 'review',
      onClick: () => onViewChange('review'),
    },
  ];

  useEffect(() => {
    let isMounted = true;

    getStoredGitHubSortOrder().then((storedSortOrder) => {
      if (!isMounted) {
        return;
      }

      setSortOrder(storedSortOrder);
      setHasLoadedSortOrder(true);
    });

    getStoredGitHubPrReadyState().then((storedReadyState) => {
      if (!isMounted) {
        return;
      }

      setGitHubPrReadyState(storedReadyState);
      setHasLoadedGitHubPrReadyState(true);
    });

    getStoredGitHubPrWarningState().then((storedWarningState) => {
      if (!isMounted) {
        return;
      }

      setGitHubPrWarningState(storedWarningState);
      setHasLoadedGitHubPrWarningState(true);
    });

    getStoredGitHubPrNotificationSeenAtState().then((storedSeenAtState) => {
      if (!isMounted) {
        return;
      }

      setGitHubPrNotificationSeenAtState(storedSeenAtState);
      setHasLoadedGitHubPrNotificationSeenAtState(true);
    });

    getStoredGitHubTeamPrTrackerState().then((storedTrackerState) => {
      if (!isMounted) {
        return;
      }

      setGitHubTeamPrTrackerState(storedTrackerState);
      setHasLoadedGitHubTeamPrTrackerState(true);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!hasLoadedSortOrder) {
      return;
    }

    void saveStoredGitHubSortOrder(sortOrder);
  }, [hasLoadedSortOrder, sortOrder]);

  useEffect(() => {
    if (!hasLoadedGitHubPrReadyState) {
      return;
    }

    void saveStoredGitHubPrReadyState(gitHubPrReadyState);
  }, [gitHubPrReadyState, hasLoadedGitHubPrReadyState]);

  useEffect(() => {
    if (!hasLoadedGitHubPrWarningState) {
      return;
    }

    void saveStoredGitHubPrWarningState(gitHubPrWarningState);
  }, [gitHubPrWarningState, hasLoadedGitHubPrWarningState]);

  useEffect(() => {
    if (!hasLoadedGitHubPrNotificationSeenAtState) {
      return;
    }

    void saveStoredGitHubPrNotificationSeenAtState(
      gitHubPrNotificationSeenAtState,
    );
  }, [
    gitHubPrNotificationSeenAtState,
    hasLoadedGitHubPrNotificationSeenAtState,
  ]);

  useEffect(() => {
    if (!hasLoadedGitHubTeamPrTrackerState) {
      return;
    }

    void saveStoredGitHubTeamPrTrackerState(gitHubTeamPrTrackerState);
  }, [gitHubTeamPrTrackerState, hasLoadedGitHubTeamPrTrackerState]);

  useEffect(() => {
    if (!hasLoadedGitHubPrReadyState) {
      return;
    }

    setGitHubPrReadyState((currentState) => {
      const nextState = buildGitHubPrReadyState(
        currentState,
        resolvedPullRequests,
      );
      return areGitHubPrReadyStatesEqual(currentState, nextState)
        ? currentState
        : nextState;
    });
  }, [hasLoadedGitHubPrReadyState, resolvedPullRequests]);

  useEffect(() => {
    if (!hasLoadedGitHubPrWarningState) {
      return;
    }

    setGitHubPrWarningState((currentState) => {
      const nextState = buildGitHubPrWarningState(
        currentState,
        resolvedPullRequests,
      );
      return areGitHubPrWarningStatesEqual(currentState, nextState)
        ? currentState
        : nextState;
    });
  }, [hasLoadedGitHubPrWarningState, resolvedPullRequests]);

  useEffect(() => {
    if (
      !hasLoadedGitHubPrNotificationSeenAtState ||
      data.connectionStatus !== 'connected' ||
      isLoading
    ) {
      return;
    }

    const activePullRequestKeys = new Set(
      [...resolvedPullRequests, ...visibleRecentOpenPRs].map((pullRequest) =>
        getGitHubPullRequestAttentionStateKey(pullRequest),
      ),
    );

    setGitHubPrNotificationSeenAtState((currentState) => {
      const nextState = Object.fromEntries(
        Object.entries(currentState).filter(([key]) =>
          activePullRequestKeys.has(key),
        ),
      );

      return Object.keys(nextState).length === Object.keys(currentState).length
        ? currentState
        : nextState;
    });
  }, [
    data.connectionStatus,
    hasLoadedGitHubPrNotificationSeenAtState,
    isLoading,
    resolvedPullRequests,
    visibleRecentOpenPRs,
  ]);

  useEffect(() => {
    if (
      !hasLoadedGitHubTeamPrTrackerState ||
      data.connectionStatus !== 'connected' ||
      isLoading
    ) {
      return;
    }

    const currentTeamPrKeys = visibleRecentOpenPRs.map((pullRequest) =>
      getGitHubPullRequestAttentionStateKey(pullRequest),
    );
    const currentTeamPrKeySet = new Set(currentTeamPrKeys);
    const refreshUpdatedAt =
      typeof data.lastUpdatedAt === 'number' && Number.isFinite(data.lastUpdatedAt)
        ? data.lastUpdatedAt
        : null;

    setGitHubTeamPrTrackerState((currentState) => {
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
      const nextPendingNewKeys = [...new Set([...existingPendingNewKeys, ...newlyDiscoveredKeys])];

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
    });
  }, [
    data.connectionStatus,
    data.lastUpdatedAt,
    hasLoadedGitHubTeamPrTrackerState,
    isLoading,
    visibleRecentOpenPRs,
  ]);

  function handleMarkPullRequestNotificationsSeen(
    pullRequest: GitHubPullRequestItem,
  ) {
    const pullRequestKey = getGitHubPullRequestAttentionStateKey(pullRequest);
    const nextSeenAt = Date.now();

    setGitHubPrNotificationSeenAtState((currentState) => {
      if (currentState[pullRequestKey] === nextSeenAt) {
        return currentState;
      }

      return {
        ...currentState,
        [pullRequestKey]: nextSeenAt,
      };
    });
  }

  function handleMarkTeamPrSeen(pullRequest: GitHubPullRequestItem) {
    const pullRequestKey = getGitHubPullRequestAttentionStateKey(pullRequest);

    setGitHubTeamPrTrackerState((currentState) => {
      if (!currentState.pendingNewKeys.includes(pullRequestKey)) {
        return currentState;
      }

      return {
        ...currentState,
        pendingNewKeys: currentState.pendingNewKeys.filter(
          (key) => key !== pullRequestKey,
        ),
      };
    });
  }

  useEffect(() => {
    onSummaryMetricsChange({
      connectionStatus: data.connectionStatus,
      missingUsername: data.missingUsername,
      openTeamPrCount: gitHubTeamPrTrackerState.pendingNewKeys.length,
      readyToMergeCount: summaryCounts.readyToMergeCount,
      failedBuildCount: summaryCounts.failedBuildCount,
      failedBuildBadgeCount: summaryCounts.failedBuildBadgeCount,
      highlightedCommentCount: summaryCounts.highlightedCommentCount,
      highlightedReadyCount: summaryCounts.highlightedReadyCount,
      highlightedWarningCount: summaryCounts.highlightedWarningCount,
      reviewRequestedCount: summaryCounts.reviewRequestedCount,
      approvedPrCount: summaryCounts.approvedPrCount,
      relevantPrCount: summaryCounts.relevantPrCount,
    });
  }, [
    data.connectionStatus,
    data.missingUsername,
    gitHubTeamPrTrackerState.pendingNewKeys.length,
    summaryCounts.readyToMergeCount,
    summaryCounts.failedBuildCount,
    summaryCounts.failedBuildBadgeCount,
    summaryCounts.highlightedCommentCount,
    summaryCounts.highlightedReadyCount,
    summaryCounts.highlightedWarningCount,
    summaryCounts.reviewRequestedCount,
    summaryCounts.approvedPrCount,
    summaryCounts.relevantPrCount,
    onSummaryMetricsChange,
  ]);

  function handleClearWarningHighlight(pullRequest: GitHubPullRequestItem) {
    const readyStateKey = getGitHubPullRequestAttentionStateKey(pullRequest);
    const warningStateKey = getGitHubPullRequestWarningStateKey(pullRequest);

    setGitHubPrReadyState((currentState) => {
      const currentEntry = currentState[readyStateKey];
      if (!currentEntry?.highlighted) {
        return currentState;
      }

      return {
        ...currentState,
        [readyStateKey]: {
          ...currentEntry,
          highlighted: false,
        },
      };
    });

    setGitHubPrWarningState((currentState) => {
      const currentEntry = currentState[warningStateKey];
      if (!currentEntry?.highlighted) {
        return currentState;
      }

      return {
        ...currentState,
        [warningStateKey]: {
          ...currentEntry,
          highlighted: false,
        },
      };
    });
  }

  return (
    <CardShell className="flex h-full w-full min-w-0 flex-1 flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col">
        {topBar ? (
          <div className="-mx-4 -mt-3.5 mb-1.5 border-b border-white/[0.035] px-4 py-2.5">
            {topBar}
          </div>
        ) : null}

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="mb-1.5 flex min-w-0 flex-col gap-2.5 border-b border-white/[0.035] pb-1.5 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0 flex-1">
              <CardTabMenu items={tabItems} className="border-b-0" />
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-2 xl:max-w-[100%] xl:justify-end">
              {activeView === 'my-prs' ? (
                <label
                  className={`${filterControlClass} min-w-[160px] flex-1 xl:w-[168px] xl:flex-none`}
                >
                  <span className="shrink-0 text-[var(--text-tertiary)]">
                    Status:
                  </span>
                  <select
                    aria-label="PR status"
                    value={prStatusFilter}
                    onChange={(event) =>
                      onPrStatusFilterChange(
                        event.target.value as GitHubPrStatusFilter,
                      )
                    }
                    className={`${filterSelectClass} flex-1`}
                  >
                    <option value="all" className="bg-panel text-stone-100">
                      All
                    </option>
                    <option
                      value="approved"
                      className="bg-panel text-stone-100"
                    >
                      Approved
                    </option>
                    <option
                      value="ready-to-merge"
                      className="bg-panel text-stone-100"
                    >
                      Ready to merge
                    </option>
                    <option
                      value="waiting-review"
                      className="bg-panel text-stone-100"
                    >
                      Waiting review
                    </option>
                  </select>
                </label>
              ) : null}

              <label
                className={`${filterControlClass} min-w-[200px] flex-1 xl:w-[220px] xl:flex-none`}
              >
                <span className="shrink-0 text-[var(--text-tertiary)]">
                  Sort:
                </span>
                <select
                  aria-label="Sort"
                  value={sortOrder}
                  onChange={(event) =>
                    setSortOrder(event.target.value as GitHubListSort)
                  }
                  className={`${filterSelectClass} flex-1`}
                >
                  <option
                    value="recently-updated"
                    className="bg-panel text-stone-100"
                  >
                    Recently updated
                  </option>
                  <option
                    value="oldest-updated"
                    className="bg-panel text-stone-100"
                  >
                    Oldest updated
                  </option>
                  <option
                    value="repository-asc"
                    className="bg-panel text-stone-100"
                  >
                    Repository A-Z
                  </option>
                  <option value="title-asc" className="bg-panel text-stone-100">
                    Title A-Z
                  </option>
                </select>
              </label>
            </div>
          </div>

          <div className="dashboard-scrollbar min-h-[280px] max-h-[420px] flex-1 overflow-x-hidden overflow-y-auto pr-1">
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, index) => (
                  <ListItemSkeleton key={index} />
                ))}
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="rounded-[14px] bg-[var(--card-bg-soft)] px-4 py-5 text-sm text-secondary shadow-[var(--shadow-card-soft)]">
                {currentView.items.length === 0
                  ? currentView.emptyMessage
                  : getNoFilterResultsMessage(currentView.itemLabel)}
              </div>
          ) : (
              <PullRequestList
                pullRequests={filteredItems.map((item) => item.value)}
                todayFocusItemIds={todayFocusItemIds}
                activeView={activeView}
                gitHubPrReadyState={gitHubPrReadyState}
                gitHubPrWarningState={gitHubPrWarningState}
                gitHubTeamPrTrackerState={gitHubTeamPrTrackerState}
                hasLoadedGitHubTeamPrTrackerState={
                  hasLoadedGitHubTeamPrTrackerState
                }
                pullRequestNewCommentCountByKey={
                  pullRequestNewCommentCountByKey
                }
            onMarkNotificationsSeen={handleMarkPullRequestNotificationsSeen}
            onMarkTeamPrSeen={handleMarkTeamPrSeen}
            onClearWarningHighlight={handleClearWarningHighlight}
            onHideRepository={onHideRepository}
          />
            )}
          </div>
          {!isLoading &&
          ((activeView === 'my-prs' &&
            data.openPrsCount > 0 &&
            username.trim()) ||
            (activeView === 'team-prs' && data.recentOpenPrsCount > 0)) ? (
            <div className="mt-3 flex items-center justify-between gap-3">
              <Link
                to="/settings#hidden-repositories"
                className="text-sm text-secondary transition hover:text-primary"
              >
                Hidden repos
              </Link>
              <a
                href={activeView === 'my-prs' ? myPrsViewAllUrl : recentPrsViewAllUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-secondary transition hover:text-primary"
              >
                View all PRs →
              </a>
            </div>
          ) : null}
        </div>
      </div>
    </CardShell>
  );
}

function buildRecentOpenPullRequestsQuery(ownerFilter: string) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const normalizedOwnerFilter = ownerFilter.trim();
  const ownerScope =
    normalizedOwnerFilter && normalizedOwnerFilter !== 'all'
      ? ` user:${normalizedOwnerFilter}`
      : '';

  return `is:pr is:open draft:false created:>=${since}${ownerScope}`;
}

function PullRequestRow({
  pullRequest,
  activeView,
  newNotificationCount,
  isNewTeamPr = false,
  isInTodayFocus,
  isReadyHighlighted = false,
  isWarningHighlighted = false,
  onMarkNotificationsSeen,
  onMarkTeamPrSeen,
  onClearWarningHighlight,
  onHideRepository,
}: {
  pullRequest: GitHubPullRequestItem;
  activeView: ActiveGitHubView;
  newNotificationCount: number;
  isNewTeamPr?: boolean;
  isInTodayFocus: boolean;
  isReadyHighlighted?: boolean;
  isWarningHighlighted?: boolean;
  onMarkNotificationsSeen?: (pullRequest: GitHubPullRequestItem) => void;
  onMarkTeamPrSeen?: (pullRequest: GitHubPullRequestItem) => void;
  onClearWarningHighlight?: (pullRequest: GitHubPullRequestItem) => void;
  onHideRepository?: (repository: GitHubHiddenRepository) => Promise<void>;
}) {
  const isOutOfDate = isPullRequestOutOfDate(pullRequest);
  const hasConflicts = pullRequest.mergeStateStatus === 'DIRTY';
  const isQueued = isPullRequestQueued(pullRequest);
  const isReadyToMerge = isPullRequestReadyToMerge(pullRequest);
  const status = getPullRequestDisplayStatus(pullRequest);
  const shouldShowAuthor =
    pullRequest.source !== 'authored' && Boolean(pullRequest.authorLogin);
  const repositoryLabel = getRepositoryLabel(pullRequest.repositoryName);

  return (
    <a
      href={pullRequest.url}
      target="_blank"
      rel="noreferrer"
      draggable
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'copy';
        event.dataTransfer.setData(
          TODAY_FOCUS_DRAG_MIME,
          JSON.stringify(mapPullRequestToFocusItem(pullRequest)),
        );
        event.dataTransfer.setData(
          'text/plain',
          `${pullRequest.repositoryName}#${pullRequest.pullNumber}`,
        );
      }}
      onClick={() => {
        onMarkNotificationsSeen?.(pullRequest);
        if (activeView === 'team-prs') {
          onMarkTeamPrSeen?.(pullRequest);
        }
        onClearWarningHighlight?.(pullRequest);
      }}
      className={`group -mx-2 block cursor-pointer px-2 py-1.5 transition ${
        isWarningHighlighted
          ? 'bg-amber-400/[0.08] shadow-[inset_0_0_0_1px_rgba(251,191,36,0.22)] hover:bg-amber-400/[0.12]'
          : isReadyHighlighted
            ? 'bg-violet-400/[0.09] shadow-[inset_0_0_0_1px_rgba(196,181,253,0.22)] hover:bg-violet-400/[0.14]'
            : 'hover:bg-white/[0.03]'
      }`}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_max-content] grid-rows-2 gap-x-3">
        <div className="row-span-2 flex min-w-0 items-start gap-1.5">
          <GitHubItemIcon
            kind="pull-request"
            isDraft={pullRequest.reviewStatus === 'draft'}
          />
          <div className="min-w-0 flex-1">
            <div className="inline-flex max-w-full items-center gap-1 align-top">
              <p className="truncate text-[0.82rem] font-medium leading-4.25 text-primary transition group-hover:text-white">
                {pullRequest.title}
              </p>
              <PullRequestTrailingIcon pullRequest={pullRequest} />
              {isInTodayFocus ? (
                <TodayFocusIndicator className="font-semibold" />
              ) : null}
            </div>
            <div className="mt-0.25 flex min-w-0 items-center overflow-hidden text-[0.66rem] text-secondary">
              <div
                className="flex min-w-0 items-center overflow-hidden"
                title={`${pullRequest.repositoryName}${shouldShowAuthor ? ` • by ${pullRequest.authorLogin}` : ''}`}
              >
                <p className="truncate">
                  <span>{repositoryLabel}</span>
                </p>
                {isQueued ? (
                  <>
                    <span className="mx-1.5 text-white/22">•</span>
                    <span className="inline-flex items-center gap-1 text-[#9e6a03]">
                      <PullRequestQueueIcon />
                      Queue #{pullRequest.mergeQueueEntry?.position ?? '?'}
                    </span>
                  </>
                ) : isReadyToMerge ? (
                  <>
                    <span className="mx-1.5 text-white/22">•</span>
                    <PullRequestReadyToMergeIcon />
                  </>
                ) : null}
                {shouldShowAuthor ? (
                  <span className="mx-1.5 text-white/22">•</span>
                ) : null}
                {shouldShowAuthor ? (
                  <span>by {pullRequest.authorLogin}</span>
                ) : null}
              </div>
              {hasConflicts ? (
                <span
                  title="This pull request has merge conflicts that must be resolved before merging."
                  className="ml-1.5 shrink-0 whitespace-nowrap text-amber-200/70"
                >
                  <span className="mr-1.5 text-white/22">•</span>
                  <span aria-hidden="true">⚠</span>
                  <span className="ml-1">Has conflicts</span>
                </span>
              ) : null}
              {isOutOfDate ? (
                <span
                  title="This branch is out of date with the base branch. Update branch required."
                  className="ml-1.5 shrink-0 whitespace-nowrap text-amber-200/70"
                >
                  <span className="mr-1.5 text-white/22">•</span>
                  <span aria-hidden="true">⚠</span>
                  <span className="ml-1">Out of date</span>
                </span>
              ) : null}
              {activeView === 'team-prs' && isNewTeamPr ? (
                <span
                  className="ml-1.5 shrink-0 whitespace-nowrap text-[#1f6feb]"
                  title="New team pull request"
                >
                  <span className="mr-1.5 text-white/22">•</span>
                  <span className="text-[0.66rem]">New</span>
                </span>
              ) : null}
            </div>
          </div>
        </div>
        <div className="col-start-2 row-start-1 flex items-center justify-end gap-2 self-center whitespace-nowrap">
          {pullRequest.totalCommentCount > 0 ? (
            <PullRequestCommentBadge
              newCount={newNotificationCount}
              totalCount={pullRequest.totalCommentCount}
            />
          ) : null}
          {activeView === 'team-prs' ? (
            <HideRepositoryIcon
              className="team-pr-hide-button__icon team-pr-hide-button__icon--interactive"
              ariaLabel={`Hide repository ${pullRequest.repositoryName} from Team PRs and repo search`}
              title={`Hide ${pullRequest.repositoryName} from Team PRs and repo search`}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                void onHideRepository?.(
                  mapPullRequestToHiddenRepository(pullRequest),
                );
              }}
            />
          ) : null}
          <StatusBadge
            label={status.label}
            className="inline-flex min-w-[8.75rem] justify-end whitespace-nowrap"
          />
        </div>
        <p className="col-start-2 row-start-2 mt-0.25 self-start whitespace-nowrap text-right text-[0.64rem] leading-4 text-white/38">
          updated {formatRelativeTime(pullRequest.updatedAt)}
        </p>
      </div>
    </a>
  );
}

function PullRequestTrailingIcon({
  pullRequest,
}: {
  pullRequest: GitHubPullRequestItem;
}) {
  return <PullRequestCheckStatusIcon ciStatus={pullRequest.ciStatus} />;
}

function PullRequestCommentBadge({
  newCount,
  totalCount,
}: {
  newCount: number;
  totalCount: number;
}) {
  const label =
    newCount > 0
      ? `${newCount} new · ${totalCount} total`
      : `${totalCount} total`;

  return (
    <span
      className="inline-flex min-w-[5.5rem] items-center justify-center gap-1 px-2 py-0.5 text-[0.64rem] font-medium leading-none text-white/60"
      title={label}
    >
      <svg
        viewBox="0 0 16 16"
        aria-hidden="true"
        className={`h-3.5 w-3.5 shrink-0 ${newCount > 0 ? 'text-white' : 'text-white/42'}`}
        fill="currentColor"
      >
        <path d="M2.25 3.75A2.25 2.25 0 0 1 4.5 1.5h7a2.25 2.25 0 0 1 2.25 2.25v4.5A2.25 2.25 0 0 1 11.5 10.5H8.78l-2.5 2.1a.75.75 0 0 1-1.23-.57V10.5H4.5a2.25 2.25 0 0 1-2.25-2.25v-4.5Z" />
      </svg>
      {newCount > 0 ? (
        <span>
          <span className="font-bold text-white">{newCount} new</span>
          <span className="text-white/38"> {'·'} </span>
          <span>{totalCount} total</span>
        </span>
      ) : (
        <span>{totalCount} total</span>
      )}
    </span>
  );
}

function PullRequestCheckStatusIcon({
  ciStatus,
}: {
  ciStatus: GitHubPullRequestItem['ciStatus'];
}) {
  if (ciStatus === 'passing') {
    return (
      <span className="shrink-0 text-base leading-none text-emerald-400">
        ✓
      </span>
    );
  }

  if (ciStatus === 'failing') {
    return (
      <svg
        viewBox="0 0 16 16"
        aria-hidden="true"
        className="h-[1.08rem] w-[1.08rem] shrink-0 text-rose-500"
        fill="currentColor"
      >
        <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z" />
      </svg>
    );
  }

  if (ciStatus === 'pending') {
    return (
      <svg
        viewBox="0 0 16 16"
        aria-hidden="true"
        className="h-[0.8rem] w-[0.8rem] shrink-0 animate-spin text-amber-300/85"
        fill="none"
      >
        <circle
          cx="8"
          cy="8"
          r="5.25"
          className="text-amber-100/4"
          stroke="currentColor"
          strokeWidth="2.1"
        />
        <path
          d="M8 2.75a5.25 5.25 0 0 1 5.25 5.25"
          className="text-amber-300"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="2.35"
        />
      </svg>
    );
  }

  return null;
}

function PullRequestReadyToMergeIcon() {
  return (
    <svg
      viewBox="0 0 12 12"
      aria-hidden="true"
      className="h-[0.8rem] w-[0.8rem] shrink-0 text-emerald-300"
      fill="currentColor"
    >
      <path d="M6 0a6 6 0 1 1 0 12A6 6 0 0 1 6 0Zm-.705 8.737L9.63 4.403 8.392 3.166 5.295 6.263l-1.7-1.702L2.356 5.8l2.938 2.938Z" />
    </svg>
  );
}

function PullRequestQueueIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className="h-[0.82rem] w-[0.82rem] shrink-0"
      fill="currentColor"
    >
      <path d="M3.75 4.5a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5ZM3 7.75a.75.75 0 0 1 1.5 0v2.878a2.251 2.251 0 1 1-1.5 0Zm.75 5.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm5-7.75a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0Zm5.75 2.5a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-1.5 0a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0Z" />
    </svg>
  );
}

function PullRequestList({
  pullRequests,
  todayFocusItemIds,
  activeView,
  gitHubPrReadyState,
  gitHubPrWarningState,
  gitHubTeamPrTrackerState,
  hasLoadedGitHubTeamPrTrackerState,
  pullRequestNewCommentCountByKey,
  onMarkNotificationsSeen,
  onMarkTeamPrSeen,
  onClearWarningHighlight,
  onHideRepository,
}: {
  pullRequests: GitHubPullRequestItem[];
  todayFocusItemIds: Set<string>;
  activeView: ActiveGitHubView;
  gitHubPrReadyState: GitHubPrReadyState;
  gitHubPrWarningState: GitHubPrWarningState;
  gitHubTeamPrTrackerState: GitHubTeamPrTrackerState;
  hasLoadedGitHubTeamPrTrackerState: boolean;
  pullRequestNewCommentCountByKey: Record<string, number>;
  onMarkNotificationsSeen: (pullRequest: GitHubPullRequestItem) => void;
  onMarkTeamPrSeen: (pullRequest: GitHubPullRequestItem) => void;
  onClearWarningHighlight: (pullRequest: GitHubPullRequestItem) => void;
  onHideRepository: (repository: GitHubHiddenRepository) => Promise<void>;
}) {
  const readyToClose = pullRequests.filter((pullRequest) =>
    isPullRequestReadyToMerge(pullRequest),
  );
  const remainingPullRequests = pullRequests.filter(
    (pullRequest) => !isPullRequestReadyToMerge(pullRequest),
  );

  if (readyToClose.length === 0) {
    return (
      <div className="border-b border-white/[0.06] divide-y divide-white/[0.06]">
        {remainingPullRequests.map((pullRequest) => (
          <PullRequestRow
            key={pullRequest.url}
            pullRequest={pullRequest}
            activeView={activeView}
            newNotificationCount={
              pullRequestNewCommentCountByKey[
                getGitHubPullRequestAttentionStateKey(pullRequest)
              ] ?? 0
            }
            isNewTeamPr={
              activeView === 'team-prs' &&
              hasLoadedGitHubTeamPrTrackerState &&
              gitHubTeamPrTrackerState.pendingNewKeys.includes(
                getGitHubPullRequestAttentionStateKey(pullRequest),
              )
            }
            isInTodayFocus={todayFocusItemIds.has(
              mapPullRequestToFocusItem(pullRequest).id,
            )}
            isReadyHighlighted={isGitHubPrReadyHighlighted(
              gitHubPrReadyState,
              pullRequest,
            )}
            isWarningHighlighted={isGitHubPrWarningHighlighted(
              gitHubPrWarningState,
              pullRequest,
            )}
            onMarkNotificationsSeen={onMarkNotificationsSeen}
            onMarkTeamPrSeen={onMarkTeamPrSeen}
            onClearWarningHighlight={onClearWarningHighlight}
            onHideRepository={onHideRepository}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="border-b border-white/[0.06] divide-y divide-white/[0.06]">
      {readyToClose.map((pullRequest) => (
        <PullRequestRow
          key={pullRequest.url}
          pullRequest={pullRequest}
          activeView={activeView}
          newNotificationCount={
            pullRequestNewCommentCountByKey[
              getGitHubPullRequestAttentionStateKey(pullRequest)
            ] ?? 0
          }
          isNewTeamPr={
            activeView === 'team-prs' &&
            hasLoadedGitHubTeamPrTrackerState &&
            gitHubTeamPrTrackerState.pendingNewKeys.includes(
              getGitHubPullRequestAttentionStateKey(pullRequest),
            )
          }
          isInTodayFocus={todayFocusItemIds.has(
            mapPullRequestToFocusItem(pullRequest).id,
          )}
          isReadyHighlighted={isGitHubPrReadyHighlighted(
            gitHubPrReadyState,
            pullRequest,
          )}
          isWarningHighlighted={isGitHubPrWarningHighlighted(
            gitHubPrWarningState,
            pullRequest,
          )}
          onMarkNotificationsSeen={onMarkNotificationsSeen}
          onMarkTeamPrSeen={onMarkTeamPrSeen}
          onClearWarningHighlight={onClearWarningHighlight}
          onHideRepository={onHideRepository}
        />
      ))}
      {remainingPullRequests.length > 0
        ? remainingPullRequests.map((pullRequest) => (
            <PullRequestRow
              key={pullRequest.url}
              pullRequest={pullRequest}
              activeView={activeView}
              newNotificationCount={
                pullRequestNewCommentCountByKey[
                  getGitHubPullRequestAttentionStateKey(pullRequest)
                ] ?? 0
              }
              isNewTeamPr={
                activeView === 'team-prs' &&
                hasLoadedGitHubTeamPrTrackerState &&
                gitHubTeamPrTrackerState.pendingNewKeys.includes(
                  getGitHubPullRequestAttentionStateKey(pullRequest),
                )
              }
              isInTodayFocus={todayFocusItemIds.has(
                mapPullRequestToFocusItem(pullRequest).id,
              )}
              isReadyHighlighted={isGitHubPrReadyHighlighted(
                gitHubPrReadyState,
                pullRequest,
              )}
              isWarningHighlighted={isGitHubPrWarningHighlighted(
                gitHubPrWarningState,
                pullRequest,
              )}
              onMarkNotificationsSeen={onMarkNotificationsSeen}
              onMarkTeamPrSeen={onMarkTeamPrSeen}
              onClearWarningHighlight={onClearWarningHighlight}
              onHideRepository={onHideRepository}
            />
          ))
        : null}
    </div>
  );
}

function mapPullRequestToHiddenRepository(
  pullRequest: GitHubPullRequestItem,
): GitHubHiddenRepository {
  return {
    id:
      Number.isFinite(pullRequest.repositoryId) && pullRequest.repositoryId > 0
        ? pullRequest.repositoryId
        : pullRequest.id,
    name: pullRequest.repo,
    fullName: pullRequest.repositoryName,
    owner: pullRequest.owner,
    url:
      typeof pullRequest.repositoryUrl === 'string' &&
      pullRequest.repositoryUrl.trim()
        ? pullRequest.repositoryUrl.trim()
        : `https://github.com/${pullRequest.owner}/${pullRequest.repo}`,
  };
}

function HideRepositoryIcon({
  className,
  ariaLabel,
  title,
  onClick,
}: {
  className: string;
  ariaLabel?: string;
  title?: string;
  onClick?: (event: MouseEvent<SVGSVGElement>) => void;
}) {
  function handleKeyDown(event: KeyboardEvent<SVGSVGElement>) {
    if (!onClick || (event.key !== 'Enter' && event.key !== ' ')) {
      return;
    }

    event.preventDefault();
    onClick(event as unknown as MouseEvent<SVGSVGElement>);
  }

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden={onClick ? undefined : 'true'}
      aria-label={ariaLabel}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={handleKeyDown}
    >
      {title ? <title>{title}</title> : null}
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M3.61399 4.21063C3.17804 3.87156 2.54976 3.9501 2.21069 4.38604C1.87162 4.82199 1.95016 5.45027 2.38611 5.78934L4.66386 7.56093C3.78436 8.54531 3.03065 9.68043 2.41854 10.896L2.39686 10.9389C2.30554 11.1189 2.18764 11.3514 2.1349 11.6381C2.09295 11.8661 2.09295 12.1339 2.1349 12.3618C2.18764 12.6485 2.30554 12.881 2.39686 13.0611L2.41854 13.104C4.35823 16.956 7.71985 20 12.0001 20C14.2313 20 16.2129 19.1728 17.8736 17.8352L20.3861 19.7893C20.8221 20.1284 21.4503 20.0499 21.7894 19.6139C22.1285 19.178 22.0499 18.5497 21.614 18.2106L3.61399 4.21063ZM16.2411 16.5654L14.4434 15.1672C13.7676 15.6894 12.9201 16 12.0001 16C9.79092 16 8.00006 14.2091 8.00006 12C8.00006 11.4353 8.11706 10.898 8.32814 10.4109L6.24467 8.79044C5.46659 9.63971 4.77931 10.6547 4.20485 11.7955C4.17614 11.8525 4.15487 11.8948 4.13694 11.9316C4.12114 11.964 4.11132 11.9853 4.10491 12C4.11132 12.0147 4.12114 12.036 4.13694 12.0684C4.15487 12.1052 4.17614 12.1474 4.20485 12.2045C5.9597 15.6894 8.76726 18 12.0001 18C13.5314 18 14.9673 17.4815 16.2411 16.5654ZM10.0187 11.7258C10.0064 11.8154 10.0001 11.907 10.0001 12C10.0001 13.1046 10.8955 14 12.0001 14C12.2667 14 12.5212 13.9478 12.7538 13.8531L10.0187 11.7258Z"
        fill="currentColor"
      />
      <path
        d="M10.9506 8.13908L15.9995 12.0661C15.9999 12.0441 16.0001 12.022 16.0001 12C16.0001 9.79085 14.2092 7.99999 12.0001 7.99999C11.6369 7.99999 11.285 8.04838 10.9506 8.13908Z"
        fill="currentColor"
      />
      <path
        d="M19.7953 12.2045C19.4494 12.8913 19.0626 13.5326 18.6397 14.1195L20.2175 15.3467C20.7288 14.6456 21.1849 13.8917 21.5816 13.104L21.6033 13.0611C21.6946 12.881 21.8125 12.6485 21.8652 12.3618C21.9072 12.1339 21.9072 11.8661 21.8652 11.6381C21.8125 11.3514 21.6946 11.1189 21.6033 10.9389L21.5816 10.896C19.6419 7.04402 16.2803 3.99998 12.0001 3.99998C10.2848 3.99998 8.71714 4.48881 7.32934 5.32257L9.05854 6.66751C9.98229 6.23476 10.9696 5.99998 12.0001 5.99998C15.2329 5.99998 18.0404 8.31058 19.7953 11.7955C19.824 11.8525 19.8453 11.8948 19.8632 11.9316C19.879 11.964 19.8888 11.9853 19.8952 12C19.8888 12.0147 19.879 12.036 19.8632 12.0684C19.8453 12.1052 19.824 12.1474 19.7953 12.2045Z"
        fill="currentColor"
      />
    </svg>
  );
}

function GitHubItemIcon({
  kind,
  isDraft = false,
}: {
  kind: 'pull-request' | 'issue' | 'commit' | 'discussion';
  isDraft?: boolean;
}) {
  if (kind === 'issue') {
    return (
      <svg
        viewBox="0 0 16 16"
        aria-hidden="true"
        className="h-4 w-4 flex-none text-emerald-400"
        fill="currentColor"
      >
        <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14Zm0-11.75a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm1 8.5v-5h-2v5h2Z" />
      </svg>
    );
  }

  if (kind === 'commit') {
    return (
      <svg
        viewBox="0 0 16 16"
        aria-hidden="true"
        className="h-4 w-4 flex-none text-amber-400"
        fill="currentColor"
      >
        <path d="M6.5 1.75a6.25 6.25 0 0 1 3 11.73v.77a.75.75 0 0 1-1.5 0v-.33a6.26 6.26 0 0 1-2-12.17v-.5a.75.75 0 0 1 1.5 0v.5c.33-.05.66-.07 1-.07Zm0 1.5a4.75 4.75 0 1 0 0 9.5 4.75 4.75 0 0 0 0-9.5Z" />
      </svg>
    );
  }

  if (kind === 'discussion') {
    return (
      <svg
        viewBox="0 0 16 16"
        aria-hidden="true"
        className="h-4 w-4 flex-none text-sky-400"
        fill="currentColor"
      >
        <path d="M1.75 3A2.25 2.25 0 0 1 4 0.75h8A2.25 2.25 0 0 1 14.25 3v5A2.25 2.25 0 0 1 12 10.25H8.56L5.53 13.1A.75.75 0 0 1 4.25 12.55v-2.3H4A2.25 2.25 0 0 1 1.75 8V3ZM4 2.25a.75.75 0 0 0-.75.75v5c0 .414.336.75.75.75H5a.75.75 0 0 1 .75.75v1.32l2.03-1.91a.75.75 0 0 1 .52-.16H12a.75.75 0 0 0 .75-.75V3a.75.75 0 0 0-.75-.75H4Z" />
      </svg>
    );
  }

  if (kind === 'pull-request' && isDraft) {
    return (
      <svg
        viewBox="0 0 16 16"
        aria-hidden="true"
        className="h-4 w-4 flex-none text-white/38"
        fill="currentColor"
      >
        <path d="M3.25 1A2.25 2.25 0 0 1 4 5.372v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.251 2.251 0 0 1 3.25 1Zm9.5 14a2.25 2.25 0 1 1 0-4.5 2.25 2.25 0 0 1 0 4.5ZM2.5 3.25a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0ZM3.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm9.5 0a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5ZM14 7.5a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0Zm0-4.25a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0Z" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className="h-4 w-4 flex-none text-emerald-400"
      fill="currentColor"
    >
      <path d="M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25Zm5.677-.177L9.573.677A.25.25 0 0 1 10 .854V2.5h1A2.5 2.5 0 0 1 13.5 5v5.628a2.251 2.251 0 1 1-1.5 0V5a1 1 0 0 0-1-1h-1v1.646a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354ZM3.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm0 9.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm8.25.75a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Z" />
    </svg>
  );
}

function Badge({
  label,
  tone,
}: {
  label: string;
  tone: 'default' | 'green' | 'red' | 'yellow' | 'gray';
}) {
  const toneClass = {
    default: 'bg-white/[0.05] text-white/50',
    green: 'bg-emerald-400/16 text-emerald-100',
    red: 'bg-rose-400/16 text-rose-100',
    yellow: 'bg-amber-400/16 text-amber-100',
    gray: 'bg-white/[0.045] text-white/42',
  }[tone];

  return (
    <span
      className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[0.6rem] uppercase tracking-[0.14em] ${toneClass}`}
    >
      {label}
    </span>
  );
}

function ListItemSkeleton() {
  return (
    <div className="rounded-[14px] bg-[var(--card-bg-soft)] px-4 py-3 shadow-[var(--shadow-card-soft)]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="h-4 w-4/5 animate-pulse rounded bg-white/10" />
          <div className="mt-3 h-3 w-2/5 animate-pulse rounded bg-white/10" />
        </div>
        <div className="h-6 w-14 animate-pulse rounded-full bg-white/10" />
      </div>
      <div className="mt-4 h-3 w-24 animate-pulse rounded bg-white/10" />
    </div>
  );
}

function formatCount(value: number, isLoading: boolean) {
  if (isLoading) {
    return '...';
  }

  return String(value);
}

function arraysEqual(left: string[], right: string[]) {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function areGitHubPrReadyStatesEqual(
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

function areGitHubPrWarningStatesEqual(
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
