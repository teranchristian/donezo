import { ReactNode, useEffect, useState } from 'react';
import {
  GitHubConnectionStatus,
  GitHubDashboardData,
  GitHubNotification,
  GitHubPullRequestItem,
  getGitHubPullRequestState,
  type GitHubPullRequestState
} from '../lib/githubApi';
import { type FocusItem } from '../lib/storage';
import { formatRelativeTime } from '../lib/date';
import {
  getStoredGitHubOwnerFilter,
  getStoredGitHubSortOrder,
  saveStoredGitHubOwnerFilter,
  saveStoredGitHubSortOrder,
  type ActiveGitHubView,
  type GitHubPrStatusFilter,
  type GitHubListSort
} from '../lib/storage';
import { CardTabMenu } from './CardTabMenu';
import { CardShell } from './CardShell';
import { TODAY_FOCUS_DRAG_MIME } from './SummaryCard';

type GitHubCardProps = {
  topBar?: ReactNode;
  data: GitHubDashboardData;
  username: string;
  token: string;
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
  username,
  token,
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
    'flex h-10 min-w-0 items-center gap-1.5 rounded-[8px] border border-white/[0.06] bg-[#121820] px-3 text-[0.82rem] text-white/46 shadow-[inset_0_1px_0_rgba(255,255,255,0.015)]';
  const filterSelectClass = 'min-w-0 bg-transparent pr-5 text-[0.82rem] text-white/78 outline-none';
  const [organizationFilter, setOrganizationFilter] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<GitHubListSort>('recently-updated');
  const [hasLoadedOwnerFilter, setHasLoadedOwnerFilter] = useState(false);
  const [hasLoadedSortOrder, setHasLoadedSortOrder] = useState(false);
  const [notificationPullRequestStates, setNotificationPullRequestStates] = useState<
    Record<string, GitHubPullRequestState>
  >({});
  const resolvedPullRequests = data.pullRequests;
  const myOpenPRs = resolvedPullRequests.filter((pullRequest) => pullRequest.source === 'authored');
  const reviewRequestedPRs = resolvedPullRequests.filter(
    (pullRequest) => pullRequest.source === 'review-requested'
  );
  const notifications = (data.notifications ?? []).filter(shouldDisplayNotification);
  const viewAllUrl = `https://github.com/pulls?q=${encodeURIComponent(`is:pr is:open author:${username.trim()}`)}`;
  const ownerOptions = getOwnerOptions(data, username, organizationFilter);
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
  const summaryApprovedPrCount = ownerFilteredMyOpenPRs.filter(
    (pullRequest) => pullRequest.reviewStatus === 'approved'
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
      value: formatCount(filteredNotificationCount, isLoading),
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

    getStoredGitHubOwnerFilter().then((storedOwnerFilter) => {
      if (!isMounted) {
        return;
      }

      setOrganizationFilter(storedOwnerFilter);
      setHasLoadedOwnerFilter(true);
    });

    getStoredGitHubSortOrder().then((storedSortOrder) => {
      if (!isMounted) {
        return;
      }

      setSortOrder(storedSortOrder);
      setHasLoadedSortOrder(true);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!hasLoadedOwnerFilter) {
      return;
    }

    void saveStoredGitHubOwnerFilter(organizationFilter);
  }, [hasLoadedOwnerFilter, organizationFilter]);

  useEffect(() => {
    if (!hasLoadedSortOrder) {
      return;
    }

    void saveStoredGitHubSortOrder(sortOrder);
  }, [hasLoadedSortOrder, sortOrder]);

  useEffect(() => {
    const activeNotificationIds = new Set((data.notifications ?? []).map((notification) => notification.id));

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
      reviewRequestedCount: summaryReviewRequestedCount,
      approvedPrCount: summaryApprovedPrCount,
      relevantPrCount: summaryMyOpenPrCount + summaryReviewRequestedCount
    });
  }, [
    data.connectionStatus,
    data.missingUsername,
    summaryApprovedPrCount,
    summaryMyOpenPrCount,
    summaryReviewRequestedCount,
    onSummaryMetricsChange
  ]);

  useEffect(() => {
    if (!token.trim() || visiblePullRequestNotifications.length === 0) {
      return;
    }

    let isCancelled = false;

    Promise.all(
      visiblePullRequestNotifications.map(async (notification) => {
        const pullRequestIdentity = getPullRequestIdentityFromNotification(notification);
        if (!pullRequestIdentity) {
          return null;
        }

        try {
          const state = await getGitHubPullRequestState({
            ...pullRequestIdentity,
            token
          });

          return { id: notification.id, state };
        } catch {
          return { id: notification.id, state: 'closed' as const };
        }
      })
    ).then((results) => {
      if (isCancelled) {
        return;
      }

      setNotificationPullRequestStates((currentEntries) => {
        const nextEntries = { ...currentEntries };

        for (const result of results) {
          if (result) {
            nextEntries[result.id] = result.state;
          }
        }

        return nextEntries;
      });
    });

    return () => {
      isCancelled = true;
    };
  }, [token, visibleNotificationPullRequestKey]);

  return (
    <CardShell className="flex h-full w-full min-w-0 flex-1 flex-col overflow-hidden">
      <div className="flex min-h-[720px] flex-1 flex-col">
        {topBar ? (
          <div className="-mx-5 -mt-4 mb-2 border-b border-white/[0.04] px-5 py-4">
            {topBar}
          </div>
        ) : null}

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="mb-2 flex min-w-0 items-end justify-between gap-3 overflow-hidden border-b border-white/[0.05]">
            <div className="min-w-0 flex-1">
              <CardTabMenu items={tabItems} className="border-b-0 pb-0.5" />
            </div>
            <div className="flex shrink-0 items-center gap-2 pb-2">
              <label className={`${filterControlClass} w-[188px]`}>
                <span className="shrink-0 text-[var(--text-tertiary)]">Owner:</span>
                <select
                  aria-label="Owner"
                  value={organizationFilter}
                  onChange={(event) => setOrganizationFilter(event.target.value)}
                  className={`${filterSelectClass} flex-1`}
                >
                  {ownerOptions.map((option) => (
                    <option key={option.value} value={option.value} className="bg-panel text-stone-100">
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              {activeView === 'prs' ? (
                <label className={`${filterControlClass} w-[168px]`}>
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
                    <option value="waiting-review" className="bg-panel text-stone-100">
                      Waiting review
                    </option>
                  </select>
                </label>
              ) : null}

              <label className={`${filterControlClass} w-[220px]`}>
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

          <div className="dashboard-scrollbar min-h-[320px] max-h-[420px] flex-1 overflow-y-auto pr-1">
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, index) => (
                  <ListItemSkeleton key={index} />
                ))}
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="rounded-[14px] bg-[var(--card-bg-soft)] px-4 py-5 text-sm text-secondary shadow-[var(--shadow-card-soft)]">
                {currentView.items.length === 0 ? currentView.emptyMessage : getNoFilterResultsMessage(currentView.itemLabel)}
              </div>
            ) : (
              <div className="divide-y divide-white/[0.06]">
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
}: {
  pullRequest: GitHubPullRequestItem;
}) {
  const reviewStatusLabel = getCompactReviewStatusLabel(pullRequest.reviewStatus);
  const detailItems = [
    pullRequest.repositoryName,
    `opened ${formatRelativeTime(pullRequest.updatedAt)}`,
    pullRequest.authorLogin ? `by ${pullRequest.authorLogin}` : '',
    reviewStatusLabel
  ].filter(Boolean);

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
      className="group -mx-2 block cursor-pointer px-2 py-2 transition hover:bg-white/[0.03]"
    >
      <div className="flex items-start gap-2">
        <GitHubItemIcon kind="pull-request" />
        <div className="min-w-0 flex-1">
          <div className="inline-flex max-w-full items-start gap-1.5 align-top">
            <p className="line-clamp-2 min-w-0 text-[0.78rem] font-medium leading-4.5 text-primary transition group-hover:text-white">
              {pullRequest.title}
            </p>
            <PullRequestCheckStatusIcon ciStatus={pullRequest.ciStatus} />
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.68rem] text-white/42">
            {detailItems.map((item, index) => (
              <span key={`${item}-${index}`} className="min-w-0 truncate">
                {index > 0 ? <span className="mr-2 text-white/22">•</span> : null}
                <span title={item}>{item}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </a>
  );
}

function mapPullRequestToFocusItem(pullRequest: GitHubPullRequestItem): FocusItem {
  return {
    id: `github:${pullRequest.repositoryName}#${pullRequest.pullNumber}`,
    source: 'github',
    sourceLabel: 'GitHub',
    reference: `#${pullRequest.pullNumber}`,
    title: pullRequest.title,
    statusLabel: getFocusStatusLabel(pullRequest.reviewStatus),
    statusTone: getFocusStatusTone(pullRequest.reviewStatus)
  };
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
    return <span className="shrink-0 text-sm leading-none text-rose-400">✕</span>;
  }

  if (ciStatus === 'pending') {
    return <span className="shrink-0 text-sm leading-none text-amber-400">●</span>;
  }

  return null;
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

  return (
    <a
      href={getNotificationUrl(notification)}
      target="_blank"
      rel="noreferrer"
      className="group -mx-2 block cursor-pointer px-2 py-2 transition hover:bg-white/[0.03]"
    >
      <div className="flex items-start gap-2">
        <GitHubItemIcon
          kind={iconKind}
          state={iconKind === 'pull-request' ? pullRequestState : undefined}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <p className="line-clamp-2 min-w-0 flex-1 text-[0.78rem] font-medium leading-4.5 text-primary transition group-hover:text-white">
              {notification.subject.title}
            </p>
            <p className="shrink-0 pt-0.5 text-[0.62rem] font-medium uppercase tracking-[0.14em] text-white/36">
              {notificationTypeLabel}
            </p>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.68rem] text-white/42">
            <span>{notification.repository.full_name}</span>
            <span className="text-white/22">•</span>
            <span>updated {formatRelativeTime(notification.updated_at)}</span>
          </div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <Badge label={notification.reason} tone="gray" />
            {notification.unread ? <Badge label="Unread" tone="green" /> : null}
          </div>
        </div>
      </div>
    </a>
  );
}

function GitHubItemIcon({
  kind,
  state
}: {
  kind: 'pull-request' | 'issue' | 'commit' | 'discussion'
  state?: GitHubPullRequestState
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
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[0.65rem] uppercase tracking-[0.18em] ${toneClass}`}
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

function getOwnerOptions(data: GitHubDashboardData, username: string, selectedOwner: string) {
  const owners = new Set<string>();

  for (const pullRequest of data.pullRequests) {
    owners.add(getOwnerFromRepositoryName(pullRequest.repositoryName));
  }

  for (const notification of data.notifications ?? []) {
    owners.add(getOwnerFromRepositoryName(notification.repository.full_name));
  }

  const trimmedUsername = username.trim();
  const sortedOwners = [...owners].filter(Boolean).sort((left, right) => left.localeCompare(right));
  const options = [{ value: 'all', label: 'All' }];

  if (trimmedUsername) {
    options.push({ value: trimmedUsername, label: trimmedUsername });
  }

  for (const owner of sortedOwners) {
    if (owner !== trimmedUsername) {
      options.push({ value: owner, label: owner });
    }
  }

  if (
    selectedOwner !== 'all' &&
    selectedOwner.trim() &&
    !options.some((option) => option.value === selectedOwner)
  ) {
    options.push({ value: selectedOwner, label: selectedOwner });
  }

  return options;
}

function getOwnerFromRepositoryName(repositoryName: string) {
  return repositoryName.split('/')[0] ?? '';
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

function getCompactReviewStatusLabel(reviewStatus: GitHubPullRequestItem['reviewStatus']) {
  if (reviewStatus === 'approved') {
    return 'Approved';
  }

  if (reviewStatus === 'changes-requested') {
    return 'Changes requested';
  }

  if (reviewStatus === 'draft') {
    return 'Draft';
  }

  if (reviewStatus === 'open') {
    return 'Open';
  }

  return 'Waiting for review';
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
