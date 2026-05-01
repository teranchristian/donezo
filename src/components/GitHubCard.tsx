import { useEffect, useState } from 'react';
import {
  GitHubConnectionStatus,
  GitHubDashboardData,
  GitHubNotification,
  GitHubPullRequestItem,
  enrichGitHubPullRequests,
  getGitHubPullRequestState,
  type GitHubPullRequestState
} from '../lib/githubApi';
import {
  getStoredActiveGitHubView,
  getStoredGitHubOwnerFilter,
  getStoredGitHubPrStatusFilter,
  getStoredGitHubSortOrder,
  saveStoredActiveGitHubView,
  saveStoredGitHubOwnerFilter,
  saveStoredGitHubPrStatusFilter,
  saveStoredGitHubSortOrder,
  type ActiveGitHubView,
  type GitHubPrStatusFilter,
  type GitHubListSort
} from '../lib/storage';
import { CardShell } from './CardShell';
import { TabButton } from './TabButton';

type GitHubCardProps = {
  data: GitHubDashboardData;
  username: string;
  token: string;
  isLoading: boolean;
  isCheckingActivity: boolean;
  lastActivityCheckAt: number | null;
  onRefresh: () => void;
  onSummaryMetricsChange: (metrics: GitHubSummaryMetrics) => void;
  navigationTarget?: {
    view: ActiveGitHubView;
    prStatusFilter: GitHubPrStatusFilter;
    nonce: number;
  } | null;
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
    tone: 'border-white/10 bg-white/5 text-stone-300',
    message: 'Add a personal access token in Settings to enable GitHub integration.'
  },
  testing: {
    label: 'Testing',
    tone: 'border-amber-300/20 bg-amber-200/10 text-amber-100',
    message: 'Checking the saved GitHub credentials.'
  },
  connected: {
    label: 'Connected',
    tone: 'border-emerald-300/20 bg-emerald-200/10 text-emerald-100',
    message: 'GitHub activity is live on the dashboard.'
  },
  invalid: {
    label: 'Invalid token',
    tone: 'border-rose-300/20 bg-rose-200/10 text-rose-100',
    message: 'GitHub returned 401 for the saved token. Update the token and test again.'
  },
  error: {
    label: 'Connection error',
    tone: 'border-amber-300/20 bg-amber-200/10 text-amber-100',
    message: 'GitHub data could not be loaded right now.'
  }
};

export function GitHubCard({
  data,
  username,
  token,
  isLoading,
  isCheckingActivity,
  lastActivityCheckAt,
  onRefresh,
  onSummaryMetricsChange,
  navigationTarget
}: GitHubCardProps) {
  const copy = STATUS_COPY[data.connectionStatus];
  const [activeGitHubView, setActiveGitHubView] = useState<ActiveGitHubView>('prs');
  const [organizationFilter, setOrganizationFilter] = useState<string>('all');
  const [prStatusFilter, setPrStatusFilter] = useState<GitHubPrStatusFilter>('all');
  const [sortOrder, setSortOrder] = useState<GitHubListSort>('recently-updated');
  const [hasLoadedActiveGitHubView, setHasLoadedActiveGitHubView] = useState(false);
  const [hasLoadedOwnerFilter, setHasLoadedOwnerFilter] = useState(false);
  const [hasLoadedPrStatusFilter, setHasLoadedPrStatusFilter] = useState(false);
  const [hasLoadedSortOrder, setHasLoadedSortOrder] = useState(false);
  const [enrichedPullRequestsByUrl, setEnrichedPullRequestsByUrl] = useState<
    Record<string, GitHubPullRequestItem>
  >({});
  const [notificationPullRequestStates, setNotificationPullRequestStates] = useState<
    Record<string, GitHubPullRequestState>
  >({});
  const resolvedPullRequests = data.pullRequests.map(
    (pullRequest) => enrichedPullRequestsByUrl[pullRequest.url] ?? pullRequest
  );
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
  const summaryApprovedPrCount = ownerFilteredMyOpenPRs.length > 0 && ownerFilteredMyOpenPRs.some((pullRequest) => !pullRequest.detailsLoaded)
    ? null
    : ownerFilteredMyOpenPRs.filter((pullRequest) => pullRequest.reviewStatus === 'approved').length;
  const currentView = getGitHubViewContent(
    activeGitHubView,
    data,
    notifications,
    filteredMyOpenPRs,
    reviewRequestedPRs
  );
  const filteredItems = sortGitHubItems(
    filterGitHubItems(currentView.items, organizationFilter),
    sortOrder
  );
  const visiblePullRequestsToEnrich = filteredItems
    .filter((item): item is Extract<GitHubViewItem, { kind: 'pull-request' }> => item.kind === 'pull-request')
    .map((item) => item.value)
    .filter((pullRequest) => !pullRequest.detailsLoaded);
  const filteredSummaryPullRequestsToEnrich = [...ownerFilteredMyOpenPRs, ...ownerFilteredReviewRequestedPRs].filter(
    (pullRequest) => !pullRequest.detailsLoaded
  );
  const pullRequestsToEnrich = Array.from(
    new Map(
      [...visiblePullRequestsToEnrich, ...filteredSummaryPullRequestsToEnrich].map((pullRequest) => [
        pullRequest.url,
        pullRequest
      ])
    ).values()
  );
  const visiblePullRequestKey = visiblePullRequestsToEnrich
    .map((pullRequest) => `${pullRequest.url}:${pullRequest.updatedAt}`)
    .join('|');
  const summaryPullRequestKey = filteredSummaryPullRequestsToEnrich
    .map((pullRequest) => `${pullRequest.url}:${pullRequest.updatedAt}`)
    .join('|');
  const visiblePullRequestNotifications = filteredItems
    .filter((item): item is Extract<GitHubViewItem, { kind: 'notification' }> => item.kind === 'notification')
    .map((item) => item.value)
    .filter((notification) => notification.subject.type === 'PullRequest')
    .filter((notification) => !notificationPullRequestStates[notification.id]);
  const visibleNotificationPullRequestKey = visiblePullRequestNotifications
    .map((notification) => notification.id)
    .join('|');

  useEffect(() => {
    let isMounted = true;

    getStoredActiveGitHubView().then((storedActiveGitHubView) => {
      if (!isMounted) {
        return;
      }

      setActiveGitHubView(storedActiveGitHubView);
      setHasLoadedActiveGitHubView(true);
    });

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

    getStoredGitHubPrStatusFilter().then((storedPrStatusFilter) => {
      if (!isMounted) {
        return;
      }

      setPrStatusFilter(storedPrStatusFilter);
      setHasLoadedPrStatusFilter(true);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!hasLoadedActiveGitHubView) {
      return;
    }

    void saveStoredActiveGitHubView(activeGitHubView);
  }, [activeGitHubView, hasLoadedActiveGitHubView]);

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
    if (!hasLoadedPrStatusFilter) {
      return;
    }

    void saveStoredGitHubPrStatusFilter(prStatusFilter);
  }, [hasLoadedPrStatusFilter, prStatusFilter]);

  useEffect(() => {
    if (!navigationTarget) {
      return;
    }

    setActiveGitHubView(navigationTarget.view);
    setPrStatusFilter(navigationTarget.prStatusFilter);
    setHasLoadedActiveGitHubView(true);
    setHasLoadedPrStatusFilter(true);
  }, [navigationTarget]);

  useEffect(() => {
    const activePullRequestUrls = new Set(data.pullRequests.map((pullRequest) => pullRequest.url));

    setEnrichedPullRequestsByUrl((currentEntries) => {
      const nextEntries = Object.fromEntries(
        Object.entries(currentEntries).filter(([url]) => activePullRequestUrls.has(url))
      );

      return Object.keys(nextEntries).length === Object.keys(currentEntries).length
        ? currentEntries
        : nextEntries;
    });
  }, [data.pullRequests]);

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
    if (!token.trim() || pullRequestsToEnrich.length === 0) {
      return;
    }

    let isCancelled = false;

    enrichGitHubPullRequests(pullRequestsToEnrich, token).then((enrichedPullRequests) => {
      if (isCancelled) {
        return;
      }

      setEnrichedPullRequestsByUrl((currentEntries) => {
        const nextEntries = { ...currentEntries };

        for (const pullRequest of enrichedPullRequests) {
          nextEntries[pullRequest.url] = pullRequest;
        }

        return nextEntries;
      });
    });

    return () => {
      isCancelled = true;
    };
  }, [token, visiblePullRequestKey, summaryPullRequestKey]);

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
        <div className="flex flex-col gap-3 border-b border-white/5 pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium uppercase tracking-[0.24em] text-stone-100">GitHub</p>
            <p className="mt-1 truncate text-sm text-stone-400">{username.trim() ? `@${username.trim()}` : 'Username not set'}</p>
          </div>

          <div className="flex flex-col items-start sm:items-end">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] ${copy.tone}`}>
                {copy.label}
              </span>
              <button
                type="button"
                onClick={onRefresh}
                disabled={isLoading}
                className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-stone-300 transition hover:border-white/20 hover:text-stone-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoading ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-stone-500 sm:justify-end">
              <span>Updated {formatCompactTime(data.lastUpdatedAt)}</span>
              <span className="text-stone-600">·</span>
              <span>Checked {formatCompactTime(lastActivityCheckAt)}</span>
              {isCheckingActivity ? <span className="text-stone-400">· Checking…</span> : null}
            </div>
          </div>
        </div>

        <div className="mt-4 flex min-h-0 flex-1 flex-col">
          <div className="mb-4 flex flex-wrap gap-2">
            <TabButton
              label="PRs"
              value={formatCount(filteredMyOpenPrCount, isLoading)}
              isActive={activeGitHubView === 'prs'}
              title={
                isLoading ? undefined : `${filteredMyOpenPrCount} of ${myOpenPrItems.length} PRs`
              }
              onClick={() => setActiveGitHubView('prs')}
            />
            <TabButton
              label="Notifications"
              value={formatCount(filteredNotificationCount, isLoading)}
              isActive={activeGitHubView === 'notifications'}
              onClick={() => setActiveGitHubView('notifications')}
            />
            <TabButton
              label="Review"
              value={formatCount(filteredReviewRequestedCount, isLoading)}
              isActive={activeGitHubView === 'review'}
              onClick={() => setActiveGitHubView('review')}
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm uppercase tracking-[0.28em] text-textSoft">{currentView.title}</p>
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <label className="flex min-w-0 items-center gap-2 rounded-full border border-white/10 bg-panel px-3 py-2 text-xs text-stone-300">
                <span className="shrink-0 text-stone-400">Owner:</span>
                <select
                  aria-label="Owner"
                  value={organizationFilter}
                  onChange={(event) => setOrganizationFilter(event.target.value)}
                  className="min-w-0 bg-transparent pr-5 text-xs text-stone-100 outline-none"
                >
                  {ownerOptions.map((option) => (
                    <option key={option.value} value={option.value} className="bg-panel text-stone-100">
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              {activeGitHubView === 'prs' ? (
                <label className="flex min-w-0 items-center gap-2 rounded-full border border-white/10 bg-panel px-3 py-2 text-xs text-stone-300">
                  <span className="shrink-0 text-stone-400">Status:</span>
                  <select
                    aria-label="PR status"
                    value={prStatusFilter}
                    onChange={(event) => setPrStatusFilter(event.target.value as GitHubPrStatusFilter)}
                    className="min-w-0 bg-transparent pr-5 text-xs text-stone-100 outline-none"
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

              <label className="flex min-w-0 items-center gap-2 rounded-full border border-white/10 bg-panel px-3 py-2 text-xs text-stone-300">
                <span className="shrink-0 text-stone-400">Sort:</span>
                <select
                  aria-label="Sort"
                  value={sortOrder}
                  onChange={(event) => setSortOrder(event.target.value as GitHubListSort)}
                  className="min-w-0 bg-transparent pr-5 text-xs text-stone-100 outline-none"
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
          <div className="dashboard-scrollbar mt-3 min-h-[320px] max-h-[420px] flex-1 overflow-y-auto pr-1">
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, index) => (
                  <ListItemSkeleton key={index} />
                ))}
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-black/10 px-4 py-5 text-sm text-stone-500">
                {currentView.items.length === 0 ? currentView.emptyMessage : getNoFilterResultsMessage(currentView.itemLabel)}
              </div>
            ) : (
              <div className="space-y-3">
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
                      username={username.trim()}
                    />
                  )
                )}
              </div>
            )}
          </div>
          {!isLoading && activeGitHubView === 'prs' && data.openPrsCount > 0 && username.trim() ? (
            <div className="mt-3 text-right">
              <a
                href={viewAllUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-indigo-400 transition hover:text-indigo-300"
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
  username
}: {
  pullRequest: GitHubPullRequestItem;
  username: string;
}) {
  const reviewStatusLabel = getCompactReviewStatusLabel(pullRequest.reviewStatus);

  return (
    <a
      href={pullRequest.url}
      target="_blank"
      rel="noreferrer"
      className="block rounded-2xl border border-white/5 bg-black/10 px-4 py-3 transition hover:border-white/15 hover:bg-black/20"
    >
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <GitHubItemIcon kind="pull-request" />
            <p className="truncate text-sm font-medium text-stone-100">{pullRequest.title}</p>
            <PullRequestCiIcon ciStatus={pullRequest.ciStatus} />
          </div>
          <p className="mt-2 truncate text-sm text-stone-400">
            {pullRequest.repositoryName} • opened {formatRelativeTime(pullRequest.updatedAt)}
            {username ? ` by ${username}` : ''} • {reviewStatusLabel}
          </p>
        </div>
      </div>
    </a>
  );
}

function PullRequestCiIcon({
  ciStatus
}: {
  ciStatus: GitHubPullRequestItem['ciStatus'];
}) {
  if (ciStatus === 'passing') {
    return (
      <svg
        viewBox="0 0 16 16"
        aria-hidden="true"
        className="h-4 w-4 flex-none text-emerald-400"
        fill="currentColor"
      >
        <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-6.25 6.25a.75.75 0 0 1-1.06 0L2.22 7.28a.75.75 0 1 1 1.06-1.06L7 9.94l5.72-5.72a.75.75 0 0 1 1.06 0Z" />
      </svg>
    );
  }

  if (ciStatus === 'failing') {
    return (
      <svg
        viewBox="0 0 16 16"
        aria-hidden="true"
        className="h-4 w-4 flex-none text-rose-400"
        fill="currentColor"
      >
        <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 0 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 1 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z" />
      </svg>
    );
  }

  if (ciStatus === 'pending') {
    return (
      <svg
        viewBox="0 0 16 16"
        aria-hidden="true"
        className="h-4 w-4 flex-none text-amber-400"
        fill="currentColor"
      >
        <circle cx="8" cy="8" r="3" />
      </svg>
    );
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
      className="block rounded-2xl border border-white/5 bg-black/10 px-4 py-3 transition hover:border-white/15 hover:bg-black/20"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <GitHubItemIcon
                kind={iconKind}
                state={iconKind === 'pull-request' ? pullRequestState : undefined}
              />
              <p className="truncate text-sm font-medium text-stone-100">{notification.subject.title}</p>
            </div>
            <p className="shrink-0 text-xs font-medium uppercase tracking-[0.18em] text-stone-400">
              {notificationTypeLabel}
            </p>
          </div>
          <p className="mt-1 text-sm text-stone-400">{notification.repository.full_name}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge label={notification.reason} tone="gray" />
            {notification.unread ? <Badge label="Unread" tone="green" /> : null}
          </div>
        </div>
      </div>
      <p className="mt-3 text-xs uppercase tracking-[0.2em] text-textSoft">
        Updated{' '}
        {new Date(notification.updated_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
      </p>
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
    default: 'border-white/10 bg-white/5 text-stone-300',
    green: 'border-emerald-300/20 bg-emerald-200/10 text-emerald-100',
    red: 'border-rose-300/20 bg-rose-200/10 text-rose-100',
    yellow: 'border-amber-300/20 bg-amber-200/10 text-amber-100',
    gray: 'border-white/10 bg-white/5 text-stone-400'
  }[tone];

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[0.65rem] uppercase tracking-[0.18em] ${toneClass}`}
    >
      {label}
    </span>
  );
}

function ListItemSkeleton() {
  return (
    <div className="rounded-2xl border border-white/5 bg-black/10 px-4 py-3">
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
      title: 'Notifications',
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
      title: 'Needs Review',
      count: data.reviewRequestedCount,
      countLabel: `${data.reviewRequestedCount} review requests`,
      itemLabel: 'PRs',
      emptyMessage: data.connectionStatus === 'connected' ? 'No pull requests need your review.' : getEmptyListMessage(data),
      items: reviewRequestedPRs.map((pullRequest) => mapPullRequestViewItem(pullRequest))
    };
  }

  return {
    title: 'Pull Requests',
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

function formatCompactTime(value: number | null) {
  if (!value) {
    return 'Never';
  }

  return new Date(value).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit'
  });
}

function formatRelativeTime(dateString: string) {
  const timestamp = new Date(dateString).getTime();
  const diffMs = Date.now() - timestamp;

  if (!Number.isFinite(timestamp) || diffMs < 0) {
    return new Date(dateString).toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  const diffSeconds = Math.floor(diffMs / 1000);
  if (diffSeconds < 60) {
    return `${diffSeconds}s ago`;
  }

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  return new Date(dateString).toLocaleDateString([], { month: 'short', day: 'numeric' });
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

  return 'Review required';
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
