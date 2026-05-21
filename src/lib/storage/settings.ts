import {
  getStoredAreaJsonValue,
  getStoredJsonValue,
  getStoredRawValue,
  setStoredAreaJsonValue,
  setStoredJsonValue,
  setStoredRawValue,
} from './backend';
import {
  DEFAULT_GITHUB_OWNER_FILTER,
  getDefaultSettings,
  getDefaultSettingsTemplate
} from './defaults';
import {
  DISPLAY_NAME_STORAGE_KEY,
  GITHUB_OWNER_FILTER_STORAGE_KEY,
  JIRA_API_TOKEN_STORAGE_KEY,
  JIRA_BASE_URL_STORAGE_KEY,
  JIRA_EMAIL_STORAGE_KEY,
  SETTINGS_STORAGE_KEY
} from './keys';
import type { DashboardSettings, GitHubListOrganizationFilter } from './types';

export { getDefaultSettings } from './defaults';

const DISPLAY_NAME_EXTENSION_STORAGE_AREA = 'sync';
const GITHUB_OWNER_FILTER_EXTENSION_STORAGE_AREA = 'sync';
let hasSeenStoredDisplayNameValue = false;

export async function getStoredSettings() {
  const storedSettings = await getStoredJsonValue<Partial<DashboardSettings>>(
    SETTINGS_STORAGE_KEY,
  );
  const [displayName, ownerFilter, baseUrl, email, apiToken] = await Promise.all([
    getStoredDisplayName(),
    getStoredGitHubOwnerFilter(),
    getStoredRawValue(JIRA_BASE_URL_STORAGE_KEY),
    getStoredRawValue(JIRA_EMAIL_STORAGE_KEY),
    getStoredRawValue(JIRA_API_TOKEN_STORAGE_KEY),
  ]);

  return mergeSettings(storedSettings ?? undefined, {
    ownerFilter,
    baseUrl,
    email,
    apiToken,
    displayName,
  });
}

export async function saveStoredSettings(settings: DashboardSettings) {
  const localSettings = {
    integrations: {
      ...settings.integrations,
      github: {
        ...settings.integrations.github,
        ownerFilter: '',
      },
    },
  };

  await Promise.all([
    saveStoredDisplayName(settings.name),
    saveStoredGitHubOwnerFilter(settings.integrations.github.ownerFilter),
    setStoredJsonValue(SETTINGS_STORAGE_KEY, localSettings),
    setStoredRawValue(
      JIRA_BASE_URL_STORAGE_KEY,
      normalizeBaseUrl(settings.integrations.jira.baseUrl),
    ),
    setStoredRawValue(
      JIRA_EMAIL_STORAGE_KEY,
      settings.integrations.jira.email.trim(),
    ),
    setStoredRawValue(
      JIRA_API_TOKEN_STORAGE_KEY,
      settings.integrations.jira.apiToken.trim(),
    ),
  ]);
}

export async function getStoredDisplayName() {
  const storedName = await getStoredAreaJsonValue<string>(
    DISPLAY_NAME_STORAGE_KEY,
    { area: DISPLAY_NAME_EXTENSION_STORAGE_AREA },
  );

  hasSeenStoredDisplayNameValue = typeof storedName === 'string';
  return normalizeDisplayName(storedName);
}

export async function saveStoredDisplayName(name: string) {
  const normalizedDisplayName = normalizeDisplayName(name);
  if (!normalizedDisplayName && !hasSeenStoredDisplayNameValue) {
    return;
  }

  await setStoredAreaJsonValue(
    DISPLAY_NAME_STORAGE_KEY,
    normalizedDisplayName,
    { area: DISPLAY_NAME_EXTENSION_STORAGE_AREA },
  );
  hasSeenStoredDisplayNameValue = true;
}

export async function getStoredGitHubOwnerFilter() {
  const storedOwnerFilter = await getStoredAreaJsonValue<string>(
    GITHUB_OWNER_FILTER_STORAGE_KEY,
    { area: GITHUB_OWNER_FILTER_EXTENSION_STORAGE_AREA },
  );

  return mergeGitHubOwnerFilter(storedOwnerFilter ?? undefined);
}

export async function saveStoredGitHubOwnerFilter(ownerFilter: string) {
  const normalizedOwnerFilter = mergeGitHubOwnerFilter(ownerFilter);

  await setStoredAreaJsonValue(
    GITHUB_OWNER_FILTER_STORAGE_KEY,
    normalizedOwnerFilter,
    { area: GITHUB_OWNER_FILTER_EXTENSION_STORAGE_AREA },
  );
}

function mergeSettings(
  settings?: Partial<DashboardSettings>,
  overrides?: Partial<DashboardSettings['integrations']['jira']> & {
    ownerFilter?: string;
    displayName?: string;
  }
): DashboardSettings {
  const defaultSettings = getDefaultSettingsTemplate();
  const jiraBaseUrl = overrides?.baseUrl ?? settings?.integrations?.jira?.baseUrl ?? defaultSettings.integrations.jira.baseUrl;
  const jiraEmail = overrides?.email ?? settings?.integrations?.jira?.email ?? defaultSettings.integrations.jira.email;
  const jiraApiToken =
    overrides?.apiToken ?? settings?.integrations?.jira?.apiToken ?? defaultSettings.integrations.jira.apiToken;
  const gitHubOwnerFilter = mergeGitHubOwnerFilter(overrides?.ownerFilter);
  const hiddenRepositories = Array.isArray(settings?.integrations?.github?.hiddenRepositories)
    ? settings.integrations.github.hiddenRepositories
        .map((repository) => normalizeHiddenRepository(repository))
        .filter((repository): repository is NonNullable<typeof repository> => Boolean(repository))
    : defaultSettings.integrations.github.hiddenRepositories;

  return {
    name: normalizeDisplayName(overrides?.displayName),
    integrations: {
      github: {
        username: settings?.integrations?.github?.username ?? defaultSettings.integrations.github.username,
        token: settings?.integrations?.github?.token ?? defaultSettings.integrations.github.token,
        ownerFilter: gitHubOwnerFilter === 'all' ? '' : gitHubOwnerFilter,
        hiddenRepositories
      },
      jira: {
        baseUrl: normalizeBaseUrl(jiraBaseUrl),
        email: jiraEmail.trim(),
        apiToken: jiraApiToken.trim()
      }
    }
  };
}

function normalizeDisplayName(name: unknown) {
  return typeof name === 'string' ? name.trim().slice(0, 40) : '';
}

function normalizeBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, '');
}

function mergeGitHubOwnerFilter(filter?: string): GitHubListOrganizationFilter {
  return typeof filter === 'string' && filter.trim() ? filter : DEFAULT_GITHUB_OWNER_FILTER;
}

function normalizeHiddenRepository(repository: unknown) {
  const id = Number((repository as { id?: unknown })?.id);
  const name = String((repository as { name?: unknown })?.name ?? '').trim();
  const fullName = String((repository as { fullName?: unknown })?.fullName ?? '').trim();
  const owner = String((repository as { owner?: unknown })?.owner ?? '').trim();
  const url = String((repository as { url?: unknown })?.url ?? '').trim();

  if (!Number.isFinite(id) || !name || !fullName || !owner || !url) {
    return null;
  }

  return {
    id,
    name,
    fullName,
    owner,
    url
  };
}
