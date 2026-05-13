import {
  getChromeStorageValues,
  getLocalStorageJsonValue,
  getLocalStorageRawValue,
  hasChromeStorage,
  setChromeStorageValues,
  setLocalStorageJsonValue,
  setLocalStorageRawValue
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
  if (hasChromeStorage()) {
    const result = await getChromeStorageValues([
      SETTINGS_STORAGE_KEY,
      GITHUB_OWNER_FILTER_STORAGE_KEY,
      JIRA_BASE_URL_STORAGE_KEY,
      JIRA_EMAIL_STORAGE_KEY,
      JIRA_API_TOKEN_STORAGE_KEY
    ] as const);

    return mergeSettings(result[SETTINGS_STORAGE_KEY] as Partial<DashboardSettings> | undefined, {
      ownerFilter: result[GITHUB_OWNER_FILTER_STORAGE_KEY] as string | undefined,
      baseUrl: result[JIRA_BASE_URL_STORAGE_KEY] as string | undefined,
      email: result[JIRA_EMAIL_STORAGE_KEY] as string | undefined,
      apiToken: result[JIRA_API_TOKEN_STORAGE_KEY] as string | undefined
    });
  }

  return mergeSettings(getLocalStorageJsonValue<Partial<DashboardSettings>>(SETTINGS_STORAGE_KEY) ?? undefined, {
    ownerFilter: getLocalStorageRawValue(GITHUB_OWNER_FILTER_STORAGE_KEY) ?? undefined,
    baseUrl: getLocalStorageRawValue(JIRA_BASE_URL_STORAGE_KEY) ?? undefined,
    email: getLocalStorageRawValue(JIRA_EMAIL_STORAGE_KEY) ?? undefined,
    apiToken: getLocalStorageRawValue(JIRA_API_TOKEN_STORAGE_KEY) ?? undefined
  });
}

export async function saveStoredSettings(settings: DashboardSettings) {
  if (hasChromeStorage()) {
    await setChromeStorageValues({
      [SETTINGS_STORAGE_KEY]: settings,
      [GITHUB_OWNER_FILTER_STORAGE_KEY]: settings.integrations.github.ownerFilter.trim(),
      [JIRA_BASE_URL_STORAGE_KEY]: normalizeBaseUrl(settings.integrations.jira.baseUrl),
      [JIRA_EMAIL_STORAGE_KEY]: settings.integrations.jira.email.trim(),
      [JIRA_API_TOKEN_STORAGE_KEY]: settings.integrations.jira.apiToken.trim()
    });
    return;
  }

  setLocalStorageJsonValue(SETTINGS_STORAGE_KEY, settings);
  setLocalStorageRawValue(GITHUB_OWNER_FILTER_STORAGE_KEY, settings.integrations.github.ownerFilter.trim());
  setLocalStorageRawValue(JIRA_BASE_URL_STORAGE_KEY, normalizeBaseUrl(settings.integrations.jira.baseUrl));
  setLocalStorageRawValue(JIRA_EMAIL_STORAGE_KEY, settings.integrations.jira.email.trim());
  setLocalStorageRawValue(JIRA_API_TOKEN_STORAGE_KEY, settings.integrations.jira.apiToken.trim());
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

  return {
    name: settings?.name?.trim() ?? getDefaultSettings().name,
    integrations: {
      github: {
        username: settings?.integrations?.github?.username ?? defaultSettings.integrations.github.username,
        token: settings?.integrations?.github?.token ?? defaultSettings.integrations.github.token,
        ownerFilter: gitHubOwnerFilter === 'all' ? '' : gitHubOwnerFilter
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
