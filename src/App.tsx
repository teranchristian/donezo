import { useEffect, useRef, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import {
  getEmptyGitHubDashboardData,
  loadGitHubDashboardData,
  pollGitHubNotificationActivity,
  testGitHubConnection,
  type GitHubConnectionStatus,
  type GitHubDashboardData
} from './lib/githubApi';
import {
  getEmptyJiraDashboardData,
  loadJiraDashboardData,
  testJiraConnection,
  type JiraConnectionStatus,
  type JiraDashboardData,
  type JiraProfile
} from './lib/jiraApi';
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
  const [isCheckingGitHubActivity, setIsCheckingGitHubActivity] = useState(false);
  const [lastGitHubActivityCheckAt, setLastGitHubActivityCheckAt] = useState<number | null>(null);
  const [gitHubSettingsTestStatus, setGitHubSettingsTestStatus] =
    useState<GitHubConnectionStatus>('not-connected');
  const [isTestingGitHubSettings, setIsTestingGitHubSettings] = useState(false);
  const [jiraSettingsTestStatus, setJiraSettingsTestStatus] =
    useState<JiraConnectionStatus>('not-connected');
  const [isTestingJiraSettings, setIsTestingJiraSettings] = useState(false);
  const [jiraProfile, setJiraProfile] = useState<JiraProfile | null>(null);
  const [jiraErrorMessage, setJiraErrorMessage] = useState<string>('');
  const [jiraData, setJiraData] = useState<JiraDashboardData>(getEmptyJiraDashboardData());
  const [isJiraLoading, setIsJiraLoading] = useState(false);
  const isMountedRef = useRef(true);
  const isGitHubRefreshInFlightRef = useRef(false);
  const isJiraRefreshInFlightRef = useRef(false);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

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

    void refreshGitHubData({
      username: settings.integrations.github.username,
      token: settings.integrations.github.token,
      showLoadingIndicator: true
    });
  }, [isLoadingSettings, settings.integrations.github.username, settings.integrations.github.token]);

  useEffect(() => {
    if (isLoadingSettings) {
      return;
    }

    void refreshJiraData({
      baseUrl: settings.integrations.jira.baseUrl,
      email: settings.integrations.jira.email,
      apiToken: settings.integrations.jira.apiToken,
      showLoadingIndicator: true
    });
  }, [
    isLoadingSettings,
    settings.integrations.jira.apiToken,
    settings.integrations.jira.baseUrl,
    settings.integrations.jira.email
  ]);

  useEffect(() => {
    if (isLoadingSettings) {
      return;
    }

    const { baseUrl, email, apiToken } = settings.integrations.jira;
    if (!baseUrl.trim() || !email.trim() || !apiToken.trim()) {
      setJiraSettingsTestStatus('not-connected');
      setJiraProfile(null);
      setJiraErrorMessage('');
      return;
    }

    let isCancelled = false;
    setJiraSettingsTestStatus('testing');

    void testJiraConnection(baseUrl, email, apiToken).then((result) => {
      if (isCancelled || !isMountedRef.current) {
        return;
      }

      setJiraSettingsTestStatus(result.status);
      setJiraProfile(result.profile);
      setJiraErrorMessage(result.errorMessage ?? '');
    });

    return () => {
      isCancelled = true;
    };
  }, [isLoadingSettings, settings.integrations.jira.apiToken, settings.integrations.jira.baseUrl, settings.integrations.jira.email]);

  useEffect(() => {
    if (isLoadingSettings) {
      return;
    }

    const username = settings.integrations.github.username;
    const token = settings.integrations.github.token.trim();
    if (!token) {
      return;
    }

    let isCancelled = false;

    const pollForGitHubActivity = async () => {
      if (isCancelled || isGitHubRefreshInFlightRef.current) {
        return;
      }

      setIsCheckingGitHubActivity(true);

      try {
        const result = await pollGitHubNotificationActivity({ username, token });
        if (!isCancelled && isMountedRef.current) {
          setLastGitHubActivityCheckAt(Date.now());
        }

        if (isCancelled || !result.hasChanges) {
          return;
        }

        await refreshGitHubData({
          username,
          token,
          forceRefresh: true,
          showLoadingIndicator: false
        });
      } finally {
        if (!isCancelled && isMountedRef.current) {
          setIsCheckingGitHubActivity(false);
        }
      }
    };

    const intervalId = window.setInterval(() => {
      void pollForGitHubActivity();
    }, 60 * 1000);

    return () => {
      isCancelled = true;
      window.clearInterval(intervalId);
    };
  }, [isLoadingSettings, settings.integrations.github.username, settings.integrations.github.token]);

  async function handleSaveSettings(nextSettings: DashboardSettings) {
    await saveStoredSettings(nextSettings);
    setSettings(nextSettings);
  }

  async function handleTestGitHubConnection(token: string) {
    setIsTestingGitHubSettings(true);
    setGitHubSettingsTestStatus('testing');

    const status = await testGitHubConnection(token);

    setGitHubSettingsTestStatus(status);
    setIsTestingGitHubSettings(false);
    return status;
  }

  async function handleTestJiraConnection(baseUrl: string, email: string, apiToken: string) {
    setIsTestingJiraSettings(true);
    setJiraSettingsTestStatus('testing');

    const result = await testJiraConnection(baseUrl, email, apiToken);

    setJiraSettingsTestStatus(result.status);
    setJiraProfile(result.profile);
    setJiraErrorMessage(result.errorMessage ?? '');
    setIsTestingJiraSettings(false);
    return result.status;
  }

  async function handleRefreshGitHub() {
    await refreshGitHubData({
      username: settings.integrations.github.username,
      token: settings.integrations.github.token,
      forceRefresh: true,
      showLoadingIndicator: true
    });
  }

  async function handleRefreshJira() {
    await refreshJiraData({
      baseUrl: settings.integrations.jira.baseUrl,
      email: settings.integrations.jira.email,
      apiToken: settings.integrations.jira.apiToken,
      forceRefresh: true,
      showLoadingIndicator: true
    });
  }

  async function refreshGitHubData(options: {
    username: string;
    token: string;
    forceRefresh?: boolean;
    showLoadingIndicator: boolean;
  }) {
    if (isGitHubRefreshInFlightRef.current) {
      return;
    }

    isGitHubRefreshInFlightRef.current = true;
    if (options.showLoadingIndicator) {
      setIsGitHubLoading(true);
    }

    try {
      const data = await loadGitHubDashboardData({
        username: options.username,
        token: options.token,
        forceRefresh: options.forceRefresh
      });

      if (!isMountedRef.current) {
        return;
      }

      setGitHubData(data);
      setGitHubSettingsTestStatus(data.connectionStatus);
    } finally {
      isGitHubRefreshInFlightRef.current = false;

      if (options.showLoadingIndicator && isMountedRef.current) {
        setIsGitHubLoading(false);
      }
    }
  }

  async function refreshJiraData(options: {
    baseUrl: string;
    email: string;
    apiToken: string;
    forceRefresh?: boolean;
    showLoadingIndicator: boolean;
  }) {
    if (isJiraRefreshInFlightRef.current) {
      return;
    }

    isJiraRefreshInFlightRef.current = true;
    if (options.showLoadingIndicator) {
      setIsJiraLoading(true);
    }

    try {
      const data = await loadJiraDashboardData({
        baseUrl: options.baseUrl,
        email: options.email,
        apiToken: options.apiToken,
        forceRefresh: options.forceRefresh
      });

      if (!isMountedRef.current) {
        return;
      }

      setJiraData(data);
    } finally {
      isJiraRefreshInFlightRef.current = false;

      if (options.showLoadingIndicator && isMountedRef.current) {
        setIsJiraLoading(false);
      }
    }
  }

  return (
    <Routes>
      <Route
        path="/"
        element={
          <DashboardPage
            settings={settings}
            gitHubData={gitHubData}
            isGitHubLoading={isGitHubLoading}
            isCheckingGitHubActivity={isCheckingGitHubActivity}
            lastGitHubActivityCheckAt={lastGitHubActivityCheckAt}
            onRefreshGitHub={() => void handleRefreshGitHub()}
            jiraData={jiraData}
            isJiraLoading={isJiraLoading}
            onRefreshJira={() => void handleRefreshJira()}
          />
        }
      />
      <Route
        path="/settings"
        element={
          <SettingsPage
            settings={settings}
            onSave={handleSaveSettings}
            onTestGitHubConnection={handleTestGitHubConnection}
            onTestJiraConnection={handleTestJiraConnection}
            gitHubTestStatus={gitHubSettingsTestStatus}
            jiraTestStatus={jiraSettingsTestStatus}
            jiraErrorMessage={jiraErrorMessage}
            isTestingGitHub={isTestingGitHubSettings}
            isTestingJira={isTestingJiraSettings}
          />
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
