import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import {
  getEmptyGitHubDashboardData,
  getLatestGitHubDashboardData,
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
  clearStoredGitHubMockScenarioKey,
  getDefaultSettings,
  getStoredGitHubMockScenarioKey,
  getStoredSettings,
  saveStoredGitHubMockScenarioKey,
  saveStoredGitHubPrReadyState,
  saveStoredGitHubPrWarningState,
  saveStoredSettings,
  type DashboardSettings
} from './lib/storage';
import { type TodayFocusRefreshSignal } from './lib/todayFocusSync';
import {
  getGitHubMockScenarioByKey,
  getGitHubMockScenarioKeyFromLocation
} from './mocks/github/scenarios';
import { DashboardPage } from './pages/DashboardPage';
import { SettingsPage } from './pages/SettingsPage';

export default function App() {
  const [settings, setSettings] = useState<DashboardSettings>(getDefaultSettings);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [gitHubMockScenarioKey, setGitHubMockScenarioKey] = useState<string | null>(null);
  const gitHubMockScenario = useMemo(
    () => getGitHubMockScenarioByKey(gitHubMockScenarioKey),
    [gitHubMockScenarioKey]
  );
  const [isGitHubMockReady, setIsGitHubMockReady] = useState(false);
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
  const [jiraRefreshSignal, setJiraRefreshSignal] = useState<TodayFocusRefreshSignal>({
    lastCompletedAt: null,
    lastManualAt: null
  });
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

    void (async () => {
      const locationMockScenarioKey = getGitHubMockScenarioKeyFromLocation(window.location.search, window.location.hash);
      const storedMockScenarioKey = await getStoredGitHubMockScenarioKey();
      const nextMockScenarioKey = locationMockScenarioKey ?? storedMockScenarioKey;

      if (locationMockScenarioKey) {
        await saveStoredGitHubMockScenarioKey(locationMockScenarioKey);
      }

      const storedSettings = await getStoredSettings();
      if (!active) {
        return;
      }

      setGitHubMockScenarioKey(nextMockScenarioKey);
      setSettings(storedSettings);
      setIsLoadingSettings(false);
    })();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (isLoadingSettings) {
      return;
    }

    if (gitHubMockScenario) {
      setIsGitHubMockReady(false);
      void (async () => {
        await saveStoredGitHubPrReadyState(gitHubMockScenario.readyState);
        await saveStoredGitHubPrWarningState(gitHubMockScenario.warningState);
        if (!isMountedRef.current) {
          return;
        }

        setGitHubData(gitHubMockScenario.dashboardData);
        setGitHubSettingsTestStatus(gitHubMockScenario.dashboardData.connectionStatus);
        setIsGitHubMockReady(true);
      })();
      return;
    }

    let isCancelled = false;

    void (async () => {
      const cachedData = await getLatestGitHubDashboardData({
        username: settings.integrations.github.username,
        token: settings.integrations.github.token
      });

      if (isCancelled || !isMountedRef.current) {
        return;
      }

      if (cachedData) {
        setGitHubData(cachedData);
        setGitHubSettingsTestStatus(cachedData.connectionStatus);
      }

      await refreshGitHubData({
        username: settings.integrations.github.username,
        token: settings.integrations.github.token,
        forceRefresh: Boolean(cachedData),
        showLoadingIndicator: !cachedData
      });
      if (!isCancelled && isMountedRef.current) {
        setIsGitHubMockReady(true);
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [gitHubMockScenario, isLoadingSettings, settings.integrations.github.username, settings.integrations.github.token]);

  useEffect(() => {
    if (isLoadingSettings) {
      return;
    }

    void refreshJiraData({
      baseUrl: settings.integrations.jira.baseUrl,
      email: settings.integrations.jira.email,
      apiToken: settings.integrations.jira.apiToken,
      reason: 'load',
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

    const { baseUrl, email, apiToken } = settings.integrations.jira;
    if (!baseUrl.trim() || !email.trim() || !apiToken.trim()) {
      return;
    }

    let isCancelled = false;

    const pollForJiraActivity = async () => {
      if (isCancelled || isJiraRefreshInFlightRef.current) {
        return;
      }

      await refreshJiraData({
        baseUrl,
        email,
        apiToken,
        forceRefresh: true,
        reason: 'poll',
        showLoadingIndicator: false
      });
    };

    const intervalId = window.setInterval(() => {
      void pollForJiraActivity();
    }, 60 * 1000);

    return () => {
      isCancelled = true;
      window.clearInterval(intervalId);
    };
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

    if (gitHubMockScenario) {
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
  }, [gitHubMockScenario, isLoadingSettings, settings.integrations.github.username, settings.integrations.github.token]);

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
    if (gitHubMockScenario) {
      await saveStoredGitHubPrReadyState(gitHubMockScenario.readyState);
      await saveStoredGitHubPrWarningState(gitHubMockScenario.warningState);
      setGitHubData(gitHubMockScenario.dashboardData);
      setGitHubSettingsTestStatus(gitHubMockScenario.dashboardData.connectionStatus);
      setIsGitHubMockReady(true);
      return;
    }

    await refreshGitHubData({
      username: settings.integrations.github.username,
      token: settings.integrations.github.token,
      forceRefresh: true,
      showLoadingIndicator: true
    });
  }

  async function handleClearGitHubMockScenario() {
    await clearStoredGitHubMockScenarioKey();
    await saveStoredGitHubPrReadyState({});
    await saveStoredGitHubPrWarningState({});
    setGitHubMockScenarioKey(null);
    setIsGitHubMockReady(true);
    clearMockScenarioFromLocation();

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
      reason: 'manual',
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
    reason: 'load' | 'manual' | 'poll';
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
      const completedAt = Date.now();
      setJiraRefreshSignal((current) => ({
        lastCompletedAt: completedAt,
        lastManualAt: options.reason === 'manual' ? completedAt : current.lastManualAt
      }));
    } finally {
      isJiraRefreshInFlightRef.current = false;

      if (options.showLoadingIndicator && isMountedRef.current) {
        setIsJiraLoading(false);
      }
    }
  }

  const dashboardElement = (
    <DashboardPage
      settings={settings}
      gitHubData={gitHubData}
      gitHubMockScenarioKey={gitHubMockScenarioKey}
      isGitHubMockMode={Boolean(gitHubMockScenario)}
      isGitHubLoading={isGitHubLoading}
      isCheckingGitHubActivity={isCheckingGitHubActivity}
      lastGitHubActivityCheckAt={lastGitHubActivityCheckAt}
      onClearGitHubMockScenario={() => void handleClearGitHubMockScenario()}
      onRefreshGitHub={() => void handleRefreshGitHub()}
      jiraData={jiraData}
      jiraRefreshSignal={jiraRefreshSignal}
      isJiraLoading={isJiraLoading}
      onRefreshJira={() => void handleRefreshJira()}
    />
  );

  if (isLoadingSettings || !isGitHubMockReady) {
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
              gitHubData={gitHubData}
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
    </div>
  );
}

function clearMockScenarioFromLocation() {
  const searchParams = new URLSearchParams(window.location.search);
  searchParams.delete('mock');

  const trimmedHash = window.location.hash.replace(/^#/, '');
  const [path, rawSearch = ''] = trimmedHash.split('?');
  const hashParams = new URLSearchParams(rawSearch);
  hashParams.delete('mock');
  const nextHash = path ? `#${path}${hashParams.toString() ? `?${hashParams.toString()}` : ''}` : '';
  const nextSearch = searchParams.toString();

  window.history.replaceState(
    null,
    '',
    `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${nextHash}`
  );
}
