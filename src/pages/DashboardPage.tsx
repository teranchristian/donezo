import { type ReactNode, useEffect, useState } from 'react';
import { DashboardAlerts } from '../components/DashboardAlerts';
import { DashboardHeader } from '../components/DashboardHeader';
import {
  DashboardHeaderControls,
  DashboardIntegrationSwitcher,
} from '../components/DashboardHeaderControls';
import { GitHubRepoLauncher } from '../components/GitHubRepoLauncher';
import {
  GitHubCard,
  type GitHubSummaryMetrics,
} from '../components/GitHubCard';
import { JiraCard } from '../components/JiraCard';
import { SummaryCard } from '../components/SummaryCard';
import { useDashboardNavigation } from '../hooks/useDashboardNavigation';
import { useGitHubRepoLauncher } from '../hooks/useGitHubRepoLauncher';
import { useTodayFocusFallbacks } from '../hooks/useTodayFocusFallbacks';
import { useTodayFocusState } from '../hooks/useTodayFocusState';
import { type GitHubDashboardData } from '../lib/githubApi';
import { getJiraIssueCounts, type JiraDashboardData } from '../lib/jiraApi';
import { getDashboardAlerts } from '../lib/dashboardPageDomain';
import type {
  ActiveGitHubView,
  ActiveIntegration,
  ActiveJiraView,
  DashboardSettings,
  GitHubHiddenRepository,
  GitHubPrStatusFilter,
} from '../lib/storage';
import type { GitHubMockScenarioOption } from '../mocks/github/scenarios';
import type { TodayFocusRefreshSignal } from '../lib/todayFocusSync';

type DashboardPageProps = {
  settings: DashboardSettings;
  gitHubData: GitHubDashboardData;
  gitHubMockScenarioKey: string | null;
  isGitHubMockMode: boolean;
  gitHubMockScenarioOptions: GitHubMockScenarioOption[];
  isGitHubLoading: boolean;
  isCheckingGitHubActivity: boolean;
  lastGitHubActivityCheckAt: number | null;
  onClearGitHubMockScenario: () => void;
  onApplyGitHubMockScenario: (mockScenarioKey: string) => void;
  onRefreshGitHub: () => void;
  jiraData: JiraDashboardData;
  jiraRefreshSignal: TodayFocusRefreshSignal;
  isJiraLoading: boolean;
  onRefreshJira: () => void;
  onGitHubSummaryMetricsChange: (metrics: GitHubSummaryMetrics) => void;
  onUpdateSettings: (settings: DashboardSettings) => Promise<void>;
};

const EMPTY_GITHUB_SUMMARY_METRICS: GitHubSummaryMetrics = {
  connectionStatus: 'not-connected',
  missingUsername: true,
  openTeamPrCount: 0,
  readyToMergeCount: 0,
  failedBuildCount: 0,
  failedBuildBadgeCount: 0,
  highlightedCommentCount: 0,
  highlightedReadyCount: 0,
  highlightedWarningCount: 0,
  reviewRequestedCount: 0,
  approvedPrCount: null,
  relevantPrCount: 0,
};

export function DashboardPage({
  settings,
  gitHubData,
  gitHubMockScenarioKey,
  isGitHubMockMode,
  gitHubMockScenarioOptions,
  isGitHubLoading,
  isCheckingGitHubActivity,
  lastGitHubActivityCheckAt,
  onClearGitHubMockScenario,
  onApplyGitHubMockScenario,
  onRefreshGitHub,
  jiraData,
  jiraRefreshSignal,
  isJiraLoading,
  onRefreshJira,
  onGitHubSummaryMetricsChange,
  onUpdateSettings,
}: DashboardPageProps) {
  const [gitHubSummaryMetrics, setGitHubSummaryMetrics] =
    useState<GitHubSummaryMetrics>({
      ...EMPTY_GITHUB_SUMMARY_METRICS,
      connectionStatus: gitHubData.connectionStatus,
      missingUsername: gitHubData.missingUsername,
      relevantPrCount: gitHubData.openPrsCount,
    });
  const navigation = useDashboardNavigation({
    syncKey: gitHubMockScenarioKey,
  });
  const repoLauncher = useGitHubRepoLauncher({
    username: settings.integrations.github.username,
    token: settings.integrations.github.token,
    ownerFilter: settings.integrations.github.ownerFilter,
    hiddenRepositories: settings.integrations.github.hiddenRepositories,
    connectionStatus: gitHubData.connectionStatus,
    isLoadingSettings: false,
  });
  const todayFocus = useTodayFocusState({
    jiraIssues: jiraData.issues,
    gitHubPullRequests: gitHubData.pullRequests,
  });

  useEffect(() => {
    setGitHubSummaryMetrics((current) => ({
      ...current,
      connectionStatus: gitHubData.connectionStatus,
      missingUsername: gitHubData.missingUsername,
    }));
  }, [gitHubData.connectionStatus, gitHubData.missingUsername]);

  useEffect(() => {
    onGitHubSummaryMetricsChange(gitHubSummaryMetrics);
  }, [gitHubSummaryMetrics, onGitHubSummaryMetricsChange]);

  useTodayFocusFallbacks({
    settings,
    gitHubData,
    jiraData,
    jiraRefreshSignal,
    hasLoadedTodayFocusItems: todayFocus.hasLoadedTodayFocusItems,
    todayFocusItemsRef: todayFocus.todayFocusItemsRef,
    commitTodayFocusItems: todayFocus.commitTodayFocusItems,
  });

  if (!todayFocus.hasLoadedTodayFocusItems) {
    return null;
  }

  const jiraCounts = getJiraIssueCounts(jiraData.issues);
  const dashboardAlerts = getDashboardAlerts({
    gitHubMetrics: gitHubSummaryMetrics,
    jiraCounts,
    isGitHubLoading,
    isJiraLoading,
    onOpenGitHubPrs: () => navigation.navigateToGitHubPrs('all'),
    onOpenReviewRequestedPrs: () =>
      navigation.handleGitHubViewChange('review'),
    onOpenBlockedIssues: () => navigation.navigateToJiraView('blocking'),
    onOpenApprovedPrs: () => navigation.navigateToGitHubPrs('approved'),
  });
  const integrationSwitcher = (
    <DashboardIntegrationSwitcher
      activeIntegration={navigation.activeIntegration}
      onSetActiveIntegration={navigation.handleIntegrationChange}
    />
  );

  async function handleHideRepository(repository: GitHubHiddenRepository) {
    const hiddenRepositories = settings.integrations.github.hiddenRepositories;
    if (hiddenRepositories.some((entry) => entry.fullName === repository.fullName)) {
      return;
    }

    await onUpdateSettings({
      ...settings,
      integrations: {
        ...settings.integrations,
        github: {
          ...settings.integrations.github,
          hiddenRepositories: [...hiddenRepositories, repository].sort((left, right) =>
            left.fullName.localeCompare(right.fullName)
          )
        }
      }
    });
  }

  return (
    <main className="min-h-screen py-6 text-stone-100 sm:py-7">
      <div className="dashboard-container flex flex-col gap-5">
        <div className="dashboard-header-row">
          <DashboardHeader name={settings.name} />
          <DashboardHeaderControls
            activeIntegration={navigation.activeIntegration}
            repoLauncherControl={
              <GitHubRepoLauncher
                isOpen={repoLauncher.isOpen}
                isLoading={repoLauncher.isLoading}
                ownerFilter={settings.integrations.github.ownerFilter}
                query={repoLauncher.query}
                results={repoLauncher.results}
                selectedIndex={repoLauncher.selectedIndex}
                totalRepositoryCount={repoLauncher.repositories.length}
                totalVisibleRepositoryCount={repoLauncher.visibleRepositories.length}
                onOpen={repoLauncher.openLauncher}
                onClose={repoLauncher.closeLauncher}
                onQueryChange={repoLauncher.updateQuery}
                onSelectIndex={repoLauncher.setSelectedIndex}
                onSelectNext={repoLauncher.selectNextResult}
                onSelectPrevious={repoLauncher.selectPreviousResult}
                onOpenSelected={repoLauncher.openSelectedRepository}
                onOpenResult={repoLauncher.openRepositoryAtIndex}
                onHideRepository={handleHideRepository}
              />
            }
            gitHubSummaryMetrics={gitHubSummaryMetrics}
            jiraBlockingCount={jiraCounts.blocking}
            gitHubConnectionStatus={gitHubData.connectionStatus}
            jiraConnectionStatus={jiraData.connectionStatus}
            isGitHubLoading={isGitHubLoading}
            isJiraLoading={isJiraLoading}
            isCheckingGitHubActivity={isCheckingGitHubActivity}
            lastGitHubUpdatedAt={gitHubData.lastUpdatedAt}
            lastJiraUpdatedAt={jiraData.lastUpdatedAt}
            isGitHubMockMode={isGitHubMockMode}
            gitHubMockScenarioKey={gitHubMockScenarioKey}
            gitHubMockScenarioOptions={gitHubMockScenarioOptions}
            onRefreshGitHub={onRefreshGitHub}
            onRefreshJira={onRefreshJira}
            onOpenWarnings={() => navigation.navigateToGitHubPrs('all')}
            onOpenReadyToMerge={() =>
              navigation.navigateToGitHubPrs('ready-to-merge')
            }
            onOpenTeamPr={() => navigation.handleGitHubViewChange('team-prs')}
            onOpenJira={() => navigation.navigateToJiraView('blocking')}
            onApplyGitHubMockScenario={onApplyGitHubMockScenario}
            onClearGitHubMockScenario={onClearGitHubMockScenario}
          />
        </div>

        <section className="main-content flex flex-col gap-3">
          <DashboardAlerts alerts={dashboardAlerts} />
          <DashboardContent
            settings={settings}
            activeIntegration={navigation.activeIntegration}
            activeGitHubView={navigation.activeGitHubView}
            activeJiraView={navigation.activeJiraView}
            githubPrStatusFilter={navigation.githubPrStatusFilter}
            integrationSwitcher={integrationSwitcher}
            gitHubData={gitHubData}
            jiraData={jiraData}
            isGitHubMockMode={isGitHubMockMode}
            isGitHubLoading={isGitHubLoading}
            isCheckingGitHubActivity={isCheckingGitHubActivity}
            lastGitHubActivityCheckAt={lastGitHubActivityCheckAt}
            isJiraLoading={isJiraLoading}
            todayFocus={todayFocus}
            onRefreshGitHub={onRefreshGitHub}
            onRefreshJira={onRefreshJira}
            onGitHubSummaryMetricsChange={setGitHubSummaryMetrics}
            onGitHubViewChange={navigation.handleGitHubViewChange}
            onGitHubPrStatusFilterChange={
              navigation.handleGitHubPrStatusFilterChange
            }
            onHideRepository={handleHideRepository}
            onJiraViewChange={navigation.handleJiraViewChange}
          />
        </section>
      </div>
    </main>
  );
}

function DashboardContent({
  settings,
  activeIntegration,
  activeGitHubView,
  activeJiraView,
  githubPrStatusFilter,
  integrationSwitcher,
  gitHubData,
  jiraData,
  isGitHubMockMode,
  isGitHubLoading,
  isCheckingGitHubActivity,
  lastGitHubActivityCheckAt,
  isJiraLoading,
  todayFocus,
  onRefreshGitHub,
  onRefreshJira,
  onGitHubSummaryMetricsChange,
  onGitHubViewChange,
  onGitHubPrStatusFilterChange,
  onHideRepository,
  onJiraViewChange,
}: {
  settings: DashboardSettings;
  activeIntegration: ActiveIntegration;
  activeGitHubView: ActiveGitHubView;
  activeJiraView: ActiveJiraView;
  githubPrStatusFilter: GitHubPrStatusFilter;
  integrationSwitcher: ReactNode;
  gitHubData: GitHubDashboardData;
  jiraData: JiraDashboardData;
  isGitHubMockMode: boolean;
  isGitHubLoading: boolean;
  isCheckingGitHubActivity: boolean;
  lastGitHubActivityCheckAt: number | null;
  isJiraLoading: boolean;
  todayFocus: ReturnType<typeof useTodayFocusState>;
  onRefreshGitHub: () => void;
  onRefreshJira: () => void;
  onGitHubSummaryMetricsChange: (metrics: GitHubSummaryMetrics) => void;
  onGitHubViewChange: (view: ActiveGitHubView) => void;
  onGitHubPrStatusFilterChange: (filter: GitHubPrStatusFilter) => void;
  onHideRepository: (repository: GitHubHiddenRepository) => Promise<void>;
  onJiraViewChange: (view: ActiveJiraView) => void;
}) {
  return (
    <div className="dashboard-main-grid">
      <section className="dashboard-side-column">
        <SummaryCard
          items={todayFocus.todayFocusItems}
          jiraBaseUrl={settings.integrations.jira.baseUrl}
          warning={todayFocus.todayFocusWarning}
          onAddItem={todayFocus.handleAddTodayFocusItem}
          onNestNewPullRequest={todayFocus.handleNestNewTodayFocusPullRequest}
          onNestExistingPullRequest={
            todayFocus.handleNestExistingTodayFocusPullRequest
          }
          onRemoveItem={todayFocus.handleRemoveTodayFocusItem}
          onReorderTopLevelItem={todayFocus.handleReorderTopLevelTodayFocusItem}
          onMoveTopLevelItemToEnd={todayFocus.handleMoveTopLevelTodayFocusItemToEnd}
          onReorderNestedPullRequest={
            todayFocus.handleReorderNestedTodayFocusPullRequest
          }
        />
      </section>

      <section className="dashboard-panel-column">
        <div className="relative flex min-h-0">
          <div
            className={`min-h-0 flex-1 ${activeIntegration === 'github' ? 'flex' : 'hidden'}`}
            aria-hidden={activeIntegration !== 'github'}
          >
            <GitHubCard
              topBar={activeIntegration === 'github' ? integrationSwitcher : undefined}
              data={gitHubData}
              todayFocusItemIds={todayFocus.todayFocusItemIds}
              username={settings.integrations.github.username}
              ownerFilter={settings.integrations.github.ownerFilter}
              hiddenRepositories={settings.integrations.github.hiddenRepositories}
              isMockMode={isGitHubMockMode}
              isLoading={isGitHubLoading}
              onSummaryMetricsChange={onGitHubSummaryMetricsChange}
              activeView={activeGitHubView}
              prStatusFilter={githubPrStatusFilter}
              onViewChange={onGitHubViewChange}
              onPrStatusFilterChange={onGitHubPrStatusFilterChange}
              onHideRepository={onHideRepository}
            />
          </div>
          <div
            className={`min-h-0 flex-1 ${activeIntegration === 'jira' ? 'flex' : 'hidden'}`}
            aria-hidden={activeIntegration !== 'jira'}
          >
            <JiraCard
              topBar={activeIntegration === 'jira' ? integrationSwitcher : undefined}
              baseUrl={settings.integrations.jira.baseUrl}
              data={jiraData}
              todayFocusItemIds={todayFocus.todayFocusItemIds}
              isLoading={isJiraLoading}
              onRefresh={onRefreshJira}
              activeView={activeJiraView}
              onViewChange={onJiraViewChange}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
