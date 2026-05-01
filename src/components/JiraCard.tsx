import { useMemo, useState } from 'react';
import {
  getJiraBrowseUrl,
  getJiraIssueCounts,
  getJiraSearchUrl,
  type JiraConnectionStatus,
  type JiraDashboardData,
  type JiraIssue
} from '../lib/jiraApi';
import { CardShell } from './CardShell';

type JiraCardProps = {
  baseUrl: string;
  data: JiraDashboardData;
  isLoading: boolean;
  onRefresh: () => void;
};

const STATUS_COPY: Record<JiraConnectionStatus, { label: string; tone: string; message: string }> = {
  'not-connected': {
    label: 'Not connected',
    tone: 'border-white/10 bg-white/5 text-stone-300',
    message: 'Add your Jira site URL, email, and API token in Settings to enable Jira integration.'
  },
  testing: {
    label: 'Testing',
    tone: 'border-amber-300/20 bg-amber-200/10 text-amber-100',
    message: 'Checking the saved Jira credentials.'
  },
  connected: {
    label: 'Connected',
    tone: 'border-emerald-300/20 bg-emerald-200/10 text-emerald-100',
    message: 'Active Jira tickets are live on the dashboard.'
  },
  invalid: {
    label: 'Invalid credentials',
    tone: 'border-rose-300/20 bg-rose-200/10 text-rose-100',
    message: 'Jira returned 401 for the saved credentials. Update them in Settings and test again.'
  },
  error: {
    label: 'API error',
    tone: 'border-amber-300/20 bg-amber-200/10 text-amber-100',
    message: 'Jira data could not be loaded right now.'
  }
};

export function JiraCard({ baseUrl, data, isLoading, onRefresh }: JiraCardProps) {
  const copy = STATUS_COPY[data.connectionStatus];
  const counts = getJiraIssueCounts(data.issues);
  const viewAllUrl = baseUrl ? getJiraSearchUrl(baseUrl) : '';
  const [activeFilter, setActiveFilter] = useState<'active' | 'in-progress' | 'high-priority'>('active');
  const filteredIssues = useMemo(() => {
    if (activeFilter === 'in-progress') {
      return data.issues.filter(isInProgressIssue);
    }

    if (activeFilter === 'high-priority') {
      return data.issues.filter(isHighPriorityIssue);
    }

    return data.issues;
  }, [activeFilter, data.issues]);

  return (
    <CardShell className="flex h-full w-full min-w-0 flex-1 flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex flex-col gap-3 border-b border-white/5 pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium uppercase tracking-[0.24em] text-stone-100">Jira</p>
            <p className="mt-1 break-all text-sm text-stone-400">{formatWorkspaceLabel(baseUrl)}</p>
          </div>

          <div className="flex flex-col items-start sm:items-end">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] ${copy.tone}`}>
                {copy.label}
              </span>
              <button
                type="button"
                onClick={onRefresh}
                disabled={isLoading || data.connectionStatus === 'not-connected'}
                className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-stone-300 transition hover:border-white/20 hover:text-stone-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoading ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-stone-500 sm:justify-end">
              <span>Last updated {formatCompactTime(data.lastUpdatedAt)}</span>
            </div>
          </div>
        </div>

        <div className="mt-4 flex min-h-0 flex-1 flex-col">
          <div className="mb-4 grid min-w-0 grid-cols-2 gap-2 lg:flex lg:flex-wrap">
            <TabButton
              label="Active"
              value={formatCount(counts.active, isLoading)}
              isActive={activeFilter === 'active'}
              onClick={() => setActiveFilter('active')}
            />
            <TabButton
              label="In Progress"
              value={formatCount(counts.inProgress, isLoading)}
              isActive={activeFilter === 'in-progress'}
              onClick={() => setActiveFilter('in-progress')}
            />
            <TabButton
              label="High Priority"
              value={formatCount(counts.highPriority, isLoading)}
              isActive={activeFilter === 'high-priority'}
              onClick={() => setActiveFilter('high-priority')}
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="text-sm uppercase tracking-[0.28em] text-textSoft">{getListTitle(activeFilter)}</p>
          </div>

          <div className="dashboard-scrollbar mt-3 min-h-[280px] max-h-[420px] flex-1 overflow-y-auto pr-1">
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, index) => (
                  <ListItemSkeleton key={index} />
                ))}
              </div>
            ) : data.connectionStatus === 'not-connected' ? (
              <EmptyState message="Connect Jira in Settings to load active tickets." />
            ) : data.connectionStatus === 'invalid' || data.connectionStatus === 'error' ? (
              <EmptyState message={data.errorMessage || copy.message} />
            ) : filteredIssues.length === 0 ? (
              <EmptyState message={getEmptyFilterMessage(activeFilter)} />
            ) : (
              <div className="space-y-3">
                {filteredIssues.map((issue) => (
                  <IssueRow key={issue.id} issue={issue} baseUrl={baseUrl} />
                ))}
              </div>
            )}
          </div>

          {!isLoading && data.connectionStatus === 'connected' && data.issues.length > 0 && viewAllUrl ? (
            <div className="mt-3 text-right">
              <a
                href={viewAllUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-indigo-400 transition hover:text-indigo-300"
              >
                View all tickets →
              </a>
            </div>
          ) : null}
        </div>
      </div>
    </CardShell>
  );
}

function TabButton({
  label,
  value,
  isActive,
  onClick
}: {
  label: string;
  value: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-w-0 max-w-full rounded-full border px-3 py-2 text-xs transition ${
        isActive
          ? 'border-white/20 bg-white/10 text-stone-100'
          : 'border-white/8 bg-black/10 text-stone-400 hover:border-white/15 hover:bg-black/20 hover:text-stone-200'
      }`}
    >
      <span className="font-medium">{label}</span>
      <span className={`ml-1 ${isActive ? 'text-stone-200' : 'text-stone-500'}`}>({value})</span>
    </button>
  );
}

function IssueRow({ issue, baseUrl }: { issue: JiraIssue; baseUrl: string }) {
  return (
    <a
      href={getJiraBrowseUrl(baseUrl, issue.key)}
      target="_blank"
      rel="noreferrer"
      className="block rounded-2xl border border-white/5 bg-black/10 px-4 py-3 transition hover:border-white/15 hover:bg-black/20"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs uppercase tracking-[0.16em] text-textSoft">{issue.key}</p>
            <StatusBadge label={issue.status.name} />
            <PriorityBadge priorityName={issue.priority?.name} />
          </div>
          <p className="mt-2 line-clamp-2 text-sm font-medium leading-6 text-stone-100">{issue.summary}</p>
        </div>
        <p className="shrink-0 text-xs text-stone-500">{formatUpdatedDate(issue.updated)}</p>
      </div>
    </a>
  );
}

function StatusBadge({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-sky-300/20 bg-sky-300/10 px-2.5 py-1 text-xs text-sky-100">
      {label}
    </span>
  );
}

function PriorityBadge({ priorityName }: { priorityName?: string }) {
  if (!priorityName) {
    return (
      <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-stone-300">
        No priority
      </span>
    );
  }

  const tone =
    priorityName === 'Highest'
      ? 'border-rose-300/20 bg-rose-300/10 text-rose-100'
      : priorityName === 'High'
        ? 'border-amber-300/20 bg-amber-300/10 text-amber-100'
        : 'border-white/10 bg-white/5 text-stone-300';

  return <span className={`rounded-full border px-2.5 py-1 text-xs ${tone}`}>{priorityName}</span>;
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-black/10 px-4 py-5 text-sm text-stone-500">
      {message}
    </div>
  );
}

function ListItemSkeleton() {
  return (
    <div className="rounded-2xl border border-white/5 bg-black/10 px-4 py-3">
      <div className="h-3 w-20 animate-pulse rounded bg-white/10" />
      <div className="mt-3 h-4 w-5/6 animate-pulse rounded bg-white/10" />
      <div className="mt-3 h-3 w-28 animate-pulse rounded bg-white/10" />
    </div>
  );
}

function formatCount(value: number, isLoading: boolean) {
  return isLoading ? '...' : value.toString();
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

function formatWorkspaceLabel(baseUrl: string) {
  if (!baseUrl) {
    return 'Workspace not set';
  }

  try {
    return new URL(baseUrl).host;
  } catch {
    return baseUrl.replace(/^https?:\/\//, '');
  }
}

function formatUpdatedDate(updatedAt: string) {
  const date = new Date(updatedAt);
  return date.toLocaleDateString('en-AU', {
    month: 'short',
    day: 'numeric'
  });
}

function isInProgressIssue(issue: JiraIssue) {
  const statusName = issue.status.name.toLowerCase();
  const statusCategoryName = issue.status.statusCategory?.name?.toLowerCase() ?? '';
  const statusCategoryKey = issue.status.statusCategory?.key?.toLowerCase() ?? '';

  return (
    statusName.includes('in progress') ||
    statusCategoryName === 'indeterminate' ||
    statusCategoryKey === 'indeterminate'
  );
}

function isHighPriorityIssue(issue: JiraIssue) {
  const priorityName = issue.priority?.name?.toLowerCase() ?? '';
  return priorityName === 'highest' || priorityName === 'high';
}

function getListTitle(activeFilter: 'active' | 'in-progress' | 'high-priority') {
  if (activeFilter === 'in-progress') {
    return 'In Progress Tickets';
  }

  if (activeFilter === 'high-priority') {
    return 'High Priority Tickets';
  }

  return 'My Active Tickets';
}

function getEmptyFilterMessage(activeFilter: 'active' | 'in-progress' | 'high-priority') {
  if (activeFilter === 'in-progress') {
    return 'No tickets are currently in progress.';
  }

  if (activeFilter === 'high-priority') {
    return 'No high-priority tickets are assigned to you right now.';
  }

  return 'No active tickets assigned to you right now.';
}
