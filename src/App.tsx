import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import {
  getDefaultSettings,
  getStoredSettings,
  saveStoredSettings,
  type DashboardSettings
} from './lib/storage';
import { getGitHubMockScenarioOptions } from './mocks/github/scenarios';
import { type GitHubSummaryMetrics } from './components/GitHubCard';
import { DashboardPage } from './pages/DashboardPage';
import { SettingsPage } from './pages/SettingsPage';
import { useFaviconState } from './hooks/useFaviconState';
import { useGitHubDashboard } from './hooks/useGitHubDashboard';
import { useGitHubMockMode } from './hooks/useGitHubMockMode';
import { useJiraDashboard } from './hooks/useJiraDashboard';

const DEFAULT_GITHUB_SUMMARY_METRICS: GitHubSummaryMetrics = {
  connectionStatus: 'not-connected',
  missingUsername: true,
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
  const [settings, setSettings] = useState<DashboardSettings>(getDefaultSettings);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
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

  useEffect(() => {
    let active = true;

    const loadInitialState = async () => {
      const storedSettings = await getStoredSettings();
      if (!active) {
        return;
      }

      setSettings(storedSettings);
      setIsLoadingSettings(false);
    };

    void loadInitialState();

    return () => {
      active = false;
    };
  }, []);

  async function handleSaveSettings(nextSettings: DashboardSettings) {
    await saveStoredSettings(nextSettings);
    setSettings(nextSettings);
  }

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
              onSave={handleSaveSettings}
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
        <div className="flex h-24 w-24 items-center justify-center rounded-[28px] border border-white/10 bg-white/[0.04] shadow-[var(--shadow-card)]">
          <svg
            viewBox="0 0 24 24"
            className="h-10 w-10 text-white/72"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 16V6" />
            <path d="m8.5 9.5 3.5-3.5 3.5 3.5" />
            <path d="M5 18.5h14" />
          </svg>
        </div>
        <h1 className="mt-6 text-[1.5rem] font-semibold tracking-[-0.03em] text-primary">
          Updating dashboard
        </h1>
        <p className="mt-2 max-w-sm text-sm leading-6 text-secondary">
          Loading the latest GitHub and Jira data for this dashboard view.
        </p>
      </div>
    </main>
  );
}
