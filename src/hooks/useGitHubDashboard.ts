import { useCallback, useEffect, useRef, useState } from 'react';
import type { DashboardSettings } from '../lib/storage';
import {
  fetchGitHubOwnerOptions,
  getEmptyGitHubDashboardData,
  getLatestGitHubDashboardData,
  loadGitHubDashboardData,
  pollGitHubNotificationActivity,
  testGitHubConnection,
  type GitHubConnectionStatus,
  type GitHubDashboardData
} from '../lib/githubApi';
import {
  saveStoredGitHubPrNotificationSeenAtState,
  saveStoredGitHubPrReadyState,
  saveStoredGitHubPrWarningState
} from '../lib/storage';
import type { GitHubMockScenario } from '../mocks/github/scenarios';

const GITHUB_DASHBOARD_CACHE_KEY = 'github-dashboard-cache';

type UseGitHubDashboardOptions = {
  settings: DashboardSettings['integrations']['github'];
  isLoadingSettings: boolean;
  gitHubMockScenario: GitHubMockScenario | null;
};

export function useGitHubDashboard({
  settings,
  isLoadingSettings,
  gitHubMockScenario
}: UseGitHubDashboardOptions) {
  const [gitHubData, setGitHubData] = useState<GitHubDashboardData>(getEmptyGitHubDashboardData());
  const [isGitHubInitialized, setIsGitHubInitialized] = useState(false);
  const [isGitHubMockReady, setIsGitHubMockReady] = useState(false);
  const [isGitHubLoading, setIsGitHubLoading] = useState(false);
  const [isCheckingGitHubActivity, setIsCheckingGitHubActivity] = useState(false);
  const [lastGitHubActivityCheckAt, setLastGitHubActivityCheckAt] = useState<number | null>(null);
  const [gitHubOwnerOptions, setGitHubOwnerOptions] = useState<string[]>([]);
  const [gitHubSettingsTestStatus, setGitHubSettingsTestStatus] =
    useState<GitHubConnectionStatus>('not-connected');
  const [isTestingGitHubSettings, setIsTestingGitHubSettings] = useState(false);
  const isMountedRef = useRef(true);
  const isGitHubRefreshInFlightRef = useRef(false);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const applyMockScenarioData = useCallback(async (scenario: GitHubMockScenario) => {
    setIsGitHubMockReady(false);
    await saveStoredGitHubPrReadyState(scenario.readyState);
    await saveStoredGitHubPrWarningState(scenario.warningState);
    await saveStoredGitHubPrNotificationSeenAtState(scenario.notificationSeenAtState);

    if (!isMountedRef.current) {
      return;
    }

    setGitHubData(scenario.dashboardData);
    setGitHubSettingsTestStatus(scenario.dashboardData.connectionStatus);
    setIsGitHubInitialized(true);
    setIsGitHubMockReady(true);
  }, []);

  const refreshGitHubData = useCallback(
    async (options: {
      username: string;
      token: string;
      forceRefresh?: boolean;
      showLoadingIndicator: boolean;
    }) => {
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
        setIsGitHubInitialized(true);
      } finally {
        isGitHubRefreshInFlightRef.current = false;

        if (options.showLoadingIndicator && isMountedRef.current) {
          setIsGitHubLoading(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    if (isLoadingSettings) {
      return;
    }

    if (gitHubMockScenario) {
      void applyMockScenarioData(gitHubMockScenario);
      return;
    }

    let isCancelled = false;
    setIsGitHubMockReady(true);
    setIsGitHubInitialized(false);

    void (async () => {
      const cachedData = await getLatestGitHubDashboardData({
        username: settings.username,
        token: settings.token
      });

      if (isCancelled || !isMountedRef.current) {
        return;
      }

      if (cachedData) {
        setGitHubData(cachedData);
        setGitHubSettingsTestStatus(cachedData.connectionStatus);
        setIsGitHubInitialized(true);
      }

      await refreshGitHubData({
        username: settings.username,
        token: settings.token,
        forceRefresh: Boolean(cachedData),
        showLoadingIndicator: !cachedData
      });
    })();

    return () => {
      isCancelled = true;
    };
  }, [applyMockScenarioData, gitHubMockScenario, isLoadingSettings, refreshGitHubData, settings.token, settings.username]);

  useEffect(() => {
    if (isLoadingSettings || gitHubMockScenario) {
      return;
    }

    const token = settings.token.trim();
    if (!token || gitHubSettingsTestStatus !== 'connected') {
      setGitHubOwnerOptions([]);
      return;
    }

    let isCancelled = false;

    void fetchGitHubOwnerOptions(token).then((owners) => {
      if (isCancelled || !isMountedRef.current) {
        return;
      }

      setGitHubOwnerOptions(owners);
    });

    return () => {
      isCancelled = true;
    };
  }, [gitHubMockScenario, gitHubSettingsTestStatus, isLoadingSettings, settings.token]);

  useEffect(() => {
    if (isLoadingSettings || gitHubMockScenario) {
      return;
    }

    const username = settings.username;
    const token = settings.token.trim();
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

        if (isCancelled || !result.hasChanges || !result.data || !isMountedRef.current) {
          return;
        }

        setGitHubData(result.data);
        setGitHubSettingsTestStatus(result.data.connectionStatus);
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
  }, [gitHubMockScenario, isLoadingSettings, settings.token, settings.username]);

  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.storage?.onChanged) {
      return;
    }

    let isCancelled = false;

    const handleStorageChanged = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string
    ) => {
      if (
        areaName !== 'local' ||
        isCancelled ||
        !isMountedRef.current ||
        isLoadingSettings ||
        gitHubMockScenario ||
        !changes[GITHUB_DASHBOARD_CACHE_KEY]
      ) {
        return;
      }

      void (async () => {
        const cachedData = await getLatestGitHubDashboardData({
          username: settings.username,
          token: settings.token
        });

        if (!cachedData || isCancelled || !isMountedRef.current) {
          return;
        }

        setGitHubData(cachedData);
        setGitHubSettingsTestStatus(cachedData.connectionStatus);
      })();
    };

    chrome.storage.onChanged.addListener(handleStorageChanged);

    return () => {
      isCancelled = true;
      chrome.storage.onChanged.removeListener(handleStorageChanged);
    };
  }, [gitHubMockScenario, isLoadingSettings, settings.token, settings.username]);

  useEffect(() => {
    if (isLoadingSettings || gitHubMockScenario) {
      return;
    }

    let isCancelled = false;

    const syncVisibleData = () => {
      if (isCancelled || document.visibilityState !== 'visible') {
        return;
      }

      void (async () => {
        const cachedData = await getLatestGitHubDashboardData({
          username: settings.username,
          token: settings.token
        });

        if (!cachedData || isCancelled || !isMountedRef.current) {
          return;
        }

        setGitHubData(cachedData);
        setGitHubSettingsTestStatus(cachedData.connectionStatus);
      })();
    };

    document.addEventListener('visibilitychange', syncVisibleData);
    window.addEventListener('focus', syncVisibleData);

    return () => {
      isCancelled = true;
      document.removeEventListener('visibilitychange', syncVisibleData);
      window.removeEventListener('focus', syncVisibleData);
    };
  }, [gitHubMockScenario, isLoadingSettings, settings.token, settings.username]);

  const testConnectionStatus = useCallback(async (token: string) => {
    setIsTestingGitHubSettings(true);
    setGitHubSettingsTestStatus('testing');

    const status = await testGitHubConnection(token);

    setGitHubSettingsTestStatus(status);
    if (status === 'connected') {
      const owners = await fetchGitHubOwnerOptions(token);
      if (isMountedRef.current) {
        setGitHubOwnerOptions(owners);
      }
    } else if (isMountedRef.current) {
      setGitHubOwnerOptions([]);
    }

    setIsTestingGitHubSettings(false);
    return status;
  }, []);

  const refresh = useCallback(async () => {
    if (gitHubMockScenario) {
      await applyMockScenarioData(gitHubMockScenario);
      return;
    }

    await refreshGitHubData({
      username: settings.username,
      token: settings.token,
      forceRefresh: true,
      showLoadingIndicator: true
    });
  }, [applyMockScenarioData, gitHubMockScenario, refreshGitHubData, settings.token, settings.username]);

  return {
    gitHubData,
    isGitHubInitialized,
    isGitHubMockReady,
    isGitHubLoading,
    isCheckingGitHubActivity,
    lastGitHubActivityCheckAt,
    gitHubOwnerOptions,
    gitHubSettingsTestStatus,
    isTestingGitHubSettings,
    testConnectionStatus,
    refresh
  };
}
