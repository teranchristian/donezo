import { useEffect, useRef } from 'react';
import {
  applyGitHubPullRequestStatesToTodayFocusItems,
  reconcileTodayFocusGitHubItems,
  reconcileTodayFocusJiraItems,
  type TodayFocusRefreshSignal,
} from '../lib/todayFocusSync';
import {
  getGitHubPullRequestStates,
  type GitHubDashboardData,
} from '../lib/githubApi';
import { loadJiraIssuesByKeys, type JiraDashboardData } from '../lib/jiraApi';
import type { DashboardSettings, FocusItem } from '../lib/storage';

type UseTodayFocusFallbacksOptions = {
  settings: DashboardSettings;
  gitHubData: GitHubDashboardData;
  jiraData: JiraDashboardData;
  jiraRefreshSignal: TodayFocusRefreshSignal;
  hasLoadedTodayFocusItems: boolean;
  todayFocusItemsRef: React.MutableRefObject<FocusItem[]>;
  commitTodayFocusItems: (nextItems: FocusItem[], reason?: 'user' | 'sync') => void;
};

export function useTodayFocusFallbacks({
  settings,
  gitHubData,
  jiraData,
  jiraRefreshSignal,
  hasLoadedTodayFocusItems,
  todayFocusItemsRef,
  commitTodayFocusItems,
}: UseTodayFocusFallbacksOptions) {
  const hasRunInitialFocusedJiraFallbackRef = useRef(false);
  const isFocusedJiraFallbackInFlightRef = useRef(false);
  const lastFocusedJiraFallbackAtRef = useRef<number | null>(null);
  const isFocusedGitHubFallbackInFlightRef = useRef(false);

  useEffect(() => {
    if (!hasLoadedTodayFocusItems) {
      return;
    }

    void runFocusedGitHubFallback();
  }, [
    gitHubData.connectionStatus,
    gitHubData.lastUpdatedAt,
    gitHubData.pullRequests,
    gitHubData.recentPullRequests,
    hasLoadedTodayFocusItems,
    settings.integrations.github.token,
  ]);

  useEffect(() => {
    if (!hasLoadedTodayFocusItems || jiraRefreshSignal.lastCompletedAt === null) {
      return;
    }

    if (!hasRunInitialFocusedJiraFallbackRef.current) {
      hasRunInitialFocusedJiraFallbackRef.current = true;
      void runFocusedJiraFallback();
      return;
    }

    if (
      lastFocusedJiraFallbackAtRef.current !== null &&
      jiraRefreshSignal.lastCompletedAt - lastFocusedJiraFallbackAtRef.current <
        5 * 60 * 1000
    ) {
      return;
    }

    void runFocusedJiraFallback();
  }, [
    hasLoadedTodayFocusItems,
    jiraData.issues,
    jiraRefreshSignal.lastCompletedAt,
    settings.integrations.jira.apiToken,
    settings.integrations.jira.baseUrl,
    settings.integrations.jira.email,
  ]);

  useEffect(() => {
    if (!hasLoadedTodayFocusItems || jiraRefreshSignal.lastManualAt === null) {
      return;
    }

    void runFocusedJiraFallback();
  }, [
    hasLoadedTodayFocusItems,
    jiraRefreshSignal.lastManualAt,
    settings.integrations.jira.apiToken,
    settings.integrations.jira.baseUrl,
    settings.integrations.jira.email,
  ]);

  async function runFocusedJiraFallback() {
    const { baseUrl, email, apiToken } = settings.integrations.jira;
    if (
      !baseUrl.trim() ||
      !email.trim() ||
      !apiToken.trim() ||
      isFocusedJiraFallbackInFlightRef.current
    ) {
      return;
    }

    const syncResult = reconcileTodayFocusJiraItems(
      todayFocusItemsRef.current,
      jiraData.issues,
    );
    if (syncResult.missingKeys.length === 0) {
      return;
    }

    isFocusedJiraFallbackInFlightRef.current = true;
    lastFocusedJiraFallbackAtRef.current = Date.now();

    try {
      const fallbackIssues = await loadJiraIssuesByKeys({
        baseUrl,
        email,
        apiToken,
        issueKeys: syncResult.missingKeys,
      });

      if (fallbackIssues.length === 0) {
        return;
      }

      const fallbackSyncResult = reconcileTodayFocusJiraItems(
        todayFocusItemsRef.current,
        fallbackIssues,
      );
      if (fallbackSyncResult.items !== todayFocusItemsRef.current) {
        commitTodayFocusItems(fallbackSyncResult.items, 'sync');
      }
    } finally {
      isFocusedJiraFallbackInFlightRef.current = false;
    }
  }

  async function runFocusedGitHubFallback() {
    const token = settings.integrations.github.token.trim();
    if (
      !token ||
      gitHubData.connectionStatus !== 'connected' ||
      isFocusedGitHubFallbackInFlightRef.current
    ) {
      return;
    }

    const dashboardPullRequests = Array.isArray(gitHubData.pullRequests)
      ? gitHubData.pullRequests
      : [];
    const recentPullRequests = Array.isArray(gitHubData.recentPullRequests)
      ? gitHubData.recentPullRequests
      : [];
    const availablePullRequests = [
      ...dashboardPullRequests,
      ...recentPullRequests,
    ];
    const syncResult = reconcileTodayFocusGitHubItems(
      todayFocusItemsRef.current,
      availablePullRequests,
    );
    if (syncResult.missingPullRequests.length === 0) {
      return;
    }

    isFocusedGitHubFallbackInFlightRef.current = true;

    try {
      const pullRequestStates = await getGitHubPullRequestStates({
        token,
        pullRequests: syncResult.missingPullRequests,
      });
      if (Object.keys(pullRequestStates).length === 0) {
        return;
      }

      const nextItems = applyGitHubPullRequestStatesToTodayFocusItems(
        todayFocusItemsRef.current,
        pullRequestStates,
      );
      if (nextItems !== todayFocusItemsRef.current) {
        commitTodayFocusItems(nextItems, 'sync');
      }
    } finally {
      isFocusedGitHubFallbackInFlightRef.current = false;
    }
  }
}
