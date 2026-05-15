import { useCallback, useEffect, useRef, useState } from 'react';
import type { DashboardSettings } from '../lib/storage';
import { type TodayFocusRefreshSignal } from '../lib/todayFocusSync';
import {
  getEmptyJiraDashboardData,
  loadJiraDashboardData,
  testJiraConnection,
  type JiraConnectionStatus,
  type JiraDashboardData,
  type JiraProfile
} from '../lib/jiraApi';

const JIRA_ISSUES_CACHE_KEY = 'jira-issues-cache-v4';

type UseJiraDashboardOptions = {
  settings: DashboardSettings['integrations']['jira'];
  isLoadingSettings: boolean;
};

export function useJiraDashboard({ settings, isLoadingSettings }: UseJiraDashboardOptions) {
  const [jiraSettingsTestStatus, setJiraSettingsTestStatus] =
    useState<JiraConnectionStatus>('not-connected');
  const [isTestingJiraSettings, setIsTestingJiraSettings] = useState(false);
  const [jiraProfile, setJiraProfile] = useState<JiraProfile | null>(null);
  const [jiraErrorMessage, setJiraErrorMessage] = useState('');
  const [jiraData, setJiraData] = useState<JiraDashboardData>(getEmptyJiraDashboardData());
  const [isJiraInitialized, setIsJiraInitialized] = useState(false);
  const [jiraRefreshSignal, setJiraRefreshSignal] = useState<TodayFocusRefreshSignal>({
    lastCompletedAt: null,
    lastManualAt: null
  });
  const [isJiraLoading, setIsJiraLoading] = useState(false);
  const isMountedRef = useRef(true);
  const isJiraRefreshInFlightRef = useRef(false);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const refreshJiraData = useCallback(
    async (options: {
      baseUrl: string;
      email: string;
      apiToken: string;
      forceRefresh?: boolean;
      reason: 'load' | 'manual' | 'poll';
      showLoadingIndicator: boolean;
    }) => {
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
        setIsJiraInitialized(true);
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
    },
    []
  );

  useEffect(() => {
    if (isLoadingSettings) {
      return;
    }

    setIsJiraInitialized(false);
    void refreshJiraData({
      baseUrl: settings.baseUrl,
      email: settings.email,
      apiToken: settings.apiToken,
      reason: 'load',
      showLoadingIndicator: true
    });
  }, [isLoadingSettings, refreshJiraData, settings.apiToken, settings.baseUrl, settings.email]);

  useEffect(() => {
    if (isLoadingSettings) {
      return;
    }

    const { baseUrl, email, apiToken } = settings;
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
  }, [isLoadingSettings, settings.apiToken, settings.baseUrl, settings.email]);

  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.storage?.onChanged) {
      return;
    }

    let isCancelled = false;

    const handleStorageChanged = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string
    ) => {
      if (areaName !== 'local' || isCancelled || !isMountedRef.current || isLoadingSettings) {
        return;
      }

      if (!changes[JIRA_ISSUES_CACHE_KEY]) {
        return;
      }

      void refreshJiraData({
        baseUrl: settings.baseUrl,
        email: settings.email,
        apiToken: settings.apiToken,
        forceRefresh: false,
        reason: 'poll',
        showLoadingIndicator: false
      });
    };

    chrome.storage.onChanged.addListener(handleStorageChanged);

    return () => {
      isCancelled = true;
      chrome.storage.onChanged.removeListener(handleStorageChanged);
    };
  }, [isLoadingSettings, refreshJiraData, settings.apiToken, settings.baseUrl, settings.email]);

  useEffect(() => {
    if (isLoadingSettings) {
      return;
    }

    let isCancelled = false;

    const syncVisibleData = () => {
      if (isCancelled || document.visibilityState !== 'visible') {
        return;
      }

      void refreshJiraData({
        baseUrl: settings.baseUrl,
        email: settings.email,
        apiToken: settings.apiToken,
        forceRefresh: false,
        reason: 'poll',
        showLoadingIndicator: false
      });
    };

    document.addEventListener('visibilitychange', syncVisibleData);
    window.addEventListener('focus', syncVisibleData);

    return () => {
      isCancelled = true;
      document.removeEventListener('visibilitychange', syncVisibleData);
      window.removeEventListener('focus', syncVisibleData);
    };
  }, [isLoadingSettings, refreshJiraData, settings.apiToken, settings.baseUrl, settings.email]);

  const testConnectionStatus = useCallback(async (baseUrl: string, email: string, apiToken: string) => {
    setIsTestingJiraSettings(true);
    setJiraSettingsTestStatus('testing');

    const result = await testJiraConnection(baseUrl, email, apiToken);

    setJiraSettingsTestStatus(result.status);
    setJiraProfile(result.profile);
    setJiraErrorMessage(result.errorMessage ?? '');
    setIsTestingJiraSettings(false);
    return result.status;
  }, []);

  const refresh = useCallback(async () => {
    await refreshJiraData({
      baseUrl: settings.baseUrl,
      email: settings.email,
      apiToken: settings.apiToken,
      forceRefresh: true,
      reason: 'manual',
      showLoadingIndicator: true
    });
  }, [refreshJiraData, settings.apiToken, settings.baseUrl, settings.email]);

  return {
    jiraSettingsTestStatus,
    isTestingJiraSettings,
    jiraProfile,
    jiraErrorMessage,
    jiraData,
    isJiraInitialized,
    jiraRefreshSignal,
    isJiraLoading,
    testConnectionStatus,
    refresh
  };
}
