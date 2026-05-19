import { type KeyboardEvent, type MouseEvent, ReactNode, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  GitHubConnectionStatus,
  GitHubDashboardData,
  GitHubPullRequestItem,
} from '../lib/githubApi';
import {
  formatCount,
  getNoFilterResultsMessage,
  getRepositoryLabel,
  mapPullRequestToHiddenRepository,
  mapPullRequestToFocusItem,
} from '../lib/githubCardDomain';
import {
  getGitHubCardPullRequestGroups,
  getGitHubCardViewModel,
} from '../lib/githubCardViewModel';
import { formatRelativeTime } from '../lib/date';
import {
  getGitHubPullRequestAttentionStateKey,
  getPullRequestDisplayStatus,
  isGitHubPrReadyHighlighted,
  isGitHubPrWarningHighlighted,
  isPullRequestOutOfDate,
  isPullRequestQueued,
  isPullRequestReadyToMerge,
} from '../lib/githubDomain';
import {
  type ActiveGitHubView,
  type GitHubHiddenRepository,
  type GitHubPrReadyState,
  type GitHubTeamPrTrackerState,
  type GitHubPrWarningState,
  type GitHubPrStatusFilter,
  type GitHubListSort,
} from '../lib/storage';
import type { TodayFocusPullRequestRanks } from '../lib/todayFocusPriority';
import { useGitHubCardState } from '../hooks/useGitHubCardState';
import { CardTabMenu } from './CardTabMenu';
import { CardShell } from './CardShell';
import { GitHubCardListItemSkeleton } from './GitHubCardSkeleton';
import {
  GitHubItemIcon,
  PullRequestCheckStatusIcon,
  PullRequestQueueIcon,
  PullRequestReadyToMergeIcon,
} from './GitHubPullRequestIcons';
import { PullRequestCommentBadge } from './PullRequestCommentBadge';
import { StatusBadge } from './StatusBadge';
import { TODAY_FOCUS_DRAG_MIME } from './SummaryCard';
import { TodayFocusIndicator } from './TodayFocusIndicator';

type GitHubCardProps = {
  topBar?: ReactNode;
  data: GitHubDashboardData;
  todayFocusPullRequestRanks: TodayFocusPullRequestRanks;
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
  todayFocusPullRequestRanks,
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
  const pullRequestGroups = getGitHubCardPullRequestGroups({
    data,
    username,
    ownerFilter,
    hiddenRepositories,
    isMockMode,
  });
  const {
    sortOrder,
    setSortOrder,
    gitHubPrReadyState,
    gitHubPrWarningState,
    gitHubPrNotificationSeenAtState,
    hasLoadedGitHubPrNotificationSeenAtState,
    gitHubTeamPrTrackerState,
    hasLoadedGitHubTeamPrTrackerState,
    handleMarkPullRequestNotificationsSeen,
    handleMarkTeamPrSeen,
    handleClearWarningHighlight,
  } = useGitHubCardState({
    connectionStatus: data.connectionStatus,
    isLoading,
    lastUpdatedAt: data.lastUpdatedAt,
    resolvedPullRequests: pullRequestGroups.resolvedPullRequests,
    visibleRecentOpenPullRequests:
      pullRequestGroups.visibleRecentOpenPullRequests,
  });
  const viewModel = getGitHubCardViewModel({
    data,
    groups: pullRequestGroups,
    activeView,
    prStatusFilter,
    sortOrder,
    hasLoadedNotificationSeenAtState:
      hasLoadedGitHubPrNotificationSeenAtState,
    notificationSeenAtState: gitHubPrNotificationSeenAtState,
    readyState: gitHubPrReadyState,
    warningState: gitHubPrWarningState,
  });
  const tabItems = [
    {
      key: 'my-prs',
      label: 'My PRs',
      value: formatCount(viewModel.filteredMyOpenPullRequestCount, isLoading),
      isActive: activeView === 'my-prs',
      title: isLoading
        ? undefined
        : `${viewModel.filteredMyOpenPullRequestCount} of ${pullRequestGroups.myOpenPullRequests.length} PRs`,
      onClick: () => onViewChange('my-prs'),
    },
    {
      key: 'team-prs',
      label: 'Team PRs',
      value: formatCount(
        viewModel.filteredRecentOpenPullRequestCount,
        isLoading,
      ),
      isActive: activeView === 'team-prs',
      title: isLoading
        ? undefined
        : `${viewModel.filteredRecentOpenPullRequestCount} of ${pullRequestGroups.recentOpenPullRequests.length} PRs`,
      onClick: () => onViewChange('team-prs'),
    },
    {
      key: 'review',
      label: 'Review',
      value: formatCount(
        viewModel.filteredReviewRequestedPullRequestCount,
        isLoading,
      ),
      isActive: activeView === 'review',
      onClick: () => onViewChange('review'),
    },
  ];

  useEffect(() => {
    onSummaryMetricsChange({
      connectionStatus: data.connectionStatus,
      missingUsername: data.missingUsername,
      openTeamPrCount: gitHubTeamPrTrackerState.pendingNewKeys.length,
      readyToMergeCount: viewModel.summaryCounts.readyToMergeCount,
      failedBuildCount: viewModel.summaryCounts.failedBuildCount,
      failedBuildBadgeCount: viewModel.summaryCounts.failedBuildBadgeCount,
      highlightedCommentCount: viewModel.summaryCounts.highlightedCommentCount,
      highlightedReadyCount: viewModel.summaryCounts.highlightedReadyCount,
      highlightedWarningCount: viewModel.summaryCounts.highlightedWarningCount,
      reviewRequestedCount: viewModel.summaryCounts.reviewRequestedCount,
      approvedPrCount: viewModel.summaryCounts.approvedPrCount,
      relevantPrCount: viewModel.summaryCounts.relevantPrCount,
    });
  }, [
    data.connectionStatus,
    data.missingUsername,
    gitHubTeamPrTrackerState.pendingNewKeys.length,
    viewModel.summaryCounts.readyToMergeCount,
    viewModel.summaryCounts.failedBuildCount,
    viewModel.summaryCounts.failedBuildBadgeCount,
    viewModel.summaryCounts.highlightedCommentCount,
    viewModel.summaryCounts.highlightedReadyCount,
    viewModel.summaryCounts.highlightedWarningCount,
    viewModel.summaryCounts.reviewRequestedCount,
    viewModel.summaryCounts.approvedPrCount,
    viewModel.summaryCounts.relevantPrCount,
    onSummaryMetricsChange,
  ]);

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
                  <GitHubCardListItemSkeleton key={index} />
                ))}
              </div>
            ) : viewModel.filteredItems.length === 0 ? (
              <div className="rounded-[14px] bg-[var(--card-bg-soft)] px-4 py-5 text-sm text-secondary shadow-[var(--shadow-card-soft)]">
                {viewModel.currentView.items.length === 0
                  ? viewModel.currentView.emptyMessage
                  : getNoFilterResultsMessage(viewModel.currentView.itemLabel)}
              </div>
          ) : (
              <PullRequestList
                pullRequests={viewModel.filteredItems.map((item) => item.value)}
                todayFocusPullRequestRanks={todayFocusPullRequestRanks}
                activeView={activeView}
                gitHubPrReadyState={gitHubPrReadyState}
                gitHubPrWarningState={gitHubPrWarningState}
                gitHubTeamPrTrackerState={gitHubTeamPrTrackerState}
                hasLoadedGitHubTeamPrTrackerState={
                  hasLoadedGitHubTeamPrTrackerState
                }
                pullRequestNewCommentCountByKey={
                  viewModel.pullRequestNewCommentCountByKey
                }
            onMarkNotificationsSeen={handleMarkPullRequestNotificationsSeen}
            onMarkTeamPrSeen={handleMarkTeamPrSeen}
            onClearWarningHighlight={handleClearWarningHighlight}
            onHideRepository={onHideRepository}
          />
            )}
          </div>
          {!isLoading &&
          ((activeView === 'my-prs' && username.trim()) ||
            activeView === 'team-prs') ? (
            <div className="mt-3 flex items-center justify-between gap-3">
              {activeView === 'team-prs' ? (
                <Link
                  to="/settings#hidden-repositories"
                  className="text-sm text-secondary transition hover:text-primary"
                >
                  Hidden repos
                </Link>
              ) : (
                <span />
              )}
              <a
                href={
                  activeView === 'my-prs'
                    ? pullRequestGroups.myPrsViewAllUrl
                    : pullRequestGroups.recentPrsViewAllUrl
                }
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-secondary transition hover:text-primary"
              >
                {activeView === 'my-prs' ? 'View my PRs →' : 'View team PRs →'}
              </a>
            </div>
          ) : null}
        </div>
      </div>
    </CardShell>
  );
}

function PullRequestRow({
  pullRequest,
  activeView,
  newNotificationCount,
  isNewTeamPr = false,
  todayFocusRank,
  todayFocusTotalRanks,
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
  todayFocusRank?: number;
  todayFocusTotalRanks: number;
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
  const markPullRequestSeen = () => {
    onMarkNotificationsSeen?.(pullRequest);
    if (activeView === 'team-prs') {
      onMarkTeamPrSeen?.(pullRequest);
    }
    onClearWarningHighlight?.(pullRequest);
  };

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
      onClick={markPullRequestSeen}
      onAuxClick={(event) => {
        if (event.button === 1) {
          markPullRequestSeen();
        }
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
              {typeof todayFocusRank === 'number' ? (
                <TodayFocusIndicator
                  rank={todayFocusRank}
                  totalRanks={todayFocusTotalRanks}
                  className="font-semibold"
                />
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

function PullRequestList({
  pullRequests,
  todayFocusPullRequestRanks,
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
  todayFocusPullRequestRanks: TodayFocusPullRequestRanks;
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
            todayFocusRank={todayFocusPullRequestRanks.ranks.get(
              mapPullRequestToFocusItem(pullRequest).id,
            )}
            todayFocusTotalRanks={todayFocusPullRequestRanks.totalRanks}
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
          todayFocusRank={todayFocusPullRequestRanks.ranks.get(
            mapPullRequestToFocusItem(pullRequest).id,
          )}
          todayFocusTotalRanks={todayFocusPullRequestRanks.totalRanks}
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
              todayFocusRank={todayFocusPullRequestRanks.ranks.get(
                mapPullRequestToFocusItem(pullRequest).id,
              )}
              todayFocusTotalRanks={todayFocusPullRequestRanks.totalRanks}
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
