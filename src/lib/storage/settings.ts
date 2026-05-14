import {
  getStoredJsonValue,
  getStoredRawValue,
  setStoredJsonValue,
  setStoredRawValue,
} from './backend';
import {
  DEFAULT_GITHUB_OWNER_FILTER,
  getDefaultSettings,
  getDefaultSettingsTemplate
} from './defaults';
import {
  GITHUB_OWNER_FILTER_STORAGE_KEY,
  JIRA_API_TOKEN_STORAGE_KEY,
  JIRA_BASE_URL_STORAGE_KEY,
  JIRA_EMAIL_STORAGE_KEY,
  SETTINGS_STORAGE_KEY
} from './keys';
import type { DashboardSettings, GitHubListOrganizationFilter } from './types';

export { getDefaultSettings } from './defaults';

export async function getStoredSettings() {
  const storedSettings = await getStoredJsonValue<Partial<DashboardSettings>>(
    SETTINGS_STORAGE_KEY,
  );
  const [ownerFilter, baseUrl, email, apiToken] = await Promise.all([
    getStoredRawValue(GITHUB_OWNER_FILTER_STORAGE_KEY),
    getStoredRawValue(JIRA_BASE_URL_STORAGE_KEY),
    getStoredRawValue(JIRA_EMAIL_STORAGE_KEY),
    getStoredRawValue(JIRA_API_TOKEN_STORAGE_KEY),
  ]);

  return mergeSettings(storedSettings ?? undefined, {
    ownerFilter,
    baseUrl,
    email,
    apiToken,
  });
}

export async function saveStoredSettings(settings: DashboardSettings) {
  await Promise.all([
    setStoredJsonValue(SETTINGS_STORAGE_KEY, settings),
    setStoredRawValue(
      GITHUB_OWNER_FILTER_STORAGE_KEY,
      settings.integrations.github.ownerFilter.trim(),
    ),
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

function mergeSettings(
  settings?: Partial<DashboardSettings>,
  overrides?: Partial<DashboardSettings['integrations']['jira']> & {
    ownerFilter?: string;
  }
): DashboardSettings {
  const defaultSettings = getDefaultSettingsTemplate();
  const jiraBaseUrl = overrides?.baseUrl ?? settings?.integrations?.jira?.baseUrl ?? defaultSettings.integrations.jira.baseUrl;
  const jiraEmail = overrides?.email ?? settings?.integrations?.jira?.email ?? defaultSettings.integrations.jira.email;
  const jiraApiToken =
    overrides?.apiToken ?? settings?.integrations?.jira?.apiToken ?? defaultSettings.integrations.jira.apiToken;
  const gitHubOwnerFilter = mergeGitHubOwnerFilter(settings?.integrations?.github?.ownerFilter ?? overrides?.ownerFilter);
  const hiddenRepositories = Array.isArray(settings?.integrations?.github?.hiddenRepositories)
    ? settings.integrations.github.hiddenRepositories
        .map((repository) => normalizeHiddenRepository(repository))
        .filter((repository): repository is NonNullable<typeof repository> => Boolean(repository))
    : defaultSettings.integrations.github.hiddenRepositories;

  return {
    name: settings?.name?.trim() ?? getDefaultSettings().name,
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
