import { useEffect, useState } from 'react';
import {
  GitHubConnectionStatus,
  GitHubDashboardData,
  GitHubNotification,
  GitHubPullRequestItem,
  enrichGitHubPullRequests
} from '../lib/githubApi';
import {
  getStoredGitHubOwnerFilter,
  getStoredGitHubSortOrder,
  saveStoredGitHubOwnerFilter,
  saveStoredGitHubSortOrder,
  type GitHubListSort
} from '../lib/storage';
import { CardShell } from './CardShell';
import { SectionHeading } from './SectionHeading';

type GitHubCardProps = {
  data: GitHubDashboardData;
  username: string;
  token: string;
  isLoading: boolean;
  onRefresh: () => void;
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

export function GitHubCard({ data, username, token, isLoading, onRefresh }: GitHubCardProps) {
  const copy = STATUS_COPY[data.connectionStatus];
  const [activeGitHubView, setActiveGitHubView] = useState<
    'notifications' | 'my-prs' | 'needs-review'
  >('my-prs');
  const [organizationFilter, setOrganizationFilter] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<GitHubListSort>('recently-updated');
  const [hasLoadedOwnerFilter, setHasLoadedOwnerFilter] = useState(false);
  const [hasLoadedSortOrder, setHasLoadedSortOrder] = useState(false);
  const [enrichedPullRequestsByUrl, setEnrichedPullRequestsByUrl] = useState<
    Record<string, GitHubPullRequestItem>
  >({});
  const resolvedPullRequests = data.pullRequests.map(
    (pullRequest) => enrichedPullRequestsByUrl[pullRequest.url] ?? pullRequest
  );
  const myOpenPRs = resolvedPullRequests.filter((pullRequest) => pullRequest.source === 'authored');
  const reviewRequestedPRs = resolvedPullRequests.filter(
    (pullRequest) => pullRequest.source === 'review-requested'
  );
  const notifications = data.notifications ?? [];
  const viewAllUrl = `https://github.com/pulls?q=${encodeURIComponent(`is:pr is:open author:${username.trim()}`)}`;
  const ownerOptions = getOwnerOptions(data, username, organizationFilter);
  const currentView = getGitHubViewContent(
    activeGitHubView,
    data,
    notifications,
    myOpenPRs,
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
  const visiblePullRequestKey = visiblePullRequestsToEnrich
    .map((pullRequest) => `${pullRequest.url}:${pullRequest.updatedAt}`)
    .join('|');
  const isFilterApplied = organizationFilter !== 'all' || sortOrder !== 'recently-updated';

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
    if (!token.trim() || visiblePullRequestsToEnrich.length === 0) {
      return;
    }

    let isCancelled = false;

    enrichGitHubPullRequests(visiblePullRequestsToEnrich, token).then((enrichedPullRequests) => {
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
  }, [token, visiblePullRequestKey]);

  return (
    <CardShell className="flex h-full min-w-0 flex-col overflow-hidden">
      <SectionHeading
        eyebrow="Integration"
        title="GitHub"
        description="Notifications, authored pull requests, and review requests from your saved GitHub account."
      />

      <div className="flex min-h-[720px] flex-1 flex-col rounded-[22px] border border-white/5 bg-panelAlt/80 p-5 shadow-glow">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm uppercase tracking-[0.28em] text-textSoft">Connection</p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onRefresh}
              disabled={isLoading}
              className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-stone-300 transition hover:border-white/20 hover:text-stone-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? 'Refreshing...' : 'Refresh'}
            </button>
            <span className={`rounded-full border px-3 py-1 text-sm ${copy.tone}`}>{copy.label}</span>
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-stone-300">
          {getGitHubMessage(data, copy.message, username)}
        </p>

        <div className="mt-4 grid gap-3 grid-cols-1 sm:grid-cols-3">
          <Stat
            label="Notifications"
            value={formatCount(data.notificationsCount, isLoading)}
            isLoading={isLoading}
            isActive={activeGitHubView === 'notifications'}
            onClick={() => setActiveGitHubView('notifications')}
          />
          <Stat
            label="My Open PRs"
            value={formatCount(data.openPrsCount, isLoading)}
            isLoading={isLoading}
            isActive={activeGitHubView === 'my-prs'}
            onClick={() => setActiveGitHubView('my-prs')}
          />
          <Stat
            label="Needs Review"
            value={formatCount(data.reviewRequestedCount, isLoading)}
            isLoading={isLoading}
            isActive={activeGitHubView === 'needs-review'}
            onClick={() => setActiveGitHubView('needs-review')}
          />
        </div>

        <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-black/10 px-4 py-3">
          <p className="text-xs uppercase tracking-[0.2em] text-textSoft">Username</p>
          <p className="mt-2 text-sm text-stone-200">{username.trim() || 'Not set'}</p>
          {data.lastUpdatedAt ? (
            <p className="mt-2 text-xs text-stone-500">
              Last updated{' '}
              {new Date(data.lastUpdatedAt).toLocaleTimeString([], {
                hour: 'numeric',
                minute: '2-digit'
              })}
            </p>
          ) : null}
        </div>

        <div className="mt-4 flex min-h-0 flex-1 flex-col">
          <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-white/5 bg-black/10 px-4 py-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
              <label className="flex min-w-0 flex-col gap-2">
                <span className="text-[0.7rem] uppercase tracking-[0.18em] text-textSoft">Owner</span>
                <select
                  value={organizationFilter}
                  onChange={(event) => setOrganizationFilter(event.target.value)}
                  className="rounded-xl border border-white/10 bg-panel px-3 py-2 text-sm text-stone-100 outline-none transition hover:border-white/20 focus:border-white/25"
                >
                  {ownerOptions.map((option) => (
                    <option key={option.value} value={option.value} className="bg-panel text-stone-100">
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex min-w-0 flex-col gap-2">
                <span className="text-[0.7rem] uppercase tracking-[0.18em] text-textSoft">Sort</span>
                <select
                  value={sortOrder}
                  onChange={(event) => setSortOrder(event.target.value as GitHubListSort)}
                  className="rounded-xl border border-white/10 bg-panel px-3 py-2 text-sm text-stone-100 outline-none transition hover:border-white/20 focus:border-white/25"
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

            {!isLoading ? (
              <p className="text-xs text-stone-400">
                {getFilteredCountLabel(
                  filteredItems.length,
                  currentView.items.length,
                  currentView.itemLabel,
                  isFilterApplied
                )}
              </p>
            ) : null}
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="text-sm uppercase tracking-[0.28em] text-textSoft">{currentView.title}</p>
            {!isLoading && currentView.count > 0 ? (
              <p className="text-xs text-stone-500">{currentView.countLabel}</p>
            ) : null}
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
                    <NotificationRow key={item.key} notification={item.value} />
                  ) : (
                    <PullRequestRow key={item.key} pullRequest={item.value} />
                  )
                )}
              </div>
            )}
          </div>
          {!isLoading && activeGitHubView === 'my-prs' && data.openPrsCount > 0 && username.trim() ? (
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

function Stat({
  label,
  value,
  isLoading,
  isActive,
  onClick
}: {
  label: string;
  value: string;
  isLoading: boolean;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-[92px] rounded-2xl border px-4 py-3 text-left transition cursor-pointer ${
        isActive
          ? 'border-white/20 bg-white/10'
          : 'border-white/5 bg-black/10 hover:border-white/10 hover:bg-black/20'
      }`}
    >
      <p className="text-xs uppercase tracking-[0.16em] text-textSoft">{label}</p>
      {isLoading ? (
        <div className="mt-3 h-8 w-12 animate-pulse rounded-lg bg-white/10" />
      ) : (
        <p className="mt-2 text-2xl text-stone-100">{value}</p>
      )}
    </button>
  );
}

function PullRequestRow({ pullRequest }: { pullRequest: GitHubPullRequestItem }) {
  return (
    <a
      href={pullRequest.url}
      target="_blank"
      rel="noreferrer"
      className="block rounded-2xl border border-white/5 bg-black/10 px-4 py-3 transition hover:border-white/15 hover:bg-black/20"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-stone-100">{pullRequest.title}</p>
          <p className="mt-1 text-sm text-stone-400">{pullRequest.repositoryName}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge label={pullRequest.source === 'authored' ? 'Mine' : 'Review'} tone="default" />
            <Badge label={getReviewStatusLabel(pullRequest.reviewStatus)} tone={getReviewTone(pullRequest.reviewStatus)} />
            <Badge label={getCiStatusLabel(pullRequest.ciStatus)} tone={getCiTone(pullRequest.ciStatus)} />
          </div>
        </div>
      </div>
      <p className="mt-3 text-xs uppercase tracking-[0.2em] text-textSoft">
        Updated {new Date(pullRequest.updatedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
      </p>
    </a>
  );
}

function NotificationRow({ notification }: { notification: GitHubNotification }) {
  return (
    <a
      href={getNotificationUrl(notification)}
      target="_blank"
      rel="noreferrer"
      className="block rounded-2xl border border-white/5 bg-black/10 px-4 py-3 transition hover:border-white/15 hover:bg-black/20"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-stone-100">{notification.subject.title}</p>
          <p className="mt-1 text-sm text-stone-400">{notification.repository.full_name}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge label={notification.subject.type} tone="default" />
            <Badge label={formatReason(notification.reason)} tone="gray" />
            <Badge label={notification.unread ? 'Unread' : 'Read'} tone={notification.unread ? 'green' : 'gray'} />
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
      className={`inline-flex items-center rounded-full border px-2 py-1 text-[0.65rem] uppercase tracking-[0.18em] ${toneClass}`}
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
  activeGitHubView: 'notifications' | 'my-prs' | 'needs-review',
  data: GitHubDashboardData,
  notifications: GitHubNotification[],
  myOpenPRs: GitHubPullRequestItem[],
  reviewRequestedPRs: GitHubPullRequestItem[]
) {
  if (activeGitHubView === 'notifications') {
    return {
      title: 'Notifications',
      count: data.notificationsCount,
      countLabel: `${data.notificationsCount} notifications`,
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

  if (activeGitHubView === 'needs-review') {
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

function getFilteredCountLabel(
  visibleCount: number,
  totalCount: number,
  itemLabel: string,
  isFilterApplied: boolean
) {
  if (!isFilterApplied) {
    return `Showing ${visibleCount} ${itemLabel}`;
  }

  return `Showing ${visibleCount} of ${totalCount} ${itemLabel}`;
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

function getReviewStatusLabel(reviewStatus: GitHubPullRequestItem['reviewStatus']) {
  if (reviewStatus === 'approved') {
    return 'Approved';
  }

  if (reviewStatus === 'changes-requested') {
    return 'Changes requested';
  }

  return 'Waiting review';
}

function getReviewTone(
  reviewStatus: GitHubPullRequestItem['reviewStatus']
): 'green' | 'red' | 'gray' {
  if (reviewStatus === 'approved') {
    return 'green';
  }

  if (reviewStatus === 'changes-requested') {
    return 'red';
  }

  return 'gray';
}

function getCiStatusLabel(ciStatus: GitHubPullRequestItem['ciStatus']) {
  if (ciStatus === 'passing') {
    return 'Passing';
  }

  if (ciStatus === 'failing') {
    return 'Failing';
  }

  if (ciStatus === 'pending') {
    return 'Pending';
  }

  return 'Unknown';
}

function getCiTone(
  ciStatus: GitHubPullRequestItem['ciStatus']
): 'green' | 'red' | 'yellow' | 'gray' {
  if (ciStatus === 'passing') {
    return 'green';
  }

  if (ciStatus === 'failing') {
    return 'red';
  }

  if (ciStatus === 'pending') {
    return 'yellow';
  }

  return 'gray';
}

function getGitHubMessage(
  data: GitHubDashboardData,
  fallbackMessage: string,
  username: string
) {
  if (data.connectionStatus === 'not-connected') {
    return username.trim()
      ? 'Add a personal access token in Settings to enable GitHub integration.'
      : 'Add a GitHub username and personal access token in Settings to enable GitHub integration.';
  }

  if (data.errorMessage) {
    return data.errorMessage;
  }

  if (data.connectionStatus === 'connected') {
    return 'GitHub activity is live on the dashboard.';
  }

  return fallbackMessage;
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
