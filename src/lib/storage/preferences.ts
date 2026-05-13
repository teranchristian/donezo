import {
  getChromeStorageValue,
  getLocalStorageJsonValue,
  getLocalStorageRawValue,
  hasChromeStorage,
  removeChromeStorageValue,
  removeLocalStorageValue,
  setChromeStorageValues,
  setLocalStorageJsonValue,
  setLocalStorageRawValue
} from './backend';
import {
  DEFAULT_ACTIVE_GITHUB_VIEW,
  DEFAULT_ACTIVE_INTEGRATION,
  DEFAULT_ACTIVE_JIRA_VIEW,
  DEFAULT_GITHUB_PR_STATUS_FILTER,
  DEFAULT_GITHUB_SORT_ORDER
} from './defaults';
import {
  ACTIVE_GITHUB_VIEW_STORAGE_KEY,
  ACTIVE_INTEGRATION_STORAGE_KEY,
  ACTIVE_JIRA_VIEW_STORAGE_KEY,
  GITHUB_DEV_MODE_STORAGE_KEY,
  GITHUB_MOCK_SCENARIO_STORAGE_KEY,
  GITHUB_PR_NOTIFICATION_SEEN_AT_STORAGE_KEY,
  GITHUB_PR_READY_STATE_STORAGE_KEY,
  GITHUB_PR_STATUS_FILTER_STORAGE_KEY,
  GITHUB_PR_WARNING_STATE_STORAGE_KEY,
  GITHUB_SORT_ORDER_STORAGE_KEY
} from './keys';
import type {
  ActiveGitHubView,
  ActiveIntegration,
  ActiveJiraView,
  GitHubListSort,
  GitHubPrNotificationSeenAtState,
  GitHubPrReadyState,
  GitHubPrReadyStateEntry,
  GitHubPrStatusFilter,
  GitHubPrWarningState,
  GitHubPrWarningStateEntry
} from './types';

export async function getStoredGitHubSortOrder() {
  if (hasChromeStorage()) {
    return mergeGitHubSortOrder(await getChromeStorageValue<string>(GITHUB_SORT_ORDER_STORAGE_KEY));
  }

  return mergeGitHubSortOrder(getLocalStorageJsonValue<string>(GITHUB_SORT_ORDER_STORAGE_KEY) ?? undefined);
}

export async function saveStoredGitHubSortOrder(sortOrder: GitHubListSort) {
  if (hasChromeStorage()) {
    await setChromeStorageValues({ [GITHUB_SORT_ORDER_STORAGE_KEY]: sortOrder });
    return;
  }

  setLocalStorageJsonValue(GITHUB_SORT_ORDER_STORAGE_KEY, sortOrder);
}

export async function getStoredGitHubPrStatusFilter() {
  if (hasChromeStorage()) {
    return mergeGitHubPrStatusFilter(await getChromeStorageValue<string>(GITHUB_PR_STATUS_FILTER_STORAGE_KEY));
  }

  return mergeGitHubPrStatusFilter(getLocalStorageJsonValue<string>(GITHUB_PR_STATUS_FILTER_STORAGE_KEY) ?? undefined);
}

export async function saveStoredGitHubPrStatusFilter(filter: GitHubPrStatusFilter) {
  if (hasChromeStorage()) {
    await setChromeStorageValues({ [GITHUB_PR_STATUS_FILTER_STORAGE_KEY]: filter });
    return;
  }

  setLocalStorageJsonValue(GITHUB_PR_STATUS_FILTER_STORAGE_KEY, filter);
}

export async function getStoredActiveIntegration() {
  if (hasChromeStorage()) {
    return mergeActiveIntegration(await getChromeStorageValue<string>(ACTIVE_INTEGRATION_STORAGE_KEY));
  }

  return mergeActiveIntegration(getLocalStorageJsonValue<string>(ACTIVE_INTEGRATION_STORAGE_KEY) ?? undefined);
}

export async function saveStoredActiveIntegration(activeIntegration: ActiveIntegration) {
  if (hasChromeStorage()) {
    await setChromeStorageValues({ [ACTIVE_INTEGRATION_STORAGE_KEY]: activeIntegration });
    return;
  }

  setLocalStorageJsonValue(ACTIVE_INTEGRATION_STORAGE_KEY, activeIntegration);
}

export async function getStoredActiveGitHubView() {
  if (hasChromeStorage()) {
    return mergeActiveGitHubView(await getChromeStorageValue<string>(ACTIVE_GITHUB_VIEW_STORAGE_KEY));
  }

  return mergeActiveGitHubView(getLocalStorageJsonValue<string>(ACTIVE_GITHUB_VIEW_STORAGE_KEY) ?? undefined);
}

export async function saveStoredActiveGitHubView(activeGitHubView: ActiveGitHubView) {
  if (hasChromeStorage()) {
    await setChromeStorageValues({ [ACTIVE_GITHUB_VIEW_STORAGE_KEY]: activeGitHubView });
    return;
  }

  setLocalStorageJsonValue(ACTIVE_GITHUB_VIEW_STORAGE_KEY, activeGitHubView);
}

export async function getStoredActiveJiraView() {
  if (hasChromeStorage()) {
    return mergeActiveJiraView(await getChromeStorageValue<string>(ACTIVE_JIRA_VIEW_STORAGE_KEY));
  }

  return mergeActiveJiraView(getLocalStorageJsonValue<string>(ACTIVE_JIRA_VIEW_STORAGE_KEY) ?? undefined);
}

export async function saveStoredActiveJiraView(activeJiraView: ActiveJiraView) {
  if (hasChromeStorage()) {
    await setChromeStorageValues({ [ACTIVE_JIRA_VIEW_STORAGE_KEY]: activeJiraView });
    return;
  }

  setLocalStorageJsonValue(ACTIVE_JIRA_VIEW_STORAGE_KEY, activeJiraView);
}

export async function getStoredGitHubMockScenarioKey() {
  if (hasChromeStorage()) {
    return mergeGitHubMockScenarioKey(await getChromeStorageValue<string>(GITHUB_MOCK_SCENARIO_STORAGE_KEY));
  }

  return mergeGitHubMockScenarioKey(getLocalStorageRawValue(GITHUB_MOCK_SCENARIO_STORAGE_KEY) ?? undefined);
}

export async function saveStoredGitHubMockScenarioKey(mockScenarioKey: string) {
  const normalizedMockScenarioKey = mergeGitHubMockScenarioKey(mockScenarioKey);
  if (!normalizedMockScenarioKey) {
    return;
  }

  if (hasChromeStorage()) {
    await setChromeStorageValues({ [GITHUB_MOCK_SCENARIO_STORAGE_KEY]: normalizedMockScenarioKey });
    return;
  }

  setLocalStorageRawValue(GITHUB_MOCK_SCENARIO_STORAGE_KEY, normalizedMockScenarioKey);
}

export async function clearStoredGitHubMockScenarioKey() {
  if (hasChromeStorage()) {
    await removeChromeStorageValue(GITHUB_MOCK_SCENARIO_STORAGE_KEY);
    return;
  }

  removeLocalStorageValue(GITHUB_MOCK_SCENARIO_STORAGE_KEY);
}

export async function getStoredGitHubDevMode() {
  if (hasChromeStorage()) {
    return mergeGitHubDevMode(await getChromeStorageValue<boolean | string>(GITHUB_DEV_MODE_STORAGE_KEY));
  }

  return mergeGitHubDevMode(getLocalStorageRawValue(GITHUB_DEV_MODE_STORAGE_KEY) ?? undefined);
}

export async function saveStoredGitHubDevMode(isEnabled: boolean) {
  if (hasChromeStorage()) {
    await setChromeStorageValues({ [GITHUB_DEV_MODE_STORAGE_KEY]: isEnabled });
    return;
  }

  setLocalStorageJsonValue(GITHUB_DEV_MODE_STORAGE_KEY, isEnabled);
}

export async function getStoredGitHubPrWarningState() {
  if (hasChromeStorage()) {
    return mergeGitHubPrWarningState(
      await getChromeStorageValue<GitHubPrWarningState>(GITHUB_PR_WARNING_STATE_STORAGE_KEY)
    );
  }

  return mergeGitHubPrWarningState(
    getLocalStorageJsonValue<GitHubPrWarningState>(GITHUB_PR_WARNING_STATE_STORAGE_KEY) ?? undefined
  );
}

export async function saveStoredGitHubPrWarningState(state: GitHubPrWarningState) {
  const normalizedState = mergeGitHubPrWarningState(state);

  if (hasChromeStorage()) {
    await setChromeStorageValues({ [GITHUB_PR_WARNING_STATE_STORAGE_KEY]: normalizedState });
    return;
  }

  setLocalStorageJsonValue(GITHUB_PR_WARNING_STATE_STORAGE_KEY, normalizedState);
}

export async function getStoredGitHubPrReadyState() {
  if (hasChromeStorage()) {
    return mergeGitHubPrReadyState(await getChromeStorageValue<GitHubPrReadyState>(GITHUB_PR_READY_STATE_STORAGE_KEY));
  }

  return mergeGitHubPrReadyState(
    getLocalStorageJsonValue<GitHubPrReadyState>(GITHUB_PR_READY_STATE_STORAGE_KEY) ?? undefined
  );
}

export async function saveStoredGitHubPrReadyState(state: GitHubPrReadyState) {
  const normalizedState = mergeGitHubPrReadyState(state);

  if (hasChromeStorage()) {
    await setChromeStorageValues({ [GITHUB_PR_READY_STATE_STORAGE_KEY]: normalizedState });
    return;
  }

  setLocalStorageJsonValue(GITHUB_PR_READY_STATE_STORAGE_KEY, normalizedState);
}

export async function getStoredGitHubPrNotificationSeenAtState() {
  if (hasChromeStorage()) {
    return mergeGitHubPrNotificationSeenAtState(
      await getChromeStorageValue<GitHubPrNotificationSeenAtState>(GITHUB_PR_NOTIFICATION_SEEN_AT_STORAGE_KEY)
    );
  }

  return mergeGitHubPrNotificationSeenAtState(
    getLocalStorageJsonValue<GitHubPrNotificationSeenAtState>(GITHUB_PR_NOTIFICATION_SEEN_AT_STORAGE_KEY) ?? undefined
  );
}

export async function saveStoredGitHubPrNotificationSeenAtState(state: GitHubPrNotificationSeenAtState) {
  const normalizedState = mergeGitHubPrNotificationSeenAtState(state);

  if (hasChromeStorage()) {
    await setChromeStorageValues({ [GITHUB_PR_NOTIFICATION_SEEN_AT_STORAGE_KEY]: normalizedState });
    return;
  }

  setLocalStorageJsonValue(GITHUB_PR_NOTIFICATION_SEEN_AT_STORAGE_KEY, normalizedState);
}

function mergeGitHubSortOrder(sortOrder?: string): GitHubListSort {
  if (
    sortOrder === 'oldest-updated' ||
    sortOrder === 'repository-asc' ||
    sortOrder === 'title-asc' ||
    sortOrder === 'recently-updated'
  ) {
    return sortOrder;
  }

  return DEFAULT_GITHUB_SORT_ORDER;
}

function mergeGitHubPrStatusFilter(filter?: string): GitHubPrStatusFilter {
  return filter === 'approved' || filter === 'ready-to-merge' || filter === 'waiting-review' || filter === 'all'
    ? filter
    : DEFAULT_GITHUB_PR_STATUS_FILTER;
}

function mergeActiveIntegration(activeIntegration?: string): ActiveIntegration {
  return activeIntegration === 'jira' || activeIntegration === 'github'
    ? activeIntegration
    : DEFAULT_ACTIVE_INTEGRATION;
}

function mergeActiveGitHubView(activeGitHubView?: string): ActiveGitHubView {
  return activeGitHubView === 'notifications' || activeGitHubView === 'review' || activeGitHubView === 'prs'
    ? activeGitHubView
    : DEFAULT_ACTIVE_GITHUB_VIEW;
}

function mergeActiveJiraView(activeJiraView?: string): ActiveJiraView {
  return activeJiraView === 'in-progress' ||
    activeJiraView === 'blocking' ||
    activeJiraView === 'high-priority' ||
    activeJiraView === 'active'
    ? activeJiraView
    : DEFAULT_ACTIVE_JIRA_VIEW;
}

function mergeGitHubPrWarningState(state?: GitHubPrWarningState | null) {
  if (!state || typeof state !== 'object') {
    return {};
  }

  return Object.fromEntries(
    Object.entries(state)
      .map(([key, value]) => {
        if (
          typeof key !== 'string' ||
          !value ||
          typeof value !== 'object' ||
          !Array.isArray(value.activeCaseKeys) ||
          typeof value.highlighted !== 'boolean' ||
          typeof value.updatedAt !== 'number'
        ) {
          return null;
        }

        const activeCaseKeys = value.activeCaseKeys.filter((caseKey): caseKey is string => typeof caseKey === 'string');
        return [
          key,
          {
            activeCaseKeys,
            highlighted: value.highlighted,
            updatedAt: value.updatedAt
          }
        ] satisfies [string, GitHubPrWarningStateEntry];
      })
      .filter((entry): entry is [string, GitHubPrWarningStateEntry] => entry !== null)
  );
}

function mergeGitHubPrReadyState(state?: GitHubPrReadyState | null) {
  if (!state || typeof state !== 'object') {
    return {};
  }

  return Object.fromEntries(
    Object.entries(state)
      .map(([key, value]) => {
        if (
          typeof key !== 'string' ||
          !value ||
          typeof value !== 'object' ||
          typeof value.isReady !== 'boolean' ||
          typeof value.highlighted !== 'boolean' ||
          typeof value.updatedAt !== 'number'
        ) {
          return null;
        }

        return [
          key,
          {
            isReady: value.isReady,
            highlighted: value.highlighted,
            updatedAt: value.updatedAt
          }
        ] satisfies [string, GitHubPrReadyStateEntry];
      })
      .filter((entry): entry is [string, GitHubPrReadyStateEntry] => entry !== null)
  );
}

function mergeGitHubPrNotificationSeenAtState(state?: GitHubPrNotificationSeenAtState | null) {
  if (!state || typeof state !== 'object') {
    return {};
  }

  return Object.fromEntries(
    Object.entries(state)
      .map(([key, value]) => {
        if (typeof key !== 'string' || typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
          return null;
        }

        return [key, value] satisfies [string, number];
      })
      .filter((entry): entry is [string, number] => entry !== null)
  );
}

function mergeGitHubMockScenarioKey(mockScenarioKey?: string | null) {
  return typeof mockScenarioKey === 'string' && mockScenarioKey.trim() ? mockScenarioKey.trim() : null;
}

function mergeGitHubDevMode(value?: boolean | string | null) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  return false;
}
