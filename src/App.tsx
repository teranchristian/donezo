import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import {
  getEmptyGitHubDashboardData,
  loadGitHubDashboardData,
  testGitHubConnection,
  type GitHubConnectionStatus,
  type GitHubDashboardData
} from './lib/githubApi';
import {
  getDefaultSettings,
  getStoredSettings,
  saveStoredSettings,
  type DashboardSettings
} from './lib/storage';
import { DashboardPage } from './pages/DashboardPage';
import { SettingsPage } from './pages/SettingsPage';

export default function App() {
  const [settings, setSettings] = useState<DashboardSettings>(getDefaultSettings);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [gitHubData, setGitHubData] = useState<GitHubDashboardData>(getEmptyGitHubDashboardData());
  const [isGitHubLoading, setIsGitHubLoading] = useState(false);
  const [settingsTestStatus, setSettingsTestStatus] = useState<GitHubConnectionStatus>('not-connected');
  const [isTestingSettings, setIsTestingSettings] = useState(false);

  useEffect(() => {
    let active = true;

    getStoredSettings().then((storedSettings) => {
      if (!active) {
        return;
      }

      setSettings(storedSettings);
      setIsLoadingSettings(false);
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (isLoadingSettings) {
      return;
    }

    let active = true;
    setIsGitHubLoading(true);

    loadGitHubDashboardData({
      username: settings.integrations.github.username,
      token: settings.integrations.github.token
    }).then((data) => {
      if (!active) {
        return;
      }

      setGitHubData(data);
      setSettingsTestStatus(data.connectionStatus);
      setIsGitHubLoading(false);
    });

    return () => {
      active = false;
    };
  }, [isLoadingSettings, settings.integrations.github.username, settings.integrations.github.token]);

  async function handleSaveSettings(nextSettings: DashboardSettings) {
    await saveStoredSettings(nextSettings);
    setSettings(nextSettings);
  }

  async function handleTestGitHubConnection(token: string) {
    setIsTestingSettings(true);
    setSettingsTestStatus('testing');

    const status = await testGitHubConnection(token);

    setSettingsTestStatus(status);
    setIsTestingSettings(false);
    return status;
  }

  async function handleRefreshGitHub() {
    setIsGitHubLoading(true);

    const data = await loadGitHubDashboardData({
      username: settings.integrations.github.username,
      token: settings.integrations.github.token,
      forceRefresh: true
    });

    setGitHubData(data);
    setSettingsTestStatus(data.connectionStatus);
    setIsGitHubLoading(false);
  }

  const gitHubSummary = getGitHubSummary(gitHubData, isGitHubLoading);

  return (
    <Routes>
      <Route
        path="/"
        element={
          <DashboardPage
            settings={settings}
            gitHubData={gitHubData}
            gitHubSummary={gitHubSummary}
            isGitHubLoading={isGitHubLoading}
            onRefreshGitHub={() => void handleRefreshGitHub()}
          />
        }
      />
      <Route
        path="/settings"
        element={
          <SettingsPage
            settings={settings}
            onSave={handleSaveSettings}
            onTestConnection={handleTestGitHubConnection}
            testStatus={settingsTestStatus}
            isTesting={isTestingSettings}
          />
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function getGitHubSummary(data: GitHubDashboardData, isLoading: boolean) {
  if (isLoading) {
    return 'Today: loading GitHub activity...';
  }

  if (data.connectionStatus === 'not-connected') {
    return 'Today: connect GitHub to load notifications and pull requests.';
  }

  if (data.connectionStatus === 'invalid') {
    return 'Today: GitHub token is invalid. Update it in Settings.';
  }

  if (data.connectionStatus === 'error') {
    return 'Today: GitHub data is temporarily unavailable.';
  }

  if (data.missingUsername) {
    return 'Today: GitHub is connected, but your username is missing in Settings.';
  }

  return `Today: ${data.notificationsCount} GitHub notifications, ${data.openPrsCount} open PRs, ${data.reviewRequestedCount} waiting for review.`;
}
