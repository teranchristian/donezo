import { ReactNode, useEffect, useState } from 'react';
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
  getStoredGitHubPrWarningState,
  getStoredGitHubSortOrder,
  saveStoredGitHubPrNotificationSeenAtState,
  saveStoredGitHubPrReadyState,
  saveStoredGitHubPrWarningState,
  saveStoredGitHubSortOrder,
  type ActiveGitHubView,
  type GitHubPrReadyState,
  type GitHubPrNotificationSeenAtState,
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
  isMockMode?: boolean;
  isLoading: boolean;
  onSummaryMetricsChange: (metrics: GitHubSummaryMetrics) => void;
  activeView: ActiveGitHubView;
  prStatusFilter: GitHubPrStatusFilter;
  onViewChange: (view: ActiveGitHubView) => void;
  onPrStatusFilterChange: (filter: GitHubPrStatusFilter) => void;
};

export type GitHubSummaryMetrics = {
  connectionStatus: GitHubConnectionStatus;
  missingUsername: boolean;
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
  isMockMode = false,
  isLoading,
  onSummaryMetricsChange,
  activeView,
  prStatusFilter,
  onViewChange,
  onPrStatusFilterChange,
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
  const filteredMyOpenPRs = filterGitHubPullRequests(
    myOpenPRs,
    organizationFilter,
    prStatusFilter,
  );
  const filteredReviewRequestedPRs = ownerFilteredReviewRequestedPRs;
  const filteredRecentOpenPRs = ownerFilteredRecentOpenPRs;
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
      key: 'prs',
      label: 'Team PRs',
      value: formatCount(filteredRecentOpenPrCount, isLoading),
      isActive: activeView === 'prs',
      title: isLoading
        ? undefined
        : `${filteredRecentOpenPrCount} of ${recentOpenPRs.length} PRs`,
      onClick: () => onViewChange('prs'),
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
      [...resolvedPullRequests, ...recentOpenPRs].map((pullRequest) =>
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
    recentOpenPRs,
    resolvedPullRequests,
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

  useEffect(() => {
    onSummaryMetricsChange({
      connectionStatus: data.connectionStatus,
      missingUsername: data.missingUsername,
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
                gitHubPrReadyState={gitHubPrReadyState}
                gitHubPrWarningState={gitHubPrWarningState}
                pullRequestNewCommentCountByKey={
                  pullRequestNewCommentCountByKey
                }
                onMarkNotificationsSeen={handleMarkPullRequestNotificationsSeen}
                onClearWarningHighlight={handleClearWarningHighlight}
              />
            )}
          </div>
          {!isLoading &&
          ((activeView === 'my-prs' &&
            data.openPrsCount > 0 &&
            username.trim()) ||
            (activeView === 'prs' && data.recentOpenPrsCount > 0)) ? (
            <div className="mt-3 text-right">
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
  newNotificationCount,
  isInTodayFocus,
  isReadyHighlighted = false,
  isWarningHighlighted = false,
  onMarkNotificationsSeen,
  onClearWarningHighlight,
}: {
  pullRequest: GitHubPullRequestItem;
  newNotificationCount: number;
  isInTodayFocus: boolean;
  isReadyHighlighted?: boolean;
  isWarningHighlighted?: boolean;
  onMarkNotificationsSeen?: (pullRequest: GitHubPullRequestItem) => void;
  onClearWarningHighlight?: (pullRequest: GitHubPullRequestItem) => void;
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
                    <span>
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

function PullRequestList({
  pullRequests,
  todayFocusItemIds,
  gitHubPrReadyState,
  gitHubPrWarningState,
  pullRequestNewCommentCountByKey,
  onMarkNotificationsSeen,
  onClearWarningHighlight,
}: {
  pullRequests: GitHubPullRequestItem[];
  todayFocusItemIds: Set<string>;
  gitHubPrReadyState: GitHubPrReadyState;
  gitHubPrWarningState: GitHubPrWarningState;
  pullRequestNewCommentCountByKey: Record<string, number>;
  onMarkNotificationsSeen: (pullRequest: GitHubPullRequestItem) => void;
  onClearWarningHighlight: (pullRequest: GitHubPullRequestItem) => void;
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
            newNotificationCount={
              pullRequestNewCommentCountByKey[
                getGitHubPullRequestAttentionStateKey(pullRequest)
              ] ?? 0
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
            onClearWarningHighlight={onClearWarningHighlight}
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
          newNotificationCount={
            pullRequestNewCommentCountByKey[
              getGitHubPullRequestAttentionStateKey(pullRequest)
            ] ?? 0
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
          onClearWarningHighlight={onClearWarningHighlight}
        />
      ))}
      {remainingPullRequests.length > 0
        ? remainingPullRequests.map((pullRequest) => (
            <PullRequestRow
              key={pullRequest.url}
              pullRequest={pullRequest}
              newNotificationCount={
                pullRequestNewCommentCountByKey[
                  getGitHubPullRequestAttentionStateKey(pullRequest)
                ] ?? 0
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
              onClearWarningHighlight={onClearWarningHighlight}
            />
          ))
        : null}
    </div>
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
