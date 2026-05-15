import { useCallback, useEffect, useRef, useState } from 'react';
import type { DashboardSettings } from '../lib/storage';
import {
  fetchGitHubOwnerOptions,
  getEmptyGitHubDashboardData,
  getLatestGitHubDashboardData,
  loadGitHubDashboardData,
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
const GITHUB_REFRESH_DEBUG = true;

let gitHubRefreshRequestSequence = 0;

function createGitHubRefreshRequestId(source: string) {
  gitHubRefreshRequestSequence += 1;
  return `${source}-${gitHubRefreshRequestSequence}`;
}

function logGitHubRefreshDebug(event: string, details: Record<string, unknown>) {
  if (!GITHUB_REFRESH_DEBUG) {
    return;
  }

  console.log(`[GitHubRefresh] ${event}`, details);
}

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
      ownerFilter: string;
      forceRefresh?: boolean;
      showLoadingIndicator: boolean;
      source: string;
      requestId?: string;
    }) => {
      const requestId = options.requestId ?? createGitHubRefreshRequestId(options.source);

      if (isGitHubRefreshInFlightRef.current) {
        logGitHubRefreshDebug('refresh-skipped-in-flight', {
          requestId,
          source: options.source,
          forceRefresh: Boolean(options.forceRefresh),
          showLoadingIndicator: options.showLoadingIndicator
        });
        return;
      }

      isGitHubRefreshInFlightRef.current = true;
      logGitHubRefreshDebug('refresh-start', {
        requestId,
        source: options.source,
        forceRefresh: Boolean(options.forceRefresh),
        showLoadingIndicator: options.showLoadingIndicator,
        ownerFilter: options.ownerFilter,
        hasUsername: Boolean(options.username.trim()),
        hasToken: Boolean(options.token.trim())
      });

      if (options.showLoadingIndicator) {
        setIsGitHubLoading(true);
      }

      try {
        const data = await loadGitHubDashboardData({
          username: options.username,
          token: options.token,
          ownerFilter: options.ownerFilter,
          forceRefresh: options.forceRefresh,
          source: options.source,
          requestId
        });
        logGitHubRefreshDebug('refresh-finished', {
          requestId,
          source: options.source,
          forceRefresh: Boolean(options.forceRefresh),
          connectionStatus: data.connectionStatus,
          notificationsCount: data.notificationsCount,
          pullRequestsCount: data.pullRequests.length
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
        token: settings.token,
        ownerFilter: settings.ownerFilter
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
        ownerFilter: settings.ownerFilter,
        forceRefresh: Boolean(cachedData),
        showLoadingIndicator: !cachedData,
        source: 'initial-load'
      });
    })();

    return () => {
      isCancelled = true;
    };
  }, [applyMockScenarioData, gitHubMockScenario, isLoadingSettings, refreshGitHubData, settings.ownerFilter, settings.token, settings.username]);

  const loadOwnerOptions = useCallback(
    async (options: { token: string; username?: string }) => {
      const token = options.token.trim();
      if (!token) {
        if (isMountedRef.current) {
          setGitHubOwnerOptions([]);
        }
        return [];
      }

      const owners = await fetchGitHubOwnerOptions({
        token,
        username: options.username
      });

      if (isMountedRef.current) {
        setGitHubOwnerOptions(owners);
      }

      return owners;
    },
    []
  );

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
        const requestId = createGitHubRefreshRequestId('storage-cache-sync');
        logGitHubRefreshDebug('storage-cache-change', {
          requestId,
          changedKeys: Object.keys(changes),
          cacheUpdated: Boolean(changes[GITHUB_DASHBOARD_CACHE_KEY])
        });
        const cachedData = await getLatestGitHubDashboardData({
          username: settings.username,
          token: settings.token,
          ownerFilter: settings.ownerFilter
        });

        if (!cachedData || isCancelled || !isMountedRef.current) {
          return;
        }

        setIsCheckingGitHubActivity(false);
        setLastGitHubActivityCheckAt(Date.now());
        setGitHubData(cachedData);
        setGitHubSettingsTestStatus(cachedData.connectionStatus);
      })();
    };

    chrome.storage.onChanged.addListener(handleStorageChanged);

    return () => {
      isCancelled = true;
      chrome.storage.onChanged.removeListener(handleStorageChanged);
    };
  }, [gitHubMockScenario, isLoadingSettings, settings.ownerFilter, settings.token, settings.username]);

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
          token: settings.token,
          ownerFilter: settings.ownerFilter
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
  }, [gitHubMockScenario, isLoadingSettings, settings.ownerFilter, settings.token, settings.username]);

  const testConnectionStatus = useCallback(async (token: string) => {
    setIsTestingGitHubSettings(true);
    setGitHubSettingsTestStatus('testing');

    const status = await testGitHubConnection(token);

    setGitHubSettingsTestStatus(status);
    if (status !== 'connected' && isMountedRef.current) {
      setGitHubOwnerOptions([]);
    }

    setIsTestingGitHubSettings(false);
    return status;
  }, [settings.username]);

  const refresh = useCallback(async () => {
    if (gitHubMockScenario) {
      await applyMockScenarioData(gitHubMockScenario);
      return;
    }

    await refreshGitHubData({
      username: settings.username,
      token: settings.token,
      ownerFilter: settings.ownerFilter,
      forceRefresh: true,
      showLoadingIndicator: true,
      source: 'manual-refresh'
    });
  }, [applyMockScenarioData, gitHubMockScenario, refreshGitHubData, settings.ownerFilter, settings.token, settings.username]);

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
    loadOwnerOptions,
    testConnectionStatus,
    refresh
  };
}
