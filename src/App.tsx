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
  getStoredGitHubDevMode,
  getStoredGitHubMockScenarioKey,
  getStoredSettings,
  saveStoredGitHubDevMode,
  saveStoredGitHubMockScenarioKey,
  saveStoredGitHubPrNotificationSeenAtState,
  saveStoredGitHubPrReadyState,
  saveStoredGitHubPrWarningState,
  saveStoredSettings,
  type DashboardSettings
} from './lib/storage';
import { type TodayFocusRefreshSignal } from './lib/todayFocusSync';
import {
  DEFAULT_GITHUB_MOCK_SCENARIO_KEY,
  getGitHubMockScenarioByKey,
  getGitHubMockScenarioOptions
} from './mocks/github/scenarios';
import { type GitHubSummaryMetrics } from './components/GitHubCard';
import { DashboardPage } from './pages/DashboardPage';
import { SettingsPage } from './pages/SettingsPage';

type FaviconSize = '16x16' | '32x32';

type FaviconPaths = Record<FaviconSize, string>;

type FaviconVariant = {
  key: string;
  matches: (metrics: GitHubSummaryMetrics) => boolean;
  paths: FaviconPaths;
};

const DEFAULT_FAVICON_PATHS: FaviconPaths = {
  '16x16': '/icons/icon-16.png',
  '32x32': '/icons/icon-32.png'
};

const PR_READY_FAVICON_PATHS: FaviconPaths = {
  '16x16': '/icons/icon-16-pr-ready.png',
  '32x32': '/icons/icon-32-pr-ready.png'
};

const PR_WARNING_FAVICON_PATHS: FaviconPaths = {
  '16x16': '/icons/icon-16-pr-warning.png',
  '32x32': '/icons/icon-32-pr-warning.png'
};

const PR_ERROR_FAVICON_PATHS: FaviconPaths = {
  '16x16': '/icons/icon-16-pr-error.png',
  '32x32': '/icons/icon-32-pr-error.png'
};

const DEFAULT_GITHUB_SUMMARY_METRICS: GitHubSummaryMetrics = {
  connectionStatus: 'not-connected',
  missingUsername: true,
  readyToMergeCount: 0,
  failedBuildCount: 0,
  failedBuildBadgeCount: 0,
  highlightedReadyCount: 0,
  highlightedWarningCount: 0,
  reviewRequestedCount: 0,
  approvedPrCount: null,
  relevantPrCount: 0
};

// Order matters: the first matching variant wins.
const FAVICON_VARIANTS: FaviconVariant[] = [
  {
    key: 'pr-error',
    matches: (metrics) => metrics.failedBuildBadgeCount > 0,
    paths: PR_ERROR_FAVICON_PATHS
  },
  {
    key: 'pr-warning',
    matches: (metrics) => metrics.highlightedWarningCount > 0,
    paths: PR_WARNING_FAVICON_PATHS
  },
  {
    key: 'pr-ready',
    matches: (metrics) => metrics.highlightedReadyCount > 0,
    paths: PR_READY_FAVICON_PATHS
  }
];

export default function App() {
  const [settings, setSettings] = useState<DashboardSettings>(getDefaultSettings);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [isGitHubMockMode, setIsGitHubMockMode] = useState(false);
  const [gitHubMockScenarioKey, setGitHubMockScenarioKey] = useState<string | null>(null);
  const gitHubMockScenario = useMemo(
    () =>
      isGitHubMockMode
        ? getGitHubMockScenarioByKey(gitHubMockScenarioKey ?? DEFAULT_GITHUB_MOCK_SCENARIO_KEY)
        : null,
    [gitHubMockScenarioKey, isGitHubMockMode]
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
  const [gitHubSummaryMetrics, setGitHubSummaryMetrics] =
    useState<GitHubSummaryMetrics>(DEFAULT_GITHUB_SUMMARY_METRICS);
  const isMountedRef = useRef(true);
  const isGitHubRefreshInFlightRef = useRef(false);
  const isJiraRefreshInFlightRef = useRef(false);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    syncFaviconVariant(selectFaviconVariant(gitHubSummaryMetrics));
  }, [gitHubSummaryMetrics]);

  useEffect(() => {
    let active = true;

    const loadInitialState = async () => {
      const storedGitHubDevMode = await getStoredGitHubDevMode();
      const storedMockScenarioKey = await getStoredGitHubMockScenarioKey();
      const shouldEnableMockMode = storedGitHubDevMode;
      const nextMockScenarioKey = shouldEnableMockMode
        ? storedMockScenarioKey ?? DEFAULT_GITHUB_MOCK_SCENARIO_KEY
        : null;

      const storedSettings = await getStoredSettings();
      if (!active) {
        return;
      }

      setIsGitHubMockMode(shouldEnableMockMode);
      setGitHubMockScenarioKey(nextMockScenarioKey);
      setSettings(storedSettings);
      setIsGitHubMockReady(!shouldEnableMockMode);
      setIsLoadingSettings(false);
    };

    void loadInitialState();

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
        await saveStoredGitHubPrNotificationSeenAtState(gitHubMockScenario.notificationSeenAtState);
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
      await saveStoredGitHubPrNotificationSeenAtState(gitHubMockScenario.notificationSeenAtState);
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

  async function handleApplyGitHubMockScenario(nextMockScenarioKey: string) {
    await saveStoredGitHubDevMode(true);
    await saveStoredGitHubMockScenarioKey(nextMockScenarioKey);
    setIsGitHubMockMode(true);
    setGitHubMockScenarioKey(nextMockScenarioKey);
    setIsGitHubMockReady(false);

    const nextScenario = getGitHubMockScenarioByKey(nextMockScenarioKey);
    if (!nextScenario) {
      return;
    }

    await saveStoredGitHubPrReadyState(nextScenario.readyState);
    await saveStoredGitHubPrWarningState(nextScenario.warningState);
    await saveStoredGitHubPrNotificationSeenAtState(nextScenario.notificationSeenAtState);
    if (!isMountedRef.current) {
      return;
    }

    setGitHubData(nextScenario.dashboardData);
    setGitHubSettingsTestStatus(nextScenario.dashboardData.connectionStatus);
    setIsGitHubMockReady(true);
  }

  async function handleClearGitHubMockScenario() {
    await saveStoredGitHubDevMode(false);
    await clearStoredGitHubMockScenarioKey();
    await saveStoredGitHubPrReadyState({});
    await saveStoredGitHubPrWarningState({});
    await saveStoredGitHubPrNotificationSeenAtState({});

    const cachedData = await getLatestGitHubDashboardData({
      username: settings.integrations.github.username,
      token: settings.integrations.github.token
    });
    if (cachedData && isMountedRef.current) {
      setGitHubData(cachedData);
      setGitHubSettingsTestStatus(cachedData.connectionStatus);
    }

    await refreshGitHubData({
      username: settings.integrations.github.username,
      token: settings.integrations.github.token,
      forceRefresh: true,
      showLoadingIndicator: true
    });

    if (!isMountedRef.current) {
      return;
    }

    setIsGitHubMockMode(false);
    setGitHubMockScenarioKey(null);
    setIsGitHubMockReady(true);
  }

  async function handleSetGitHubDevMode(isEnabled: boolean) {
    await saveStoredGitHubDevMode(isEnabled);

    if (isEnabled) {
      const nextMockScenarioKey = gitHubMockScenarioKey ?? DEFAULT_GITHUB_MOCK_SCENARIO_KEY;
      await handleApplyGitHubMockScenario(nextMockScenarioKey);
      return;
    }

    await handleClearGitHubMockScenario();
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
      isGitHubMockMode={isGitHubMockMode}
      gitHubMockScenarioOptions={getGitHubMockScenarioOptions()}
      isGitHubLoading={isGitHubLoading}
      isCheckingGitHubActivity={isCheckingGitHubActivity}
      lastGitHubActivityCheckAt={lastGitHubActivityCheckAt}
      onClearGitHubMockScenario={() => void handleClearGitHubMockScenario()}
      onApplyGitHubMockScenario={(mockScenarioKey) => void handleApplyGitHubMockScenario(mockScenarioKey)}
      onRefreshGitHub={() => void handleRefreshGitHub()}
      jiraData={jiraData}
      jiraRefreshSignal={jiraRefreshSignal}
      isJiraLoading={isJiraLoading}
      onRefreshJira={() => void handleRefreshJira()}
      onGitHubSummaryMetricsChange={setGitHubSummaryMetrics}
    />
  );

  if (isLoadingSettings || (isGitHubMockMode && !isGitHubMockReady)) {
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
              isGitHubDevModeEnabled={isGitHubMockMode}
              onSetGitHubDevMode={handleSetGitHubDevMode}
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

function selectFaviconVariant(metrics: GitHubSummaryMetrics) {
  return FAVICON_VARIANTS.find((variant) => variant.matches(metrics)) ?? {
    key: 'default',
    matches: () => true,
    paths: DEFAULT_FAVICON_PATHS
  };
}

function syncFaviconVariant(variant: FaviconVariant) {
  updateFaviconLink('16x16', variant.paths['16x16']);
  updateFaviconLink('32x32', variant.paths['32x32']);
}

function updateFaviconLink(size: FaviconSize, href: string) {
  if (typeof document === 'undefined') {
    return;
  }

  const selector = `link[rel="icon"][sizes="${size}"]`;
  const existingLink = document.querySelector<HTMLLinkElement>(selector);

  if (existingLink) {
    existingLink.href = href;
    return;
  }

  const nextLink = document.createElement('link');
  nextLink.rel = 'icon';
  nextLink.type = 'image/png';
  nextLink.sizes = size;
  nextLink.href = href;
  document.head.append(nextLink);
}
