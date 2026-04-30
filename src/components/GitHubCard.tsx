import {
  GitHubConnectionStatus,
  GitHubDashboardData,
  GitHubPullRequestItem
} from '../lib/githubApi';
import { CardShell } from './CardShell';
import { SectionHeading } from './SectionHeading';

type GitHubCardProps = {
  data: GitHubDashboardData;
  username: string;
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

export function GitHubCard({ data, username, isLoading, onRefresh }: GitHubCardProps) {
  const copy = STATUS_COPY[data.connectionStatus];
  const myOpenPRs = data.pullRequests;
  const totalPRs = data.openPrsCount;
  const viewAllUrl = `https://github.com/pulls?q=${encodeURIComponent(`is:pr is:open author:${username.trim()}`)}`;

  return (
    <CardShell className="min-w-0 overflow-hidden">
      <SectionHeading
        eyebrow="Integration"
        title="GitHub"
        description="Notifications, authored pull requests, and review requests from your saved GitHub account."
      />

      <div className="flex min-h-[720px] flex-col rounded-[22px] border border-white/5 bg-panelAlt/80 p-5 shadow-glow">
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
          />
          <Stat
            label="My Open PRs"
            value={formatCount(data.openPrsCount, isLoading)}
            isLoading={isLoading}
          />
          <Stat
            label="Needs Review"
            value={formatCount(data.reviewRequestedCount, isLoading)}
            isLoading={isLoading}
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
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm uppercase tracking-[0.28em] text-textSoft">Pull Requests</p>
            {!isLoading && totalPRs > 0 ? (
              <p className="text-xs text-stone-500">{totalPRs} open PRs</p>
            ) : null}
          </div>
          <div className="dashboard-scrollbar mt-3 min-h-[320px] max-h-[420px] overflow-y-auto pr-1">
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, index) => (
                  <PullRequestSkeleton key={index} />
                ))}
              </div>
            ) : myOpenPRs.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-black/10 px-4 py-5 text-sm text-stone-500">
                {getEmptyListMessage(data)}
              </div>
            ) : (
              <div className="space-y-3">
                {myOpenPRs.map((pullRequest) => (
                  <PullRequestRow key={pullRequest.url} pullRequest={pullRequest} />
                ))}
              </div>
            )}
          </div>
          {!isLoading && totalPRs > 0 && username.trim() ? (
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

function Stat({ label, value, isLoading }: { label: string; value: string; isLoading: boolean }) {
  return (
    <div className="min-h-[92px] rounded-2xl border border-white/5 bg-black/10 px-4 py-3">
      <p className="text-xs uppercase tracking-[0.16em] text-textSoft">{label}</p>
      {isLoading ? (
        <div className="mt-3 h-8 w-12 animate-pulse rounded-lg bg-white/10" />
      ) : (
        <p className="mt-2 text-2xl text-stone-100">{value}</p>
      )}
    </div>
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
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-stone-100">{pullRequest.title}</p>
          <p className="mt-1 text-sm text-stone-400">{pullRequest.repositoryName}</p>
        </div>
        <span className="shrink-0 rounded-full border border-white/10 px-2 py-1 text-[0.65rem] uppercase tracking-[0.18em] text-stone-300">
          {pullRequest.source === 'authored' ? 'Mine' : 'Review'}
        </span>
      </div>
      <p className="mt-3 text-xs uppercase tracking-[0.2em] text-textSoft">
        Updated {new Date(pullRequest.updatedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
      </p>
    </a>
  );
}

function PullRequestSkeleton() {
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

function formatCount(value: number, isLoading: boolean) {
  if (isLoading) {
    return '...';
  }

  return String(value);
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
