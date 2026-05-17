import {
  getStoredJsonValue,
  getStoredRawValue,
  removeStoredValue,
  setStoredJsonValue,
  setStoredRawValue,
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
  GITHUB_TEAM_PR_TRACKER_STORAGE_KEY,
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
  GitHubTeamPrTrackerState,
  GitHubPrWarningState,
  GitHubPrWarningStateEntry
} from './types';

export async function getStoredGitHubSortOrder() {
  return mergeGitHubSortOrder(
    (await getStoredJsonValue<string>(GITHUB_SORT_ORDER_STORAGE_KEY)) ??
      undefined,
  );
}

export async function saveStoredGitHubSortOrder(sortOrder: GitHubListSort) {
  await setStoredJsonValue(GITHUB_SORT_ORDER_STORAGE_KEY, sortOrder);
}

export async function getStoredGitHubPrStatusFilter() {
  return mergeGitHubPrStatusFilter(
    (await getStoredJsonValue<string>(GITHUB_PR_STATUS_FILTER_STORAGE_KEY)) ??
      undefined,
  );
}

export async function saveStoredGitHubPrStatusFilter(filter: GitHubPrStatusFilter) {
  await setStoredJsonValue(GITHUB_PR_STATUS_FILTER_STORAGE_KEY, filter);
}

export async function getStoredActiveIntegration() {
  return mergeActiveIntegration(
    (await getStoredJsonValue<string>(ACTIVE_INTEGRATION_STORAGE_KEY)) ??
      undefined,
  );
}

export async function saveStoredActiveIntegration(activeIntegration: ActiveIntegration) {
  await setStoredJsonValue(ACTIVE_INTEGRATION_STORAGE_KEY, activeIntegration);
}

export async function getStoredActiveGitHubView() {
  return mergeActiveGitHubView(
    (await getStoredJsonValue<string>(ACTIVE_GITHUB_VIEW_STORAGE_KEY)) ??
      undefined,
  );
}

export async function saveStoredActiveGitHubView(activeGitHubView: ActiveGitHubView) {
  await setStoredJsonValue(ACTIVE_GITHUB_VIEW_STORAGE_KEY, activeGitHubView);
}

export async function getStoredActiveJiraView() {
  return mergeActiveJiraView(
    (await getStoredJsonValue<string>(ACTIVE_JIRA_VIEW_STORAGE_KEY)) ??
      undefined,
  );
}

export async function saveStoredActiveJiraView(activeJiraView: ActiveJiraView) {
  await setStoredJsonValue(ACTIVE_JIRA_VIEW_STORAGE_KEY, activeJiraView);
}

export async function getStoredGitHubMockScenarioKey() {
  return mergeGitHubMockScenarioKey(
    await getStoredRawValue(GITHUB_MOCK_SCENARIO_STORAGE_KEY),
  );
}

export async function saveStoredGitHubMockScenarioKey(mockScenarioKey: string) {
  const normalizedMockScenarioKey = mergeGitHubMockScenarioKey(mockScenarioKey);
  if (!normalizedMockScenarioKey) {
    return;
  }

  await setStoredRawValue(
    GITHUB_MOCK_SCENARIO_STORAGE_KEY,
    normalizedMockScenarioKey,
  );
}

export async function clearStoredGitHubMockScenarioKey() {
  await removeStoredValue(GITHUB_MOCK_SCENARIO_STORAGE_KEY);
}

export async function getStoredGitHubDevMode() {
  const storedValue = await getStoredJsonValue<boolean | string>(
    GITHUB_DEV_MODE_STORAGE_KEY,
  );
  if (storedValue !== null) {
    return mergeGitHubDevMode(storedValue);
  }

  return mergeGitHubDevMode(await getStoredRawValue(GITHUB_DEV_MODE_STORAGE_KEY));
}

export async function saveStoredGitHubDevMode(isEnabled: boolean) {
  await setStoredJsonValue(GITHUB_DEV_MODE_STORAGE_KEY, isEnabled);
}

export async function getStoredGitHubPrWarningState() {
  return mergeGitHubPrWarningState(
    (await getStoredJsonValue<GitHubPrWarningState>(
      GITHUB_PR_WARNING_STATE_STORAGE_KEY,
    )) ?? undefined
  );
}

export async function saveStoredGitHubPrWarningState(state: GitHubPrWarningState) {
  const normalizedState = mergeGitHubPrWarningState(state);

  await setStoredJsonValue(GITHUB_PR_WARNING_STATE_STORAGE_KEY, normalizedState);
}

export async function getStoredGitHubPrReadyState() {
  return mergeGitHubPrReadyState(
    (await getStoredJsonValue<GitHubPrReadyState>(
      GITHUB_PR_READY_STATE_STORAGE_KEY,
    )) ?? undefined
  );
}

export async function saveStoredGitHubPrReadyState(state: GitHubPrReadyState) {
  const normalizedState = mergeGitHubPrReadyState(state);

  await setStoredJsonValue(GITHUB_PR_READY_STATE_STORAGE_KEY, normalizedState);
}

export async function getStoredGitHubPrNotificationSeenAtState() {
  return mergeGitHubPrNotificationSeenAtState(
    (await getStoredJsonValue<GitHubPrNotificationSeenAtState>(
      GITHUB_PR_NOTIFICATION_SEEN_AT_STORAGE_KEY,
    )) ?? undefined
  );
}

export async function saveStoredGitHubPrNotificationSeenAtState(state: GitHubPrNotificationSeenAtState) {
  const normalizedState = mergeGitHubPrNotificationSeenAtState(state);

  await setStoredJsonValue(
    GITHUB_PR_NOTIFICATION_SEEN_AT_STORAGE_KEY,
    normalizedState,
  );
}

export async function getStoredGitHubTeamPrTrackerState() {
  return mergeGitHubTeamPrTrackerState(
    (await getStoredJsonValue<GitHubTeamPrTrackerState>(
      GITHUB_TEAM_PR_TRACKER_STORAGE_KEY,
    )) ?? undefined
  );
}

export async function saveStoredGitHubTeamPrTrackerState(
  state: GitHubTeamPrTrackerState,
) {
  const normalizedState = mergeGitHubTeamPrTrackerState(state);

  await setStoredJsonValue(
    GITHUB_TEAM_PR_TRACKER_STORAGE_KEY,
    normalizedState,
  );
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
  if (
    activeGitHubView === 'my-prs' ||
    activeGitHubView === 'review' ||
    activeGitHubView === 'team-prs'
  ) {
    return activeGitHubView;
  }

  return DEFAULT_ACTIVE_GITHUB_VIEW;
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

function mergeGitHubTeamPrTrackerState(
  state?: GitHubTeamPrTrackerState | null,
): GitHubTeamPrTrackerState {
  if (!state || typeof state !== 'object') {
    return {
      snapshotKeys: [],
      pendingNewKeys: [],
      lastProcessedUpdatedAt: null,
    };
  }

  const snapshotKeys = Array.isArray(state.snapshotKeys)
    ? state.snapshotKeys.filter(
        (key): key is string => typeof key === 'string' && key.trim().length > 0,
      )
    : [];
  const pendingNewKeys = Array.isArray(state.pendingNewKeys)
    ? state.pendingNewKeys.filter(
        (key): key is string => typeof key === 'string' && key.trim().length > 0,
      )
    : [];
  const lastProcessedUpdatedAt =
    typeof state.lastProcessedUpdatedAt === 'number' &&
    Number.isFinite(state.lastProcessedUpdatedAt) &&
    state.lastProcessedUpdatedAt > 0
      ? state.lastProcessedUpdatedAt
      : null;

  return {
    snapshotKeys: [...new Set(snapshotKeys)],
    pendingNewKeys: [...new Set(pendingNewKeys)],
    lastProcessedUpdatedAt,
  };
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
