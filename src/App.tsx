import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { testGitHubConnection, type GitHubConnectionStatus } from './lib/github';
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
  const [savedGitHubStatus, setSavedGitHubStatus] = useState<GitHubConnectionStatus>('not-connected');
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

    const savedToken = settings.integrations.github.token.trim();
    if (!savedToken) {
      setSavedGitHubStatus('not-connected');
      setSettingsTestStatus('not-connected');
      return;
    }

    let active = true;
    setSavedGitHubStatus('testing');

    testGitHubConnection(savedToken).then((status) => {
      if (!active) {
        return;
      }

      setSavedGitHubStatus(status);
      setSettingsTestStatus(status);
    });

    return () => {
      active = false;
    };
  }, [isLoadingSettings, settings.integrations.github.token]);

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

  return (
    <Routes>
      <Route
        path="/"
        element={<DashboardPage settings={settings} gitHubStatus={savedGitHubStatus} />}
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
