import { ReactNode, useEffect, useState } from 'react';
import { DashboardHeader } from '../components/DashboardHeader';
import { GitHubCard, type GitHubSummaryMetrics } from '../components/GitHubCard';
import { HeaderMenu } from '../components/HeaderMenu';
import { JiraCard } from '../components/JiraCard';
import { NotesCard } from '../components/NotesCard';
import { PlaceholderCard } from '../components/PlaceholderCard';
import { SummaryCard, type SummaryContent } from '../components/SummaryCard';
import { GitHubConnectionStatus, GitHubDashboardData } from '../lib/githubApi';
import { getJiraIssueCounts, JiraConnectionStatus, JiraDashboardData } from '../lib/jiraApi';
import {
  buildDashboardHashNavigation,
  parseDashboardHashNavigation
} from '../lib/dashboardRouting';
import {
  DashboardSettings,
  getStoredActiveGitHubView,
  getStoredActiveIntegration,
  getStoredActiveJiraView,
  getStoredGitHubPrStatusFilter,
  saveStoredActiveIntegration,
  saveStoredActiveGitHubView,
  saveStoredActiveJiraView,
  saveStoredGitHubPrStatusFilter,
  type ActiveGitHubView,
  type ActiveIntegration,
  type ActiveJiraView,
  type GitHubPrStatusFilter
} from '../lib/storage';

type DashboardPageProps = {
  settings: DashboardSettings;
  gitHubData: GitHubDashboardData;
  isGitHubLoading: boolean;
  isCheckingGitHubActivity: boolean;
  lastGitHubActivityCheckAt: number | null;
  onRefreshGitHub: () => void;
  jiraData: JiraDashboardData;
  isJiraLoading: boolean;
  onRefreshJira: () => void;
};

export function DashboardPage({
  settings,
  gitHubData,
  isGitHubLoading,
  isCheckingGitHubActivity,
  lastGitHubActivityCheckAt,
  onRefreshGitHub,
  jiraData,
  isJiraLoading,
  onRefreshJira
}: DashboardPageProps) {
  const [activeIntegration, setActiveIntegration] = useState<ActiveIntegration>('github');
  const [activeGitHubView, setActiveGitHubView] = useState<ActiveGitHubView>('prs');
  const [githubPrStatusFilter, setGitHubPrStatusFilter] = useState<GitHubPrStatusFilter>('all');
  const [activeJiraView, setActiveJiraView] = useState<ActiveJiraView>('active');
  const [hasLoadedNavigation, setHasLoadedNavigation] = useState(false);
  const [gitHubSummaryMetrics, setGitHubSummaryMetrics] = useState<GitHubSummaryMetrics>({
    connectionStatus: gitHubData.connectionStatus,
    missingUsername: gitHubData.missingUsername,
    reviewRequestedCount: 0,
    approvedPrCount: null,
    relevantPrCount: gitHubData.openPrsCount
  });

  useEffect(() => {
    let isActive = true;

    const applyNavigationState = (nextState: {
      activeIntegration: ActiveIntegration;
      activeGitHubView: ActiveGitHubView;
      githubPrStatusFilter: GitHubPrStatusFilter;
      activeJiraView: ActiveJiraView;
    }) => {
      if (!isActive) {
        return;
      }

      setActiveIntegration(nextState.activeIntegration);
      setActiveGitHubView(nextState.activeGitHubView);
      setGitHubPrStatusFilter(nextState.githubPrStatusFilter);
      setActiveJiraView(nextState.activeJiraView);
      setHasLoadedNavigation(true);
    };

    const syncFromHashOrStorage = async (options?: { replaceUrl?: boolean }) => {
      const hashState = parseDashboardHashNavigation(window.location.hash);
      if (hashState) {
        applyNavigationState(hashState);
        return;
      }

      const [
        storedActiveIntegration,
        storedActiveGitHubView,
        storedGitHubPrStatusFilter,
        storedActiveJiraView
      ] = await Promise.all([
        getStoredActiveIntegration(),
        getStoredActiveGitHubView(),
        getStoredGitHubPrStatusFilter(),
        getStoredActiveJiraView()
      ]);

      if (!isActive) {
        return;
      }

      const nextState = {
        activeIntegration: storedActiveIntegration,
        activeGitHubView: storedActiveGitHubView,
        githubPrStatusFilter: storedGitHubPrStatusFilter,
        activeJiraView: storedActiveJiraView
      };

      applyNavigationState(nextState);

      if (options?.replaceUrl) {
        replaceDashboardHash(nextState);
      }
    };

    void syncFromHashOrStorage({ replaceUrl: true });

    const handleHashChange = () => {
      void syncFromHashOrStorage({ replaceUrl: true });
    };

    window.addEventListener('hashchange', handleHashChange);

    return () => {
      isActive = false;
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  useEffect(() => {
    if (!hasLoadedNavigation) {
      return;
    }

    void Promise.all([
      saveStoredActiveIntegration(activeIntegration),
      saveStoredActiveGitHubView(activeGitHubView),
      saveStoredGitHubPrStatusFilter(githubPrStatusFilter),
      saveStoredActiveJiraView(activeJiraView)
    ]);
  }, [
    activeGitHubView,
    activeIntegration,
    activeJiraView,
    githubPrStatusFilter,
    hasLoadedNavigation
  ]);

  useEffect(() => {
    setGitHubSummaryMetrics((current) => ({
      ...current,
      connectionStatus: gitHubData.connectionStatus,
      missingUsername: gitHubData.missingUsername
    }));
  }, [gitHubData.connectionStatus, gitHubData.missingUsername]);

  const daySummary = getDaySummary({
    gitHubMetrics: gitHubSummaryMetrics,
    jiraData,
    isGitHubLoading,
    isJiraLoading,
    onOpenGitHubPrs: () => {
      navigateToGitHubPrs('all');
    },
    onOpenApprovedPrs: () => {
      navigateToGitHubPrs('approved');
    },
    onOpenJiraInProgress: () => {
      navigateToJiraView('in-progress');
    }
  });
  const jiraCounts = getJiraIssueCounts(jiraData.issues);
  const dashboardAlerts = getDashboardAlerts({
    gitHubMetrics: gitHubSummaryMetrics,
    jiraCounts,
    isGitHubLoading,
    isJiraLoading,
    onOpenReviewRequestedPrs: () => {
      handleGitHubViewChange('review');
    },
    onOpenBlockedIssues: () => {
      navigateToJiraView('blocking');
    },
    onOpenApprovedPrs: () => {
      navigateToGitHubPrs('approved');
    }
  });

  function updateDashboardNavigation(nextState: {
    activeIntegration: ActiveIntegration;
    activeGitHubView: ActiveGitHubView;
    githubPrStatusFilter: GitHubPrStatusFilter;
    activeJiraView: ActiveJiraView;
  }) {
    setActiveIntegration(nextState.activeIntegration);
    setActiveGitHubView(nextState.activeGitHubView);
    setGitHubPrStatusFilter(nextState.githubPrStatusFilter);
    setActiveJiraView(nextState.activeJiraView);
    setHasLoadedNavigation(true);
    window.location.hash = buildDashboardHashNavigation(nextState);
  }

  function navigateToGitHubPrs(prStatusFilter: GitHubPrStatusFilter) {
    updateDashboardNavigation({
      activeIntegration: 'github',
      activeGitHubView: 'prs',
      githubPrStatusFilter: prStatusFilter,
      activeJiraView
    });
  }

  function navigateToJiraView(view: ActiveJiraView) {
    updateDashboardNavigation({
      activeIntegration: 'jira',
      activeGitHubView,
      githubPrStatusFilter,
      activeJiraView: view
    });
  }

  function handleIntegrationChange(nextIntegration: ActiveIntegration) {
    updateDashboardNavigation({
      activeIntegration: nextIntegration,
      activeGitHubView,
      githubPrStatusFilter,
      activeJiraView
    });
  }

  function handleGitHubViewChange(view: ActiveGitHubView) {
    updateDashboardNavigation({
      activeIntegration: 'github',
      activeGitHubView: view,
      githubPrStatusFilter,
      activeJiraView
    });
  }

  function handleGitHubPrStatusFilterChange(prStatusFilter: GitHubPrStatusFilter) {
    updateDashboardNavigation({
      activeIntegration: 'github',
      activeGitHubView: 'prs',
      githubPrStatusFilter: prStatusFilter,
      activeJiraView
    });
  }

  function handleJiraViewChange(view: ActiveJiraView) {
    updateDashboardNavigation({
      activeIntegration: 'jira',
      activeGitHubView,
      githubPrStatusFilter,
      activeJiraView: view
    });
  }

  const integrationSwitcher = (
    <div className="flex flex-wrap items-center gap-2">
      <IntegrationTabButton
        label="GitHub"
        isActive={activeIntegration === 'github'}
        onClick={() => handleIntegrationChange('github')}
      />
      <IntegrationTabButton
        label="Jira"
        isActive={activeIntegration === 'jira'}
        onClick={() => handleIntegrationChange('jira')}
      />
    </div>
  );
  const integrationStatusBar =
    activeIntegration === 'github' ? (
      <GitHubIntegrationStatusBar
        connectionStatus={gitHubData.connectionStatus}
        isLoading={isGitHubLoading}
        isCheckingActivity={isCheckingGitHubActivity}
        lastUpdatedAt={gitHubData.lastUpdatedAt}
        lastCheckedAt={lastGitHubActivityCheckAt}
        onRefresh={onRefreshGitHub}
      />
    ) : (
      <JiraIntegrationStatusBar
        connectionStatus={jiraData.connectionStatus}
        isLoading={isJiraLoading}
        lastUpdatedAt={jiraData.lastUpdatedAt}
        onRefresh={onRefreshJira}
      />
    );
  const integrationTopBar = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {integrationSwitcher}
      {integrationStatusBar}
    </div>
  );

  const [primaryAlert, ...secondaryAlerts] = dashboardAlerts;

  return (
    <main className="min-h-screen py-6 text-stone-100 sm:py-8">
      <div className="dashboard-container flex flex-col gap-6">
        <div className="flex items-start justify-between gap-4">
          <DashboardHeader name={settings.name} />
          <HeaderMenu />
        </div>

        <section className="main-content">
          <div className="main-grid top-grid">
            <div className="left-column">
              {primaryAlert ? <DashboardAlert alert={primaryAlert} /> : null}
            </div>

            <div className="right-column">
              <div className="right-top-cards">
                {secondaryAlerts.map((alert) => (
                  <DashboardAlert key={alert.title} alert={alert} />
                ))}
              </div>
            </div>
          </div>

          <div className="main-grid">
            <section className="left-column">
              <SummaryCard summary={daySummary} />
              <NotesCard />
              <PlaceholderCard
                title="Calendar"
                subtitle="Placeholder"
                description="Upcoming meetings and focus blocks will fit here once calendar integration is added."
                className="min-h-[220px]"
              />
              <PlaceholderCard
                title="Workspace"
                subtitle="Later"
                description="This area can hold quick links, streaks, or a small pomodoro widget when you want to expand the dashboard."
                className="min-h-[220px]"
              />
            </section>

            <section className="right-column">
              <div className="relative flex min-h-0">
                <div
                  className={`min-h-0 flex-1 ${activeIntegration === 'github' ? 'flex' : 'hidden'}`}
                  aria-hidden={activeIntegration !== 'github'}
                >
                  <GitHubCard
                    topBar={integrationTopBar}
                    data={gitHubData}
                    username={settings.integrations.github.username}
                    token={settings.integrations.github.token}
                    isLoading={isGitHubLoading}
                    isCheckingActivity={isCheckingGitHubActivity}
                    lastActivityCheckAt={lastGitHubActivityCheckAt}
                    onRefresh={onRefreshGitHub}
                    onSummaryMetricsChange={setGitHubSummaryMetrics}
                    activeView={activeGitHubView}
                    prStatusFilter={githubPrStatusFilter}
                    onViewChange={handleGitHubViewChange}
                    onPrStatusFilterChange={handleGitHubPrStatusFilterChange}
                  />
                </div>
                <div
                  className={`min-h-0 flex-1 ${activeIntegration === 'jira' ? 'flex' : 'hidden'}`}
                  aria-hidden={activeIntegration !== 'jira'}
                >
                  <JiraCard
                    topBar={integrationTopBar}
                    baseUrl={settings.integrations.jira.baseUrl}
                    data={jiraData}
                    isLoading={isJiraLoading}
                    onRefresh={onRefreshJira}
                    activeView={activeJiraView}
                    onViewChange={handleJiraViewChange}
                  />
                </div>
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}

function replaceDashboardHash(nextState: {
  activeIntegration: ActiveIntegration;
  activeGitHubView: ActiveGitHubView;
  githubPrStatusFilter: GitHubPrStatusFilter;
  activeJiraView: ActiveJiraView;
}) {
  const nextHash = buildDashboardHashNavigation(nextState);
  if (window.location.hash === nextHash) {
    return;
  }

  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${nextHash}`);
}

function getDaySummary(options: {
  gitHubMetrics: GitHubSummaryMetrics;
  jiraData: JiraDashboardData;
  isGitHubLoading: boolean;
  isJiraLoading: boolean;
  onOpenGitHubPrs: () => void;
  onOpenApprovedPrs: () => void;
  onOpenJiraInProgress: () => void;
}): SummaryContent {
  const {
    gitHubMetrics,
    jiraData,
    isGitHubLoading,
    isJiraLoading,
    onOpenGitHubPrs,
    onOpenApprovedPrs,
    onOpenJiraInProgress
  } = options;

  if (isGitHubLoading || isJiraLoading) {
    return { type: 'text', lines: ['Loading your latest work summary...'] };
  }

  const jiraTicketCount = getJiraIssueCounts(jiraData.issues).inProgress;

  if (gitHubMetrics.connectionStatus === 'invalid') {
    return {
      type: 'text',
      lines: ['GitHub token is invalid. Update it in Settings.', `You're working on ${jiraTicketCount} Jira tickets.`]
    };
  }

  if (gitHubMetrics.connectionStatus === 'error') {
    return {
      type: 'text',
      lines: ['GitHub data is temporarily unavailable.', `You're working on ${jiraTicketCount} Jira tickets.`]
    };
  }

  if (gitHubMetrics.missingUsername) {
    return {
      type: 'text',
      lines: [
        'GitHub is connected, but your username is missing in Settings.',
        `You're working on ${jiraTicketCount} Jira tickets.`
      ]
    };
  }

  if (gitHubMetrics.connectionStatus === 'not-connected') {
    return {
      type: 'text',
      lines: ['Connect GitHub to load pull request activity.', `You're working on ${jiraTicketCount} Jira tickets.`]
    };
  }

  if (gitHubMetrics.relevantPrCount === 0 && jiraTicketCount === 0) {
    return { type: 'text', lines: ['All clear: no pending PRs or tickets.'] };
  }

  return {
    type: 'segments',
    items: [
      {
        value: gitHubMetrics.relevantPrCount,
        label: gitHubMetrics.relevantPrCount === 1 ? 'PR open' : 'PRs open',
        onClick: onOpenGitHubPrs
      },
      {
        value: gitHubMetrics.approvedPrCount ?? 'Loading…',
        label: 'approved',
        onClick: onOpenApprovedPrs
      },
      {
        value: jiraTicketCount,
        label: jiraTicketCount === 1 ? 'Jira ticket in progress' : 'Jira tickets in progress',
        onClick: onOpenJiraInProgress
      }
    ]
  };
}

type DashboardAlertItem = {
  title: string;
  detail: string;
  tone: 'amber' | 'rose' | 'emerald';
  onClick?: () => void;
};

function getDashboardAlerts(options: {
  gitHubMetrics: GitHubSummaryMetrics;
  jiraCounts: ReturnType<typeof getJiraIssueCounts>;
  isGitHubLoading: boolean;
  isJiraLoading: boolean;
  onOpenReviewRequestedPrs: () => void;
  onOpenBlockedIssues: () => void;
  onOpenApprovedPrs: () => void;
}): DashboardAlertItem[] {
  const {
    gitHubMetrics,
    jiraCounts,
    isGitHubLoading,
    isJiraLoading,
    onOpenReviewRequestedPrs,
    onOpenBlockedIssues,
    onOpenApprovedPrs
  } = options;

  return [
    {
      title:
        isGitHubLoading || gitHubMetrics.connectionStatus !== 'connected'
          ? 'PR review queue'
          : `${gitHubMetrics.reviewRequestedCount} PR${gitHubMetrics.reviewRequestedCount === 1 ? '' : 's'} ready for review`,
      detail: getReviewAlertDetail(gitHubMetrics, isGitHubLoading),
      tone: 'amber',
      onClick:
        gitHubMetrics.connectionStatus === 'connected' && !isGitHubLoading
          ? onOpenReviewRequestedPrs
          : undefined
    },
    {
      title:
        isJiraLoading ? 'Blocked work' : `${jiraCounts.blocking} blocked item${jiraCounts.blocking === 1 ? '' : 's'}`,
      detail: isJiraLoading ? 'Checking Jira blockers.' : 'Needs your input.',
      tone: 'rose',
      onClick: !isJiraLoading ? onOpenBlockedIssues : undefined
    },
    {
      title:
        isGitHubLoading || gitHubMetrics.approvedPrCount === null
          ? 'Approved PRs'
          : `${gitHubMetrics.approvedPrCount} PR${gitHubMetrics.approvedPrCount === 1 ? '' : 's'} approved`,
      detail:
        gitHubMetrics.connectionStatus === 'connected'
          ? 'Ready to merge or follow through.'
          : 'Available once GitHub is connected.',
      tone: 'emerald',
      onClick:
        gitHubMetrics.connectionStatus === 'connected' && gitHubMetrics.approvedPrCount !== null
          ? onOpenApprovedPrs
          : undefined
    }
  ];
}

function getReviewAlertDetail(
  gitHubMetrics: GitHubSummaryMetrics,
  isGitHubLoading: boolean
) {
  if (isGitHubLoading) {
    return 'Loading GitHub review activity.';
  }

  if (gitHubMetrics.connectionStatus === 'invalid') {
    return 'GitHub token needs attention.';
  }

  if (gitHubMetrics.connectionStatus === 'error') {
    return 'GitHub is temporarily unavailable.';
  }

  if (gitHubMetrics.connectionStatus === 'not-connected') {
    return 'Connect GitHub to load review requests.';
  }

  if (gitHubMetrics.missingUsername) {
    return 'Add your GitHub username in Settings.';
  }

  return gitHubMetrics.reviewRequestedCount > 0 ? 'Waiting on your review.' : 'No review requests waiting.';
}

function DashboardAlert({ alert }: { alert: DashboardAlertItem }) {
  const toneClass =
    alert.tone === 'amber'
      ? 'bg-amber-300/[0.07] text-amber-50'
      : alert.tone === 'rose'
        ? 'bg-rose-300/[0.07] text-rose-50'
        : 'bg-emerald-300/[0.07] text-emerald-50';
  const iconClass =
    alert.tone === 'amber'
      ? 'bg-amber-400'
      : alert.tone === 'rose'
        ? 'bg-rose-400'
        : 'bg-emerald-400';

  const content = (
    <div className={`flex h-full items-start gap-3 rounded-[var(--radius-card)] px-5 py-5 shadow-[var(--shadow-card)] ${toneClass}`}>
      <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${iconClass}`} aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-base font-semibold leading-6 text-primary">{alert.title}</p>
        <p className="mt-1 text-sm text-secondary">{alert.detail}</p>
      </div>
    </div>
  );

  if (!alert.onClick) {
    return content;
  }

  return (
    <button
      type="button"
      onClick={alert.onClick}
      className="text-left transition hover:translate-y-[-1px] hover:opacity-100"
    >
      {content}
    </button>
  );
}

function IntegrationTabButton({
  label,
  isActive,
  onClick
}: {
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm transition ${
        isActive
          ? 'bg-white/10 text-primary shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]'
          : 'bg-white/[0.035] text-secondary hover:bg-white/[0.07] hover:text-primary'
      }`}
    >
      {label}
    </button>
  );
}

function GitHubIntegrationStatusBar({
  connectionStatus,
  isLoading,
  isCheckingActivity,
  lastUpdatedAt,
  lastCheckedAt,
  onRefresh
}: {
  connectionStatus: GitHubConnectionStatus;
  isLoading: boolean;
  isCheckingActivity: boolean;
  lastUpdatedAt: number | null;
  lastCheckedAt: number | null;
  onRefresh: () => void;
}) {
  const toneClass =
    connectionStatus === 'connected'
      ? 'bg-emerald-200/10 text-emerald-100'
      : connectionStatus === 'invalid'
        ? 'bg-rose-200/10 text-rose-100'
        : connectionStatus === 'testing' || connectionStatus === 'error'
          ? 'bg-amber-200/10 text-amber-100'
          : 'bg-white/6 text-stone-300';
  const label =
    connectionStatus === 'connected'
      ? 'Connected'
      : connectionStatus === 'invalid'
        ? 'Invalid token'
        : connectionStatus === 'testing'
          ? 'Testing'
          : connectionStatus === 'error'
            ? 'Connection error'
            : 'Not connected';

  return (
    <div className="ml-auto flex flex-col items-end gap-1.5">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <TopBarBadge className={toneClass}>{label}</TopBarBadge>
        <TopBarButton onClick={onRefresh} disabled={isLoading}>
          {isLoading ? 'Refreshing...' : 'Refresh'}
        </TopBarButton>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1 text-xs text-[var(--text-tertiary)]">
        <span>Updated {formatDashboardTime(lastUpdatedAt)}</span>
        <span>·</span>
        <span>
          Checked {formatDashboardTime(lastCheckedAt)}
          {isCheckingActivity ? ' · Checking…' : ''}
        </span>
      </div>
    </div>
  );
}

function JiraIntegrationStatusBar({
  connectionStatus,
  isLoading,
  lastUpdatedAt,
  onRefresh
}: {
  connectionStatus: JiraConnectionStatus;
  isLoading: boolean;
  lastUpdatedAt: number | null;
  onRefresh: () => void;
}) {
  const toneClass =
    connectionStatus === 'connected'
      ? 'bg-emerald-200/10 text-emerald-100'
      : connectionStatus === 'invalid'
        ? 'bg-rose-200/10 text-rose-100'
        : connectionStatus === 'testing' || connectionStatus === 'error'
          ? 'bg-amber-200/10 text-amber-100'
          : 'bg-white/6 text-stone-300';
  const label =
    connectionStatus === 'connected'
      ? 'Connected'
      : connectionStatus === 'invalid'
        ? 'Invalid credentials'
        : connectionStatus === 'testing'
          ? 'Testing'
          : connectionStatus === 'error'
            ? 'API error'
            : 'Not connected';

  return (
    <div className="ml-auto flex flex-col items-end gap-1.5">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <TopBarBadge className={toneClass}>{label}</TopBarBadge>
        <TopBarButton onClick={onRefresh} disabled={isLoading || connectionStatus === 'not-connected'}>
          {isLoading ? 'Refreshing...' : 'Refresh'}
        </TopBarButton>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1 text-xs text-[var(--text-tertiary)]">
        <span>Updated {formatDashboardTime(lastUpdatedAt)}</span>
      </div>
    </div>
  );
}

function TopBarBadge({
  children,
  className
}: {
  children: ReactNode;
  className: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] ${className}`}
    >
      {children}
    </span>
  );
}

function TopBarButton({
  children,
  disabled,
  onClick
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center rounded-full bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.2em] text-secondary transition hover:bg-white/10 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
    >
      {children}
    </button>
  );
}

function formatDashboardTime(value: number | null) {
  if (!value) {
    return 'Never';
  }

  return new Date(value).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit'
  });
}
