import { ReactNode, useMemo } from 'react';
import { formatRelativeTime } from '../lib/date';
import {
  getJiraBrowseUrl,
  getJiraIssueCounts,
  getJiraSearchUrl,
  isBlockingIssue,
  type JiraConnectionStatus,
  type JiraDashboardData,
  type JiraIssue
} from '../lib/jiraApi';
import { type ActiveJiraView } from '../lib/storage';
import { CardTabMenu } from './CardTabMenu';
import { CardShell } from './CardShell';

type JiraCardProps = {
  integrationSwitcher?: ReactNode;
  baseUrl: string;
  data: JiraDashboardData;
  isLoading: boolean;
  onRefresh: () => void;
  activeView: ActiveJiraView;
  onViewChange: (view: ActiveJiraView) => void;
};

const STATUS_COPY: Record<JiraConnectionStatus, { label: string; tone: string; message: string }> = {
  'not-connected': {
    label: 'Not connected',
    tone: 'bg-white/6 text-stone-300',
    message: 'Add your Jira site URL, email, and API token in Settings to enable Jira integration.'
  },
  testing: {
    label: 'Testing',
    tone: 'bg-amber-200/10 text-amber-100',
    message: 'Checking the saved Jira credentials.'
  },
  connected: {
    label: 'Connected',
    tone: 'bg-emerald-200/10 text-emerald-100',
    message: 'Active Jira tickets are live on the dashboard.'
  },
  invalid: {
    label: 'Invalid credentials',
    tone: 'bg-rose-200/10 text-rose-100',
    message: 'Jira returned 401 for the saved credentials. Update them in Settings and test again.'
  },
  error: {
    label: 'API error',
    tone: 'bg-amber-200/10 text-amber-100',
    message: 'Jira data could not be loaded right now.'
  }
};

export function JiraCard({
  integrationSwitcher,
  baseUrl,
  data,
  isLoading,
  onRefresh,
  activeView,
  onViewChange
}: JiraCardProps) {
  const copy = STATUS_COPY[data.connectionStatus];
  const counts = getJiraIssueCounts(data.issues);
  const viewAllUrl = baseUrl ? getJiraSearchUrl(baseUrl) : '';
  const filteredIssues = useMemo(() => {
    if (activeView === 'in-progress') {
      return data.issues.filter(isInProgressIssue);
    }

    if (activeView === 'blocking') {
      return data.issues.filter(isBlockingIssue);
    }

    if (activeView === 'high-priority') {
      return data.issues.filter(isHighPriorityIssue);
    }

    return data.issues;
  }, [activeView, data.issues]);
  const tabItems = [
    {
      key: 'active',
      label: 'Active',
      value: formatCount(counts.active, isLoading),
      isActive: activeView === 'active',
      onClick: () => onViewChange('active')
    },
    {
      key: 'in-progress',
      label: 'In Progress',
      value: formatCount(counts.inProgress, isLoading),
      isActive: activeView === 'in-progress',
      onClick: () => onViewChange('in-progress')
    },
    {
      key: 'blocking',
      label: 'Blocking',
      value: formatCount(counts.blocking, isLoading),
      isActive: activeView === 'blocking',
      onClick: () => onViewChange('blocking')
    },
    {
      key: 'high-priority',
      label: 'High Priority',
      value: formatCount(counts.highPriority, isLoading),
      isActive: activeView === 'high-priority',
      onClick: () => onViewChange('high-priority')
    }
  ];

  return (
    <CardShell className="flex h-full w-full min-w-0 flex-1 flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col">
        {integrationSwitcher ? (
          <div className="-mx-5 -mt-4 mb-5 border-b border-white/[0.04] px-5 py-4">
            {integrationSwitcher}
          </div>
        ) : null}

        <div className="flex flex-col gap-3 pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium uppercase tracking-[0.24em] text-primary">Jira</p>
            <p className="mt-1 break-all text-sm text-secondary">{formatWorkspaceLabel(baseUrl)}</p>
          </div>

          <div className="flex flex-col items-start sm:items-end">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] ${copy.tone}`}>
                {copy.label}
              </span>
              <button
                type="button"
                onClick={onRefresh}
                disabled={isLoading || data.connectionStatus === 'not-connected'}
                className="rounded-full bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.2em] text-secondary transition hover:bg-white/10 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoading ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--text-tertiary)] sm:justify-end">
              <span>Last updated {formatCompactTime(data.lastUpdatedAt)}</span>
            </div>
          </div>
        </div>

        <div className="mt-4 flex min-h-0 flex-1 flex-col">
          <div className="mb-4 min-w-0">
            <CardTabMenu items={tabItems} />
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
              <EmptyState message={getEmptyFilterMessage(activeView)} />
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
                className="text-sm text-secondary transition hover:text-primary"
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

function IssueRow({ issue, baseUrl }: { issue: JiraIssue; baseUrl: string }) {
  const blockingIssues = issue.blockingIssues;
  const blockedByIssues = issue.blockedByIssues;
  const issueUrl = getJiraBrowseUrl(baseUrl, issue.key);

  return (
    <div className="rounded-[14px] bg-[var(--card-bg-soft)] px-4 py-2.5 shadow-[var(--shadow-card-soft)]">
      <a href={issueUrl} target="_blank" rel="noreferrer" className="block">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-2">
                <p className="line-clamp-2 min-w-0 text-sm font-medium text-primary">
                  <span className="mr-2 text-xs uppercase tracking-[0.16em] text-[var(--text-tertiary)]">{issue.key}</span>
                  {issue.summary}
                </p>
                <PriorityIcon priorityName={issue.priority?.name} />
              </div>

              <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                <StatusBadge label={issue.status.name} />
              </div>
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-secondary">
              <span>
                updated {formatRelativeTime(issue.updated)} • {issue.status.name}
              </span>
              {blockingIssues.map((blockingIssue) => (
                <span
                  key={blockingIssue.key}
                  className="rounded-full bg-amber-300/10 px-2 py-0.5 text-[0.65rem] uppercase tracking-[0.16em] text-amber-100"
                >
                  Blocks <RelatedIssueLink baseUrl={baseUrl} issue={blockingIssue} tone="amber" />
                </span>
              ))}

              {blockedByIssues.map((blockedByIssue) => (
                <span
                  key={blockedByIssue.key}
                  className="rounded-full bg-rose-300/10 px-2 py-0.5 text-[0.65rem] uppercase tracking-[0.16em] text-rose-100"
                >
                  Blocked by <RelatedIssueLink baseUrl={baseUrl} issue={blockedByIssue} tone="rose" />
                </span>
              ))}
            </div>
          </div>
        </div>
      </a>
    </div>
  );
}

function RelatedIssueLink({
  baseUrl,
  issue,
  tone
}: {
  baseUrl: string;
  issue: JiraIssue['blockingIssues'][number];
  tone: 'amber' | 'rose';
}) {
  const toneClass =
    tone === 'amber'
      ? 'text-amber-50 decoration-amber-100/70 hover:text-white hover:decoration-amber-50'
      : 'text-rose-50 decoration-rose-100/70 hover:text-white hover:decoration-rose-50';

  return (
    <a
      href={getJiraBrowseUrl(baseUrl, issue.key)}
      target="_blank"
      rel="noreferrer"
      title={getRelatedIssueTooltip(issue)}
      className={`font-medium uppercase tracking-[0.14em] underline underline-offset-4 transition ${toneClass}`}
    >
      {issue.key}
    </a>
  );
}

function getRelatedIssueTooltip(issue: JiraIssue['blockingIssues'][number]) {
  const parts = [issue.summary, issue.status, issue.assignee ? `Owner: ${issue.assignee}` : undefined].filter(Boolean);
  return parts.join(' • ');
}

function StatusBadge({ label }: { label: string }) {
  return (
    <span className="rounded-full bg-sky-300/10 px-2 py-0.5 text-[0.65rem] uppercase tracking-[0.16em] text-sky-100">
      {label}
    </span>
  );
}

function PriorityIcon({ priorityName }: { priorityName?: string }) {
  if (!priorityName) {
    return null;
  }

  const normalized = priorityName.toLowerCase();

  if (normalized === 'blocker') {
    return (
      <span
        aria-label={priorityName}
        title={priorityName}
        className="inline-flex h-5 w-5 items-center justify-center text-rose-400"
      >
        <svg viewBox="0 0 16 16" aria-hidden="true" className="h-4 w-4" fill="none">
          <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.5" />
          <path d="M4.75 8h6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </span>
    );
  }

  if (normalized === 'critical') {
    return (
      <span
        aria-label={priorityName}
        title={priorityName}
        className="inline-flex h-5 w-5 items-center justify-center text-rose-400"
      >
        <svg viewBox="0 0 16 16" aria-hidden="true" className="h-4 w-4" fill="none">
          <path
            d="M8 3.25 11.75 6v6.5H4.25V6L8 3.25Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    );
  }

  if (normalized === 'highest' || normalized === 'major' || normalized === 'high') {
    return (
      <span
        aria-label={priorityName}
        title={priorityName}
        className="inline-flex h-5 w-5 items-center justify-center text-rose-400"
      >
        <svg viewBox="0 0 16 16" aria-hidden="true" className="h-4 w-4" fill="none">
          <path d="M4 9.75 8 5.75l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M4 13 8 9l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          {normalized === 'highest' ? (
            <path d="M4 6.5 8 2.5l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          ) : null}
        </svg>
      </span>
    );
  }

  if (normalized === 'minor' || normalized === 'low' || normalized === 'lowest') {
    return (
      <span
        aria-label={priorityName}
        title={priorityName}
        className="inline-flex h-5 w-5 items-center justify-center text-sky-400"
      >
        <svg viewBox="0 0 16 16" aria-hidden="true" className="h-4 w-4" fill="none">
          {normalized === 'lowest' ? (
            <path d="M4 2.75 8 6.75l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          ) : null}
          <path d="M4 6 8 10l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M4 9.25 8 13.25l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }

  if (normalized === 'trivial') {
    return (
      <span
        aria-label={priorityName}
        title={priorityName}
        className="inline-flex h-5 w-5 items-center justify-center text-stone-400"
      >
        <svg viewBox="0 0 16 16" aria-hidden="true" className="h-4 w-4" fill="none">
          <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </span>
    );
  }

  return (
    <span
      aria-label={priorityName}
      title={priorityName}
      className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white/5 px-1.5 text-[0.6rem] uppercase tracking-[0.14em] text-stone-300"
    >
      {priorityName.slice(0, 1)}
    </span>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-[14px] bg-[var(--card-bg-soft)] px-4 py-5 text-sm text-secondary shadow-[var(--shadow-card-soft)]">
      {message}
    </div>
  );
}

function ListItemSkeleton() {
  return (
    <div className="rounded-[14px] bg-[var(--card-bg-soft)] px-4 py-3 shadow-[var(--shadow-card-soft)]">
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

function getEmptyFilterMessage(activeFilter: 'active' | 'in-progress' | 'blocking' | 'high-priority') {
  if (activeFilter === 'in-progress') {
    return 'No tickets are currently in progress.';
  }

  if (activeFilter === 'blocking') {
    return 'No tickets are currently blocking other work.';
  }

  if (activeFilter === 'high-priority') {
    return 'No high-priority tickets are assigned to you right now.';
  }

  return 'No active tickets assigned to you right now.';
}
