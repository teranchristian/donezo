import { ReactNode, useEffect, useState } from 'react';
import {
  GitHubConnectionStatus,
  GitHubDashboardData,
  GitHubNotification,
  GitHubPullRequestItem,
  getGitHubPullRequestStates,
  type GitHubPullRequestState
} from '../lib/githubApi';
import { type FocusItem } from '../lib/storage';
import { formatRelativeTime } from '../lib/date';
import {
  getStoredGitHubPrReadyState,
  getStoredGitHubPrWarningState,
  getStoredGitHubSortOrder,
  saveStoredGitHubPrReadyState,
  saveStoredGitHubPrWarningState,
  saveStoredGitHubSortOrder,
  type ActiveGitHubView,
  type GitHubPrReadyState,
  type GitHubPrWarningState,
  type GitHubPrStatusFilter,
  type GitHubListSort
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
  token: string;
  ownerFilter: string;
  isMockMode?: boolean;
  isLoading: boolean;
  isCheckingActivity: boolean;
  lastActivityCheckAt: number | null;
  onRefresh: () => void;
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
  highlightedReadyCount: number;
  highlightedWarningCount: number;
  reviewRequestedCount: number;
  approvedPrCount: number | null;
  relevantPrCount: number;
};

const STATUS_COPY: Record<GitHubConnectionStatus, { label: string; tone: string; message: string }> = {
  'not-connected': {
    label: 'Not connected',
    tone: 'bg-white/6 text-stone-300',
    message: 'Add a personal access token in Settings to enable GitHub integration.'
  },
  testing: {
    label: 'Testing',
    tone: 'bg-amber-200/10 text-amber-100',
    message: 'Checking the saved GitHub credentials.'
  },
  connected: {
    label: 'Connected',
    tone: 'bg-emerald-200/10 text-emerald-100',
    message: 'GitHub activity is live on the dashboard.'
  },
  invalid: {
    label: 'Invalid token',
    tone: 'bg-rose-200/10 text-rose-100',
    message: 'GitHub returned 401 for the saved token. Update the token and test again.'
  },
  error: {
    label: 'Connection error',
    tone: 'bg-amber-200/10 text-amber-100',
    message: 'GitHub data could not be loaded right now.'
  }
};

export function GitHubCard({
  topBar,
  data,
  todayFocusItemIds,
  username,
  token,
  ownerFilter,
  isMockMode = false,
  isLoading,
  isCheckingActivity,
  lastActivityCheckAt,
  onRefresh,
  onSummaryMetricsChange,
  activeView,
  prStatusFilter,
  onViewChange,
  onPrStatusFilterChange
}: GitHubCardProps) {
  const filterControlClass =
    'flex h-9 min-w-0 items-center gap-1.5 rounded-[10px] border border-white/[0.035] bg-white/[0.025] px-2.5 text-[0.8rem] text-white/40 transition hover:bg-white/[0.04] hover:text-white/54';
  const filterSelectClass =
    'min-w-0 bg-transparent pr-5 text-[0.8rem] font-medium text-white/76 outline-none';
  const [sortOrder, setSortOrder] = useState<GitHubListSort>('recently-updated');
  const [hasLoadedSortOrder, setHasLoadedSortOrder] = useState(false);
  const [gitHubPrReadyState, setGitHubPrReadyState] = useState<GitHubPrReadyState>({});
  const [hasLoadedGitHubPrReadyState, setHasLoadedGitHubPrReadyState] = useState(false);
  const [gitHubPrWarningState, setGitHubPrWarningState] = useState<GitHubPrWarningState>({});
  const [hasLoadedGitHubPrWarningState, setHasLoadedGitHubPrWarningState] = useState(false);
  const [isResolvingNotificationStates, setIsResolvingNotificationStates] = useState(false);
  const [notificationPullRequestStates, setNotificationPullRequestStates] = useState<
    Record<string, GitHubPullRequestState>
  >({});
  const organizationFilter = isMockMode ? 'all' : ownerFilter.trim() || 'all';
  const resolvedPullRequests = data.pullRequests;
  const myOpenPRs = resolvedPullRequests.filter((pullRequest) => pullRequest.source === 'authored');
  const reviewRequestedPRs = resolvedPullRequests.filter(
    (pullRequest) => pullRequest.source === 'review-requested'
  );
  const notifications = (data.notifications ?? []).filter(shouldDisplayNotification);
  const viewAllUrl = `https://github.com/pulls?q=${encodeURIComponent(`is:pr is:open author:${username.trim()}`)}`;
  const notificationItems = notifications.map((notification) => ({
    kind: 'notification' as const,
    key: notification.id,
    owner: getOwnerFromRepositoryName(notification.repository.full_name),
    repositoryName: notification.repository.full_name,
    title: notification.subject.title,
    updatedAt: notification.updated_at,
    value: notification
  }));
  const myOpenPrItems = myOpenPRs.map((pullRequest) => mapPullRequestViewItem(pullRequest));
  const reviewRequestedItems = reviewRequestedPRs.map((pullRequest) => mapPullRequestViewItem(pullRequest));
  const ownerFilteredMyOpenPRs = filterGitHubPullRequests(myOpenPRs, organizationFilter);
  const ownerFilteredReviewRequestedPRs = filterGitHubPullRequests(reviewRequestedPRs, organizationFilter);
  const filteredMyOpenPRs = filterGitHubPullRequests(myOpenPRs, organizationFilter, prStatusFilter);
  const filteredReviewRequestedPRs = ownerFilteredReviewRequestedPRs;
  const filteredNotificationCount = filterGitHubItems(notificationItems, organizationFilter).length;
  const filteredMyOpenPrCount = filteredMyOpenPRs.length;
  const filteredReviewRequestedCount = filteredReviewRequestedPRs.length;
  const summaryMyOpenPrCount = ownerFilteredMyOpenPRs.length;
  const summaryReviewRequestedCount = ownerFilteredReviewRequestedPRs.length;
  const highlightedReadyCount = resolvedPullRequests.filter((pullRequest) =>
    isGitHubPrReadyHighlighted(gitHubPrReadyState, pullRequest)
  ).length;
  const readyToMergeCount = resolvedPullRequests.filter((pullRequest) => isPullRequestReadyToClose(pullRequest)).length;
  const highlightedWarningCount = resolvedPullRequests.filter((pullRequest) =>
    isGitHubPrWarningHighlighted(gitHubPrWarningState, pullRequest)
  ).length;
  const summaryApprovedPrCount = ownerFilteredMyOpenPRs.filter(
    (pullRequest) => pullRequest.reviewStatus === 'approved' && !isPullRequestOutOfDate(pullRequest)
  ).length;
  const currentView = getGitHubViewContent(
    activeView,
    data,
    notifications,
    filteredMyOpenPRs,
    reviewRequestedPRs
  );
  const filteredItems = sortGitHubItems(
    filterGitHubItems(currentView.items, organizationFilter),
    sortOrder
  );
  const visiblePullRequestNotifications = filteredItems
    .filter((item): item is Extract<GitHubViewItem, { kind: 'notification' }> => item.kind === 'notification')
    .map((item) => item.value)
    .filter((notification) => notification.subject.type === 'PullRequest')
    .filter((notification) => !notificationPullRequestStates[notification.id]);
  const visibleNotificationPullRequestKey = visiblePullRequestNotifications
    .map((notification) => notification.id)
    .join('|');
  const isNotificationViewLoading = activeView === 'notifications' && (isLoading || isResolvingNotificationStates);
  const tabItems = [
    {
      key: 'prs',
      label: 'PRs',
      value: formatCount(filteredMyOpenPrCount, isLoading),
      isActive: activeView === 'prs',
      title: isLoading ? undefined : `${filteredMyOpenPrCount} of ${myOpenPrItems.length} PRs`,
      onClick: () => onViewChange('prs')
    },
    {
      key: 'notifications',
      label: 'Notifications',
      value: formatCount(filteredNotificationCount, isLoading || isResolvingNotificationStates),
      isActive: activeView === 'notifications',
      onClick: () => onViewChange('notifications')
    },
    {
      key: 'review',
      label: 'Review',
      value: formatCount(filteredReviewRequestedCount, isLoading),
      isActive: activeView === 'review',
      onClick: () => onViewChange('review')
    }
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
    if (!hasLoadedGitHubPrReadyState) {
      return;
    }

    setGitHubPrReadyState((currentState) => {
      const nextState = buildGitHubPrReadyState(currentState, resolvedPullRequests);
      return areGitHubPrReadyStatesEqual(currentState, nextState) ? currentState : nextState;
    });
  }, [hasLoadedGitHubPrReadyState, resolvedPullRequests]);

  useEffect(() => {
    if (!hasLoadedGitHubPrWarningState) {
      return;
    }

    setGitHubPrWarningState((currentState) => {
      const nextState = buildGitHubPrWarningState(currentState, resolvedPullRequests);
      return areGitHubPrWarningStatesEqual(currentState, nextState) ? currentState : nextState;
    });
  }, [hasLoadedGitHubPrWarningState, resolvedPullRequests]);

  useEffect(() => {
    const activeNotificationIds = new Set((data.notifications ?? []).map((notification) => notification.id));

    setIsResolvingNotificationStates(false);
    setNotificationPullRequestStates((currentEntries) => {
      const nextEntries = Object.fromEntries(
        Object.entries(currentEntries).filter(([id]) => activeNotificationIds.has(id))
      );

      return Object.keys(nextEntries).length === Object.keys(currentEntries).length
        ? currentEntries
        : nextEntries;
    });
  }, [data.notifications]);

  useEffect(() => {
    onSummaryMetricsChange({
      connectionStatus: data.connectionStatus,
      missingUsername: data.missingUsername,
      readyToMergeCount,
      highlightedReadyCount,
      highlightedWarningCount,
      reviewRequestedCount: summaryReviewRequestedCount,
      approvedPrCount: summaryApprovedPrCount,
      relevantPrCount: summaryMyOpenPrCount + summaryReviewRequestedCount
    });
  }, [
    data.connectionStatus,
    data.missingUsername,
    readyToMergeCount,
    highlightedReadyCount,
    highlightedWarningCount,
    summaryApprovedPrCount,
    summaryMyOpenPrCount,
    summaryReviewRequestedCount,
    onSummaryMetricsChange
  ]);

  useEffect(() => {
    if (!token.trim() || visiblePullRequestNotifications.length === 0) {
      setIsResolvingNotificationStates(false);
      return;
    }

    let isCancelled = false;
    setIsResolvingNotificationStates(true);

    const missingPullRequests = visiblePullRequestNotifications
      .map((notification) => {
        const pullRequestIdentity = getPullRequestIdentityFromNotification(notification);
        if (!pullRequestIdentity) {
          return null;
        }

        return {
          id: notification.id,
          ...pullRequestIdentity
        };
      })
      .filter((pullRequest): pullRequest is { id: string; owner: string; repo: string; pullNumber: number } =>
        Boolean(pullRequest)
      );

    getGitHubPullRequestStates({
      token,
      pullRequests: missingPullRequests
    }).then((statesById) => {
      if (isCancelled) {
        return;
      }

      setNotificationPullRequestStates((currentEntries) => {
        const nextEntries = { ...currentEntries };
        for (const [id, state] of Object.entries(statesById)) {
          nextEntries[id] = state;
        }

        return nextEntries;
      });
      setIsResolvingNotificationStates(false);
    });

    return () => {
      isCancelled = true;
    };
  }, [token, visibleNotificationPullRequestKey]);

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
          highlighted: false
        }
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
          highlighted: false
        }
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
              {activeView === 'prs' ? (
                <label className={`${filterControlClass} min-w-[160px] flex-1 xl:w-[168px] xl:flex-none`}>
                  <span className="shrink-0 text-[var(--text-tertiary)]">Status:</span>
                  <select
                    aria-label="PR status"
                    value={prStatusFilter}
                    onChange={(event) => onPrStatusFilterChange(event.target.value as GitHubPrStatusFilter)}
                    className={`${filterSelectClass} flex-1`}
                  >
                    <option value="all" className="bg-panel text-stone-100">
                      All
                    </option>
                    <option value="approved" className="bg-panel text-stone-100">
                      Approved
                    </option>
                    <option value="ready-to-merge" className="bg-panel text-stone-100">
                      Ready to merge
                    </option>
                    <option value="waiting-review" className="bg-panel text-stone-100">
                      Waiting review
                    </option>
                  </select>
                </label>
              ) : null}

              <label className={`${filterControlClass} min-w-[200px] flex-1 xl:w-[220px] xl:flex-none`}>
                <span className="shrink-0 text-[var(--text-tertiary)]">Sort:</span>
                <select
                  aria-label="Sort"
                  value={sortOrder}
                  onChange={(event) => setSortOrder(event.target.value as GitHubListSort)}
                  className={`${filterSelectClass} flex-1`}
                >
                  <option value="recently-updated" className="bg-panel text-stone-100">
                    Recently updated
                  </option>
                  <option value="oldest-updated" className="bg-panel text-stone-100">
                    Oldest updated
                  </option>
                  <option value="repository-asc" className="bg-panel text-stone-100">
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
            {isNotificationViewLoading || isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, index) => (
                  <ListItemSkeleton key={index} />
                ))}
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="rounded-[14px] bg-[var(--card-bg-soft)] px-4 py-5 text-sm text-secondary shadow-[var(--shadow-card-soft)]">
                {currentView.items.length === 0 ? currentView.emptyMessage : getNoFilterResultsMessage(currentView.itemLabel)}
              </div>
            ) : activeView === 'prs' ? (
              <PullRequestList
                pullRequests={filteredItems
                  .filter((item): item is Extract<GitHubViewItem, { kind: 'pull-request' }> => item.kind === 'pull-request')
                  .map((item) => item.value)}
                todayFocusItemIds={todayFocusItemIds}
                gitHubPrReadyState={gitHubPrReadyState}
                gitHubPrWarningState={gitHubPrWarningState}
                onClearWarningHighlight={handleClearWarningHighlight}
              />
            ) : (
              <div className="border-b border-white/[0.06] divide-y divide-white/[0.06]">
                {filteredItems.map((item) =>
                  item.kind === 'notification' ? (
                    <NotificationRow
                      key={item.key}
                      notification={item.value}
                      pullRequestState={notificationPullRequestStates[item.value.id]}
                    />
                  ) : (
                    <PullRequestRow
                      key={item.key}
                      pullRequest={item.value}
                      isInTodayFocus={todayFocusItemIds.has(mapPullRequestToFocusItem(item.value).id)}
                      isReadyHighlighted={isGitHubPrReadyHighlighted(gitHubPrReadyState, item.value)}
                      isWarningHighlighted={isGitHubPrWarningHighlighted(gitHubPrWarningState, item.value)}
                      onClearWarningHighlight={handleClearWarningHighlight}
                    />
                  )
                )}
              </div>
            )}
          </div>
          {!isLoading && activeView === 'prs' && data.openPrsCount > 0 && username.trim() ? (
            <div className="mt-3 text-right">
              <a
                href={viewAllUrl}
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

type GitHubViewItem =
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

function PullRequestRow({
  pullRequest,
  isInTodayFocus,
  isReadyHighlighted = false,
  isWarningHighlighted = false,
  onClearWarningHighlight
}: {
  pullRequest: GitHubPullRequestItem;
  isInTodayFocus: boolean;
  isReadyHighlighted?: boolean;
  isWarningHighlighted?: boolean;
  onClearWarningHighlight?: (pullRequest: GitHubPullRequestItem) => void;
}) {
  const isOutOfDate = isPullRequestOutOfDate(pullRequest);
  const hasConflicts = pullRequest.mergeStateStatus === 'DIRTY';
  const isQueued = isPullRequestQueued(pullRequest);
  const isReadyToMerge = isPullRequestReadyToClose(pullRequest);
  const status = getPullRequestDisplayStatus(pullRequest);
  const shouldShowAuthor = pullRequest.source !== 'authored' && Boolean(pullRequest.authorLogin);
  const repositoryLabel = getRepositoryLabel(pullRequest.repositoryName);

  return (
    <a
      href={pullRequest.url}
      target="_blank"
      rel="noreferrer"
      draggable
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'copy';
        event.dataTransfer.setData(TODAY_FOCUS_DRAG_MIME, JSON.stringify(mapPullRequestToFocusItem(pullRequest)));
        event.dataTransfer.setData('text/plain', `${pullRequest.repositoryName}#${pullRequest.pullNumber}`);
      }}
      onClick={() => onClearWarningHighlight?.(pullRequest)}
      className={`group -mx-2 block cursor-pointer px-2 py-1.5 transition ${
        isWarningHighlighted
          ? 'bg-amber-400/[0.08] shadow-[inset_0_0_0_1px_rgba(251,191,36,0.22)] hover:bg-amber-400/[0.12]'
          : isReadyHighlighted
            ? 'bg-violet-400/[0.09] shadow-[inset_0_0_0_1px_rgba(196,181,253,0.22)] hover:bg-violet-400/[0.14]'
          : 'hover:bg-white/[0.03]'
      }`}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_9.5rem] grid-rows-2 gap-x-3">
        <div className="row-span-2 flex min-w-0 items-start gap-1.5">
          <GitHubItemIcon kind="pull-request" isDraft={pullRequest.reviewStatus === 'draft'} />
          <div className="min-w-0 flex-1">
            <div className="inline-flex max-w-full items-center gap-1 align-top">
              <p className="truncate text-[0.82rem] font-medium leading-4.25 text-primary transition group-hover:text-white">
                {pullRequest.title}
              </p>
              <PullRequestTrailingIcon pullRequest={pullRequest} />
              {isInTodayFocus ? <TodayFocusIndicator className="font-semibold" /> : null}
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
                {shouldShowAuthor ? <span className="mx-1.5 text-white/22">•</span> : null}
                {shouldShowAuthor ? <span>by {pullRequest.authorLogin}</span> : null}
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
        <div className="col-start-2 row-start-1 flex items-center justify-end self-start pt-[0.08rem]">
          <StatusBadge label={status.label} />
        </div>
        <p className="col-start-2 row-start-2 mt-0.25 self-start text-right text-[0.64rem] leading-4 text-white/38">
          updated {formatRelativeTime(pullRequest.updatedAt)}
        </p>
      </div>
    </a>
  );
}

function PullRequestTrailingIcon({
  pullRequest
}: {
  pullRequest: GitHubPullRequestItem;
}) {
  return <PullRequestCheckStatusIcon ciStatus={pullRequest.ciStatus} />;
}

function mapPullRequestToFocusItem(pullRequest: GitHubPullRequestItem): FocusItem {
  return {
    id: `github:${pullRequest.repositoryName}#${pullRequest.pullNumber}`,
    source: 'github',
    sourceLabel: 'GitHub',
    reference: `#${pullRequest.pullNumber}`,
    title: pullRequest.title,
    statusLabel: getFocusStatusLabel(pullRequest.reviewStatus),
    statusTone: getFocusStatusTone(pullRequest.reviewStatus),
    jiraKey: extractJiraKey(pullRequest.title)
  };
}

function extractJiraKey(value: string) {
  const match = value.match(/\b([A-Z][A-Z0-9]+-\d+)\b/);
  return match ? match[1].toUpperCase() : null;
}

function getFocusStatusLabel(reviewStatus: GitHubPullRequestItem['reviewStatus']) {
  if (reviewStatus === 'approved') {
    return 'Approved';
  }

  if (reviewStatus === 'changes-requested') {
    return 'Changes Requested';
  }

  if (reviewStatus === 'draft') {
    return 'Draft';
  }

  return 'Open';
}

function getFocusStatusTone(reviewStatus: GitHubPullRequestItem['reviewStatus']): FocusItem['statusTone'] {
  if (reviewStatus === 'approved') {
    return 'emerald';
  }

  if (reviewStatus === 'changes-requested') {
    return 'amber';
  }

  return 'violet';
}

function PullRequestCheckStatusIcon({
  ciStatus
}: {
  ciStatus: GitHubPullRequestItem['ciStatus'];
}) {
  if (ciStatus === 'passing') {
    return <span className="shrink-0 text-base leading-none text-emerald-400">✓</span>;
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
        <circle cx="8" cy="8" r="5.25" className="text-amber-100/4" stroke="currentColor" strokeWidth="2.1" />
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
  onClearWarningHighlight
}: {
  pullRequests: GitHubPullRequestItem[];
  todayFocusItemIds: Set<string>;
  gitHubPrReadyState: GitHubPrReadyState;
  gitHubPrWarningState: GitHubPrWarningState;
  onClearWarningHighlight: (pullRequest: GitHubPullRequestItem) => void;
}) {
  const readyToClose = pullRequests.filter((pullRequest) => isPullRequestReadyToClose(pullRequest));
  const remainingPullRequests = pullRequests.filter((pullRequest) => !isPullRequestReadyToClose(pullRequest));

  if (readyToClose.length === 0) {
    return (
      <div className="border-b border-white/[0.06] divide-y divide-white/[0.06]">
        {remainingPullRequests.map((pullRequest) => (
          <PullRequestRow
            key={pullRequest.url}
            pullRequest={pullRequest}
            isInTodayFocus={todayFocusItemIds.has(mapPullRequestToFocusItem(pullRequest).id)}
            isReadyHighlighted={isGitHubPrReadyHighlighted(gitHubPrReadyState, pullRequest)}
            isWarningHighlighted={isGitHubPrWarningHighlighted(gitHubPrWarningState, pullRequest)}
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
          isInTodayFocus={todayFocusItemIds.has(mapPullRequestToFocusItem(pullRequest).id)}
          isReadyHighlighted={isGitHubPrReadyHighlighted(gitHubPrReadyState, pullRequest)}
          isWarningHighlighted={isGitHubPrWarningHighlighted(gitHubPrWarningState, pullRequest)}
          onClearWarningHighlight={onClearWarningHighlight}
        />
      ))}
      {remainingPullRequests.length > 0 ? (
        remainingPullRequests.map((pullRequest) => (
          <PullRequestRow
            key={pullRequest.url}
            pullRequest={pullRequest}
            isInTodayFocus={todayFocusItemIds.has(mapPullRequestToFocusItem(pullRequest).id)}
            isReadyHighlighted={isGitHubPrReadyHighlighted(gitHubPrReadyState, pullRequest)}
            isWarningHighlighted={isGitHubPrWarningHighlighted(gitHubPrWarningState, pullRequest)}
            onClearWarningHighlight={onClearWarningHighlight}
          />
        ))
      ) : null}
    </div>
  );
}

function NotificationRow({
  notification,
  pullRequestState
}: {
  notification: GitHubNotification;
  pullRequestState?: GitHubPullRequestState;
}) {
  const iconKind = getNotificationIconKind(notification.subject.type);
  const notificationTypeLabel = getNotificationTypeLabel(notification);
  const authorLogin = notification.authorLogin?.trim() ?? '';
  const repositoryLabel = getRepositoryLabel(notification.repository.full_name);
  const rowTextClass = notification.unread ? 'text-primary' : 'text-secondary';
  const rowMetaClass = notification.unread ? 'text-white/42' : 'text-[var(--text-tertiary)]';
  const rowMutedClass = notification.unread ? 'text-white/36' : 'text-[var(--text-tertiary)]';
  const rowTimestampClass = notification.unread ? 'text-white/38' : 'text-[var(--text-tertiary)]';

  return (
    <a
      href={getNotificationUrl(notification)}
      target="_blank"
      rel="noreferrer"
      className="group -mx-2 block cursor-pointer px-2 py-1.5 transition hover:bg-white/[0.03]"
    >
      <div className="grid grid-cols-[minmax(0,1fr)_9.5rem] grid-rows-2 gap-x-3">
        <div className="row-span-2 flex min-w-0 items-start gap-1.5">
          <GitHubItemIcon
            kind={iconKind}
            state={iconKind === 'pull-request' ? pullRequestState : undefined}
          />
          <div className="min-w-0 flex-1">
            <div className="inline-flex max-w-full items-center gap-1 align-top">
              <p
                className={`truncate text-[0.82rem] font-medium leading-4.25 transition group-hover:text-white ${rowTextClass}`}
              >
                {notification.subject.title}
              </p>
            </div>
            <div className={`mt-0.25 flex min-w-0 items-center overflow-hidden text-[0.66rem] ${rowMetaClass}`}>
              <p
                className="truncate"
                title={`${notification.repository.full_name}${authorLogin ? ` • by ${authorLogin}` : ''}${notification.unread ? ' • unread' : ''}`}
              >
                <span>{repositoryLabel}</span>
                {authorLogin ? <span className="mx-1.5 text-white/22">•</span> : null}
                {authorLogin ? <span>by {authorLogin}</span> : null}
                {notification.unread ? <span className="mx-1.5 text-white/22">•</span> : null}
                {notification.unread ? <span>Unread</span> : null}
              </p>
            </div>
          </div>
        </div>
        <div className="col-start-2 row-start-1 flex items-center justify-end self-start pt-[0.08rem]">
          <p className={`text-right text-[0.58rem] font-medium uppercase tracking-[0.12em] ${rowMutedClass}`}>
            {notificationTypeLabel}
          </p>
        </div>
        <p className={`col-start-2 row-start-2 mt-0.25 self-start text-right text-[0.64rem] leading-4 ${rowTimestampClass}`}>
          updated {formatRelativeTime(notification.updated_at)}
        </p>
      </div>
    </a>
  );
}

function GitHubItemIcon({
  kind,
  state,
  isDraft = false
}: {
  kind: 'pull-request' | 'issue' | 'commit' | 'discussion'
  state?: GitHubPullRequestState
  isDraft?: boolean
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

  if (kind === 'pull-request' && state === 'closed') {
    return (
      <svg
        viewBox="0 0 16 16"
        aria-hidden="true"
        className="h-4 w-4 flex-none text-rose-400"
        fill="currentColor"
      >
        <path d="M3.25 1A2.25 2.25 0 0 1 4 5.372v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.251 2.251 0 0 1 3.25 1Zm9.5 5.5a.75.75 0 0 1 .75.75v3.378a2.251 2.251 0 1 1-1.5 0V7.25a.75.75 0 0 1 .75-.75Zm-2.03-5.273a.75.75 0 0 1 1.06 0l.97.97.97-.97a.748.748 0 0 1 1.265.332.75.75 0 0 1-.205.729l-.97.97.97.97a.751.751 0 0 1-.018 1.042.751.751 0 0 1-1.042.018l-.97-.97-.97.97a.749.749 0 0 1-1.275-.326.749.749 0 0 1 .215-.734l.97-.97-.97-.97a.75.75 0 0 1 0-1.06ZM2.5 3.25a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0ZM3.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm9.5 0a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Z" />
      </svg>
    );
  }

  if (kind === 'pull-request' && state === 'merged') {
    return (
      <svg
        viewBox="0 0 16 16"
        aria-hidden="true"
        className="h-4 w-4 flex-none text-violet-400"
        fill="currentColor"
      >
        <path d="M5.45 5.154A4.25 4.25 0 0 0 9.25 7.5h1.378a2.251 2.251 0 1 1 0 1.5H9.25A5.734 5.734 0 0 1 5 7.123v3.505a2.25 2.25 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.95-.218ZM4.25 13.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm8.5-4.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM5 3.25a.75.75 0 1 0 0 .005V3.25Z" />
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
  tone
}: {
  label: string;
  tone: 'default' | 'green' | 'red' | 'yellow' | 'gray';
}) {
  const toneClass = {
    default: 'bg-white/[0.05] text-white/50',
    green: 'bg-emerald-400/16 text-emerald-100',
    red: 'bg-rose-400/16 text-rose-100',
    yellow: 'bg-amber-400/16 text-amber-100',
    gray: 'bg-white/[0.045] text-white/42'
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

function getGitHubViewContent(
  activeGitHubView: ActiveGitHubView,
  data: GitHubDashboardData,
  notifications: GitHubNotification[],
  myOpenPRs: GitHubPullRequestItem[],
  reviewRequestedPRs: GitHubPullRequestItem[]
) {
  if (activeGitHubView === 'notifications') {
    return {
      count: notifications.length,
      countLabel: `${notifications.length} notifications`,
      itemLabel: 'notifications',
      emptyMessage:
        data.connectionStatus === 'connected'
          ? 'No notifications right now.'
          : getEmptyListMessage(data),
      items: notifications.map((notification) => ({
        kind: 'notification' as const,
        key: notification.id,
        owner: getOwnerFromRepositoryName(notification.repository.full_name),
        repositoryName: notification.repository.full_name,
        title: notification.subject.title,
        updatedAt: notification.updated_at,
        value: notification
      }))
    };
  }

  if (activeGitHubView === 'review') {
    return {
      count: data.reviewRequestedCount,
      countLabel: `${data.reviewRequestedCount} review requests`,
      itemLabel: 'PRs',
      emptyMessage: data.connectionStatus === 'connected' ? 'No pull requests need your review.' : getEmptyListMessage(data),
      items: reviewRequestedPRs.map((pullRequest) => mapPullRequestViewItem(pullRequest))
    };
  }

  return {
    count: data.openPrsCount,
    countLabel: `${data.openPrsCount} open PRs`,
    itemLabel: 'PRs',
    emptyMessage: getEmptyListMessage(data),
    items: myOpenPRs.map((pullRequest) => mapPullRequestViewItem(pullRequest))
  };
}

function mapPullRequestViewItem(pullRequest: GitHubPullRequestItem): GitHubViewItem {
  return {
    kind: 'pull-request',
    key: pullRequest.url,
    owner: getOwnerFromRepositoryName(pullRequest.repositoryName),
    repositoryName: pullRequest.repositoryName,
    title: pullRequest.title,
    updatedAt: pullRequest.updatedAt,
    value: pullRequest
  };
}

function getOwnerFromRepositoryName(repositoryName: string) {
  return repositoryName.split('/')[0] ?? '';
}

function getRepositoryLabel(repositoryName: string) {
  const segments = repositoryName.split('/');
  return segments[segments.length - 1] ?? repositoryName;
}

function filterGitHubItems(items: GitHubViewItem[], organizationFilter: string) {
  if (organizationFilter === 'all') {
    return items;
  }

  return items.filter((item) => item.owner === organizationFilter);
}

function filterGitHubPullRequests(
  pullRequests: GitHubPullRequestItem[],
  organizationFilter: string,
  prStatusFilter: GitHubPrStatusFilter = 'all'
) {
  const organizationFilteredPullRequests =
    organizationFilter === 'all'
      ? pullRequests
      : pullRequests.filter((pullRequest) => pullRequest.owner === organizationFilter);

  if (prStatusFilter === 'approved') {
    return organizationFilteredPullRequests.filter((pullRequest) => pullRequest.reviewStatus === 'approved');
  }

  if (prStatusFilter === 'ready-to-merge') {
    return organizationFilteredPullRequests.filter((pullRequest) => isPullRequestReadyToClose(pullRequest));
  }

  if (prStatusFilter === 'waiting-review') {
    return organizationFilteredPullRequests.filter(
      (pullRequest) =>
        pullRequest.reviewStatus === 'waiting-review' || pullRequest.reviewStatus === 'changes-requested'
    );
  }

  return organizationFilteredPullRequests;
}

function sortGitHubItems(items: GitHubViewItem[], sortOrder: GitHubListSort) {
  const sortedItems = [...items];

  sortedItems.sort((left, right) => {
    if (sortOrder === 'oldest-updated') {
      return new Date(left.updatedAt).getTime() - new Date(right.updatedAt).getTime();
    }

    if (sortOrder === 'repository-asc') {
      return left.repositoryName.localeCompare(right.repositoryName);
    }

    if (sortOrder === 'title-asc') {
      return left.title.localeCompare(right.title);
    }

    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
  });

  return sortedItems;
}

function getNoFilterResultsMessage(itemLabel: string) {
  return `No ${itemLabel} match the current filters.`;
}

function formatCount(value: number, isLoading: boolean) {
  if (isLoading) {
    return '...';
  }

  return String(value);
}

function formatReason(reason: string) {
  return reason.replace(/-/g, ' ');
}

function shouldDisplayNotification(notification: GitHubNotification) {
  return notification.subject.type === 'PullRequest';
}

function getNotificationTypeLabel(notification: GitHubNotification) {
  if (notification.reason === 'review_requested') {
    return 'Review requested';
  }

  return formatReason(notification.reason);
}

function getNotificationIconKind(subjectType: string): 'pull-request' | 'issue' | 'commit' | 'discussion' {
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

function getPullRequestIdentityFromNotification(notification: GitHubNotification) {
  if (!notification.subject.url) {
    return null;
  }

  const apiPath = notification.subject.url.replace('https://api.github.com/repos/', '');
  const [owner, repo, resource, pullNumber] = apiPath.split('/');

  if (resource !== 'pulls' || !owner || !repo || !pullNumber) {
    return null;
  }

  return {
    owner,
    repo,
    pullNumber: Number(pullNumber)
  };
}

function getPullRequestIdentityKey(pullRequestIdentity: {
  owner: string;
  repo: string;
  pullNumber: number;
}) {
  return `${pullRequestIdentity.owner}/${pullRequestIdentity.repo}#${pullRequestIdentity.pullNumber}`;
}

function getNotificationUrl(notification: GitHubNotification) {
  if (notification.subject.url) {
    const apiPath = notification.subject.url.replace('https://api.github.com/repos/', '');
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

function getGitHubPullRequestAttentionStateKey(pullRequest: GitHubPullRequestItem) {
  return `${pullRequest.repositoryName}#${pullRequest.pullNumber}`;
}

const githubPrWarningCases = [
  {
    key: 'has-conflicts',
    label: 'Has conflicts',
    predicate: (pullRequest: GitHubPullRequestItem) => pullRequest.mergeStateStatus === 'DIRTY'
  },
  {
    key: 'failed-checks',
    label: 'Failed checks',
    predicate: (pullRequest: GitHubPullRequestItem) => pullRequest.ciStatus === 'failing'
  },
  {
    key: 'out-of-date',
    label: 'Out of date',
    predicate: (pullRequest: GitHubPullRequestItem) => isPullRequestOutOfDate(pullRequest)
  }
] as const;

function getGitHubPullRequestWarningStateKey(pullRequest: GitHubPullRequestItem) {
  return getGitHubPullRequestAttentionStateKey(pullRequest);
}

function getActiveGitHubPrWarningCaseKeys(pullRequest: GitHubPullRequestItem) {
  return githubPrWarningCases
    .filter((warningCase) => warningCase.predicate(pullRequest))
    .map((warningCase) => warningCase.key);
}

function buildGitHubPrWarningState(
  currentState: GitHubPrWarningState,
  pullRequests: GitHubPullRequestItem[]
): GitHubPrWarningState {
  const nextState: GitHubPrWarningState = {};
  const updatedAt = Date.now();

  for (const pullRequest of pullRequests) {
    const warningStateKey = getGitHubPullRequestWarningStateKey(pullRequest);
    const activeCaseKeys = getActiveGitHubPrWarningCaseKeys(pullRequest);
    const currentEntry = currentState[warningStateKey];
    const hasNewWarningTransition =
      Boolean(currentEntry) && currentEntry.activeCaseKeys.length === 0 && activeCaseKeys.length > 0;

    nextState[warningStateKey] = {
      activeCaseKeys,
      highlighted:
        activeCaseKeys.length > 0 ? (hasNewWarningTransition ? true : currentEntry?.highlighted ?? false) : false,
      updatedAt
    };
  }

  return nextState;
}

function isGitHubPrWarningHighlighted(state: GitHubPrWarningState, pullRequest: GitHubPullRequestItem) {
  return Boolean(state[getGitHubPullRequestWarningStateKey(pullRequest)]?.highlighted);
}

function buildGitHubPrReadyState(
  currentState: GitHubPrReadyState,
  pullRequests: GitHubPullRequestItem[]
): GitHubPrReadyState {
  const nextState: GitHubPrReadyState = {};
  const updatedAt = Date.now();

  for (const pullRequest of pullRequests) {
    const readyStateKey = getGitHubPullRequestAttentionStateKey(pullRequest);
    const isReady = isPullRequestReadyToClose(pullRequest);
    const currentEntry = currentState[readyStateKey];
    const hasNewReadyTransition = Boolean(currentEntry) && !currentEntry.isReady && isReady;

    nextState[readyStateKey] = {
      isReady,
      highlighted: isReady ? (hasNewReadyTransition ? true : currentEntry?.highlighted ?? false) : false,
      updatedAt
    };
  }

  return nextState;
}

function isGitHubPrReadyHighlighted(state: GitHubPrReadyState, pullRequest: GitHubPullRequestItem) {
  return Boolean(state[getGitHubPullRequestAttentionStateKey(pullRequest)]?.highlighted);
}

function areGitHubPrReadyStatesEqual(left: GitHubPrReadyState, right: GitHubPrReadyState) {
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

function areGitHubPrWarningStatesEqual(left: GitHubPrWarningState, right: GitHubPrWarningState) {
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
      if (leftEntry.activeCaseKeys[index] !== rightEntry.activeCaseKeys[index]) {
        return false;
      }
    }
  }

  return true;
}

function getCompactReviewStatusLabel(reviewStatus: GitHubPullRequestItem['reviewStatus']) {
  if (reviewStatus === 'approved') {
    return 'APPROVED';
  }

  if (reviewStatus === 'changes-requested') {
    return 'CHANGES REQUESTED';
  }

  if (reviewStatus === 'draft') {
    return 'DRAFT';
  }

  if (reviewStatus === 'open') {
    return 'OPEN';
  }

  return 'WAITING FOR REVIEW';
}

function getPullRequestDisplayStatus(pullRequest: GitHubPullRequestItem) {
  if (isPullRequestQueued(pullRequest)) {
    return {
      label: 'QUEUED'
    };
  }

  if (isPullRequestReadyToClose(pullRequest)) {
    return {
      label: 'READY TO MERGE'
    };
  }

  if (pullRequest.reviewStatus === 'approved') {
    return {
      label: 'APPROVED'
    };
  }

  if (pullRequest.reviewStatus === 'waiting-review') {
    return {
      label: 'WAITING FOR REVIEW'
    };
  }

  if (pullRequest.reviewStatus === 'changes-requested') {
    return {
      label: 'CHANGES REQUESTED'
    };
  }

  if (pullRequest.reviewStatus === 'draft') {
    return {
      label: 'DRAFT'
    };
  }

  return {
    label: getCompactReviewStatusLabel(pullRequest.reviewStatus)
  };
}

function isPullRequestReadyToClose(pullRequest: GitHubPullRequestItem) {
  return (
    !isPullRequestQueued(pullRequest) &&
    pullRequest.reviewStatus === 'approved' &&
    pullRequest.ciStatus === 'passing' &&
    !isPullRequestOutOfDate(pullRequest) &&
    pullRequest.mergeStateStatus === 'CLEAN'
  );
}

function isPullRequestQueued(pullRequest: GitHubPullRequestItem) {
  return Boolean(pullRequest.mergeQueueEntry);
}

function isPullRequestOutOfDate(pullRequest: GitHubPullRequestItem) {
  return pullRequest.mergeStateStatus === 'BEHIND';
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
