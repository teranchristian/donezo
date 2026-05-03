import { ReactNode, useEffect, useState } from 'react';
import { DashboardHeader } from '../components/DashboardHeader';
import { GitHubCard, type GitHubSummaryMetrics } from '../components/GitHubCard';
import { JiraCard } from '../components/JiraCard';
import { NotesCard } from '../components/NotesCard';
import { PlaceholderCard } from '../components/PlaceholderCard';
import { SummaryCard, TODAY_FOCUS_MAX_ITEMS } from '../components/SummaryCard';
import { GitHubConnectionStatus, GitHubDashboardData } from '../lib/githubApi';
import { getJiraIssueCounts, JiraConnectionStatus, JiraDashboardData } from '../lib/jiraApi';
import {
  buildDashboardHashNavigation,
  parseDashboardHashNavigation
} from '../lib/dashboardRouting';
import {
  DashboardSettings,
  FocusItem,
  getStoredActiveGitHubView,
  getStoredActiveIntegration,
  getStoredActiveJiraView,
  getStoredGitHubPrStatusFilter,
  getStoredTodayFocusItems,
  saveStoredActiveIntegration,
  saveStoredActiveGitHubView,
  saveStoredActiveJiraView,
  saveStoredGitHubPrStatusFilter,
  saveStoredTodayFocusItems,
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
  const [todayFocusItems, setTodayFocusItems] = useState<FocusItem[]>([]);
  const [todayFocusWarning, setTodayFocusWarning] = useState<string | null>(null);
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
    let isMounted = true;

    getStoredTodayFocusItems().then((storedItems) => {
      if (!isMounted) {
        return;
      }

      const nextItems = storedItems ?? getDefaultTodayFocusItems();
      setTodayFocusItems(nextItems);
      if (storedItems === null) {
        void saveStoredTodayFocusItems(nextItems);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    setGitHubSummaryMetrics((current) => ({
      ...current,
      connectionStatus: gitHubData.connectionStatus,
      missingUsername: gitHubData.missingUsername
    }));
  }, [gitHubData.connectionStatus, gitHubData.missingUsername]);

  const jiraCounts = getJiraIssueCounts(jiraData.issues);
  const dashboardAlerts = getDashboardAlerts({
    gitHubMetrics: gitHubSummaryMetrics,
    jiraCounts,
    isGitHubLoading,
    isJiraLoading,
    onOpenGitHubPrs: () => {
      navigateToGitHubPrs('all');
    },
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

  function handleAddTodayFocusItem(item: FocusItem) {
    setTodayFocusWarning(null);

    if (todayFocusItems.some((currentItem) => currentItem.id === item.id)) {
      setTodayFocusWarning('That item is already in Today focus.');
      return;
    }

    if (todayFocusItems.length >= TODAY_FOCUS_MAX_ITEMS) {
      setTodayFocusWarning('Today focus already has 3 items.');
      return;
    }

    const nextItems = [...todayFocusItems, item];
    setTodayFocusItems(nextItems);
    void saveStoredTodayFocusItems(nextItems);
  }

  function handleRemoveTodayFocusItem(itemId: string) {
    setTodayFocusWarning(null);
    const nextItems = todayFocusItems.filter((item) => item.id !== itemId);
    setTodayFocusItems(nextItems);
    void saveStoredTodayFocusItems(nextItems);
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
  const [primaryAlert, ...secondaryAlerts] = dashboardAlerts;

  return (
    <main className="min-h-screen py-6 text-stone-100 sm:py-7">
      <div className="dashboard-container flex flex-col gap-5">
        <div className="dashboard-header-row">
          <DashboardHeader name={settings.name} />
          <div className="dashboard-header-status">{integrationStatusBar}</div>
        </div>

        <section className="main-content flex flex-col gap-3">
          <div className="summary-cards-grid">
            {primaryAlert ? <DashboardAlert alert={primaryAlert} /> : null}
            {secondaryAlerts.map((alert) => (
              <DashboardAlert key={alert.title} alert={alert} />
            ))}
          </div>

          <div className="dashboard-main-grid">
            <section className="dashboard-side-column">
              <SummaryCard
                items={todayFocusItems}
                warning={todayFocusWarning}
                onAddItem={handleAddTodayFocusItem}
                onRemoveItem={handleRemoveTodayFocusItem}
              />
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

            <section className="dashboard-panel-column">
              <div className="relative flex min-h-0">
                <div
                  className={`min-h-0 flex-1 ${activeIntegration === 'github' ? 'flex' : 'hidden'}`}
                  aria-hidden={activeIntegration !== 'github'}
                >
                  <GitHubCard
                    topBar={integrationSwitcher}
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
                    topBar={integrationSwitcher}
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

function getDefaultTodayFocusItems(): FocusItem[] {
  return [
    {
      id: 'focus-jira-clk-112',
      source: 'jira',
      sourceLabel: 'Jira',
      reference: 'CLK-112',
      title: 'Fix lead status bug in dashboard',
      statusLabel: 'In Progress',
      statusTone: 'violet'
    },
    {
      id: 'focus-github-142',
      source: 'github',
      sourceLabel: 'GitHub',
      reference: '#142',
      title: 'Fix venue provision defaults',
      statusLabel: 'Approved',
      statusTone: 'emerald'
    }
  ];
}

type DashboardAlertItem = {
  value: string;
  title: string;
  detail: string;
  tone: 'amber' | 'rose' | 'emerald' | 'blue';
  onClick?: () => void;
};

function getDashboardAlerts(options: {
  gitHubMetrics: GitHubSummaryMetrics;
  jiraCounts: ReturnType<typeof getJiraIssueCounts>;
  isGitHubLoading: boolean;
  isJiraLoading: boolean;
  onOpenGitHubPrs: () => void;
  onOpenReviewRequestedPrs: () => void;
  onOpenBlockedIssues: () => void;
  onOpenApprovedPrs: () => void;
}): DashboardAlertItem[] {
  const {
    gitHubMetrics,
    jiraCounts,
    isGitHubLoading,
    isJiraLoading,
    onOpenGitHubPrs,
    onOpenReviewRequestedPrs,
    onOpenBlockedIssues,
    onOpenApprovedPrs
  } = options;

  return [
    {
      value:
        isGitHubLoading || gitHubMetrics.connectionStatus !== 'connected'
          ? '0'
          : String(gitHubMetrics.reviewRequestedCount),
      title: 'PRs ready for review',
      detail: getReviewAlertDetail(gitHubMetrics, isGitHubLoading),
      tone: 'amber',
      onClick:
        gitHubMetrics.connectionStatus === 'connected' && !isGitHubLoading
          ? onOpenReviewRequestedPrs
          : undefined
    },
    {
      value: isJiraLoading ? '0' : String(jiraCounts.blocking),
      title: jiraCounts.blocking === 1 ? 'Blocked item' : 'Blocked items',
      detail: isJiraLoading ? 'Checking Jira blockers.' : 'Needs your input.',
      tone: 'rose',
      onClick: !isJiraLoading ? onOpenBlockedIssues : undefined
    },
    {
      value:
        isGitHubLoading || gitHubMetrics.approvedPrCount === null ? '0' : String(gitHubMetrics.approvedPrCount),
      title: 'PRs approved',
      detail:
        gitHubMetrics.connectionStatus === 'connected'
          ? 'Ready to merge or follow through.'
          : 'Available once GitHub is connected.',
      tone: 'emerald',
      onClick:
        gitHubMetrics.connectionStatus === 'connected' && gitHubMetrics.approvedPrCount !== null
          ? onOpenApprovedPrs
          : undefined
    },
    {
      value:
        isGitHubLoading || gitHubMetrics.connectionStatus !== 'connected'
          ? '0'
          : String(gitHubMetrics.relevantPrCount),
      title: 'PRs open',
      detail:
        gitHubMetrics.connectionStatus === 'connected'
          ? 'Across repositories.'
          : 'Available once GitHub is connected.',
      tone: 'blue',
      onClick: gitHubMetrics.connectionStatus === 'connected' ? onOpenGitHubPrs : undefined
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
  const iconWrapClass =
    alert.tone === 'amber'
      ? 'bg-amber-500/14 text-amber-300'
      : alert.tone === 'rose'
        ? 'bg-rose-500/14 text-rose-300'
        : alert.tone === 'emerald'
          ? 'bg-emerald-500/14 text-emerald-300'
          : 'bg-sky-500/14 text-sky-300';

  const content = (
    <div
      className="flex h-full min-h-[84px] items-center gap-2.5 rounded-[var(--radius-card)] border border-white/[0.06] bg-[rgba(255,255,255,0.028)] px-3 py-2.5 shadow-[var(--shadow-card)] backdrop-blur-[var(--card-blur)]"
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${iconWrapClass}`}
        aria-hidden="true"
      >
        <DashboardAlertIcon tone={alert.tone} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-baseline gap-2">
          <p className="shrink-0 text-[1.7rem] font-semibold leading-none tracking-[-0.045em] text-primary">
            {alert.value}
          </p>
          <p className="min-w-0 truncate text-[0.82rem] font-medium leading-4 text-primary">{alert.title}</p>
        </div>
        <p className="mt-0.5 text-[0.72rem] leading-4 text-secondary">{alert.detail}</p>
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
      className="dashboard-summary-button text-left transition hover:translate-y-[-1px] hover:opacity-100"
    >
      {content}
    </button>
  );
}

function DashboardAlertIcon({
  tone
}: {
  tone: DashboardAlertItem['tone'];
}) {
  if (tone === 'amber') {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="8" />
        <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (tone === 'rose') {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="8" />
        <path d="M12 8v5" strokeLinecap="round" />
        <circle cx="12" cy="16.5" r="0.9" fill="currentColor" stroke="none" />
      </svg>
    );
  }

  if (tone === 'emerald') {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="8" />
        <path d="m8.5 12 2.4 2.4L15.8 9.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="6.5" cy="6.5" r="1.6" />
      <circle cx="17.5" cy="6.5" r="1.6" />
      <circle cx="12" cy="17.5" r="1.6" />
      <path d="M8 7.4h8" strokeLinecap="round" />
      <path d="M7.4 8l3.5 7.2" strokeLinecap="round" />
      <path d="M16.6 8 13 15.2" strokeLinecap="round" />
    </svg>
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
    <div className="ml-auto flex flex-col items-end gap-1">
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        <TopBarBadge className={toneClass}>{label}</TopBarBadge>
        <TopBarButton onClick={onRefresh} disabled={isLoading}>
          {isLoading ? 'Refreshing...' : 'Refresh'}
        </TopBarButton>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1 text-[0.68rem] text-white/32">
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
    <div className="ml-auto flex flex-col items-end gap-1">
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        <TopBarBadge className={toneClass}>{label}</TopBarBadge>
        <TopBarButton onClick={onRefresh} disabled={isLoading || connectionStatus === 'not-connected'}>
          {isLoading ? 'Refreshing...' : 'Refresh'}
        </TopBarButton>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1 text-[0.68rem] text-white/32">
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
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[0.62rem] font-medium uppercase tracking-[0.14em] ${className}`}
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
      className="inline-flex items-center rounded-full bg-white/[0.045] px-2.5 py-0.5 text-[0.62rem] uppercase tracking-[0.16em] text-white/48 transition hover:bg-white/[0.08] hover:text-white/72 disabled:cursor-not-allowed disabled:opacity-50"
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
