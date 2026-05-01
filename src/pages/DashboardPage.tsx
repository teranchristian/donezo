import { useEffect, useState } from 'react';
import { DashboardHeader } from '../components/DashboardHeader';
import { GitHubCard, type GitHubSummaryMetrics } from '../components/GitHubCard';
import { HeaderMenu } from '../components/HeaderMenu';
import { JiraCard } from '../components/JiraCard';
import { NotesCard } from '../components/NotesCard';
import { PlaceholderCard } from '../components/PlaceholderCard';
import { SummaryCard, type SummaryContent } from '../components/SummaryCard';
import { GitHubConnectionStatus, GitHubDashboardData } from '../lib/githubApi';
import { getJiraIssueCounts, JiraDashboardData } from '../lib/jiraApi';
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

  return (
    <main className="min-h-screen bg-page-glow px-5 py-6 text-stone-100 sm:px-8 lg:px-12">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <div className="flex items-start justify-between gap-4">
          <DashboardHeader name={settings.name} />
          <HeaderMenu />
        </div>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]">
          <section className="flex flex-col gap-6">
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

          <section className="flex min-h-0 flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2 rounded-[24px] border border-white/5 bg-panel/95 p-3 shadow-panel backdrop-blur-sm">
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

            <div className="relative flex min-h-0 flex-1">
              <div
                className={`min-h-0 flex-1 ${activeIntegration === 'github' ? 'flex' : 'hidden'}`}
                aria-hidden={activeIntegration !== 'github'}
              >
                <GitHubCard
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
      className={`rounded-full border px-4 py-2 text-sm transition ${
        isActive
          ? 'border-white/20 bg-white/10 text-stone-100'
          : 'border-white/8 bg-black/10 text-stone-400 hover:border-white/15 hover:bg-black/20 hover:text-stone-200'
      }`}
    >
      {label}
    </button>
  );
}
