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

  const dashboardElement = (
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
  );

  if (
    isLoadingSettings ||
    !gitHubDashboard.isGitHubInitialized ||
    !jiraDashboard.isJiraInitialized ||
    gitHubMockMode.isLoading ||
    (gitHubMockMode.isGitHubMockMode && !gitHubDashboard.isGitHubMockReady)
  ) {
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
