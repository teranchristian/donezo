import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { getGitHubMockScenarioOptions } from './mocks/github/scenarios';
import { type GitHubSummaryMetrics } from './components/GitHubCard';
import { DashboardPage } from './pages/DashboardPage';
import { SettingsPage } from './pages/SettingsPage';
import { useDashboardSettings } from './hooks/useDashboardSettings';
import { useFaviconState } from './hooks/useFaviconState';
import { useGitHubDashboard } from './hooks/useGitHubDashboard';
import { useGitHubMockMode } from './hooks/useGitHubMockMode';
import { useJiraDashboard } from './hooks/useJiraDashboard';

const DEFAULT_GITHUB_SUMMARY_METRICS: GitHubSummaryMetrics = {
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
  relevantPrCount: 0
};
const DASHBOARD_LOADING_OVERLAY_DELAY_MS = 400;

export default function App() {
  const {
    settings,
    isLoadingSettings,
    saveSettings,
  } = useDashboardSettings();
  const [gitHubSummaryMetrics, setGitHubSummaryMetrics] =
    useState<GitHubSummaryMetrics>(DEFAULT_GITHUB_SUMMARY_METRICS);
  const gitHubMockMode = useGitHubMockMode();
  const gitHubDashboard = useGitHubDashboard({
    settings: settings.integrations.github,
    isLoadingSettings,
    gitHubMockScenario: gitHubMockMode.gitHubMockScenario
  });
  const jiraDashboard = useJiraDashboard({
    settings: settings.integrations.jira,
    isLoadingSettings
  });
  const [shouldShowDelayedDashboardLoader, setShouldShowDelayedDashboardLoader] =
    useState(false);

  useFaviconState(gitHubSummaryMetrics);

  const isDashboardReady =
    gitHubDashboard.isGitHubInitialized &&
    jiraDashboard.isJiraInitialized &&
    (!gitHubMockMode.isGitHubMockMode || gitHubDashboard.isGitHubMockReady);

  useEffect(() => {
    if (isLoadingSettings || gitHubMockMode.isLoading || isDashboardReady) {
      setShouldShowDelayedDashboardLoader(false);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setShouldShowDelayedDashboardLoader(true);
    }, DASHBOARD_LOADING_OVERLAY_DELAY_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [gitHubMockMode.isLoading, isDashboardReady, isLoadingSettings]);

  const dashboardElement = (
    isDashboardReady ? (
      <DashboardPage
        settings={settings}
        gitHubData={gitHubDashboard.gitHubData}
        gitHubMockScenarioKey={gitHubMockMode.gitHubMockScenarioKey}
        isGitHubMockMode={gitHubMockMode.isGitHubMockMode}
        gitHubMockScenarioOptions={getGitHubMockScenarioOptions()}
        isGitHubLoading={gitHubDashboard.isGitHubLoading}
        isCheckingGitHubActivity={gitHubDashboard.isCheckingGitHubActivity}
        lastGitHubActivityCheckAt={gitHubDashboard.lastGitHubActivityCheckAt}
        onClearGitHubMockScenario={() => void gitHubMockMode.clearMockScenario()}
        onApplyGitHubMockScenario={(mockScenarioKey) => void gitHubMockMode.applyMockScenario(mockScenarioKey)}
        onRefreshGitHub={() => void gitHubDashboard.refresh()}
        jiraData={jiraDashboard.jiraData}
        jiraRefreshSignal={jiraDashboard.jiraRefreshSignal}
        isJiraLoading={jiraDashboard.isJiraLoading}
        onRefreshJira={() => void jiraDashboard.refresh()}
        onGitHubSummaryMetricsChange={setGitHubSummaryMetrics}
        onUpdateSettings={saveSettings}
      />
    ) : (
      shouldShowDelayedDashboardLoader ? (
        <DashboardLoadingScreen />
      ) : (
        <div className="app-background" />
      )
    )
  );

  if (isLoadingSettings || gitHubMockMode.isLoading) {
    return <div className="app-background" />;
  }

  return (
    <div className="app-background">
      <Routes>
        <Route path="/" element={dashboardElement} />
        <Route path="/github" element={dashboardElement} />
        <Route path="/jira" element={dashboardElement} />
        <Route
          path="/settings"
          element={
            <SettingsPage
              settings={settings}
              gitHubOwnerOptions={gitHubDashboard.gitHubOwnerOptions}
              onLoadGitHubOwnerOptions={gitHubDashboard.loadOwnerOptions}
              onSave={saveSettings}
              onTestGitHubConnection={gitHubDashboard.testConnectionStatus}
              onTestJiraConnection={jiraDashboard.testConnectionStatus}
              isGitHubDevModeEnabled={gitHubMockMode.isGitHubMockMode}
              onSetGitHubDevMode={gitHubMockMode.setGitHubDevMode}
              gitHubTestStatus={gitHubDashboard.gitHubSettingsTestStatus}
              jiraTestStatus={jiraDashboard.jiraSettingsTestStatus}
              jiraErrorMessage={jiraDashboard.jiraErrorMessage}
              isTestingGitHub={gitHubDashboard.isTestingGitHubSettings}
              isTestingJira={jiraDashboard.isTestingJiraSettings}
            />
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

function DashboardLoadingScreen() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-10 text-stone-100">
      <div className="flex max-w-md flex-col items-center text-center">
        <div className="relative flex h-32 w-32 items-center justify-center rounded-[34px] bg-[linear-gradient(180deg,rgba(255,255,255,0.055),rgba(255,255,255,0.02))] shadow-[0_22px_55px_rgba(0,0,0,0.36),inset_0_1px_0_rgba(255,255,255,0.05)]">
          <div className="absolute inset-[1px] rounded-[33px] border border-white/[0.05] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.025),rgba(255,255,255,0.01)_45%,rgba(255,255,255,0.012)_100%)]" />
          <img
            src="/logo-cropped.png"
            alt=""
            aria-hidden="true"
            className="relative h-16 w-16 object-contain drop-shadow-[0_6px_24px_rgba(44,108,255,0.22)]"
          />
        </div>
        <h1 className="mt-8 text-[1.5rem] font-semibold tracking-[-0.04em] text-primary sm:text-[1.7rem]">
          Updating dashboard
        </h1>
        <div
          className="mt-4 flex items-center justify-center gap-2"
          aria-label="Loading"
          role="status"
        >
          {[0, 1, 2].map((index) => (
            <span
              key={index}
              className="h-2 w-2 animate-pulse rounded-full bg-white/50"
              style={{ animationDelay: `${index * 180}ms` }}
            />
          ))}
        </div>
        <p className="mt-5 max-w-[34rem] text-base leading-8 text-secondary/90">
          Loading the latest data for this dashboard view.
        </p>
      </div>
    </main>
  );
}
