import type {
  ActiveGitHubView,
  ActiveIntegration,
  ActiveJiraView,
  DashboardSettings,
  GitHubListOrganizationFilter,
  GitHubListSort,
  GitHubPrStatusFilter
} from './types';

const DEFAULT_SETTINGS: DashboardSettings = {
  name: '',
  integrations: {
    github: {
      username: '',
      token: '',
      ownerFilter: '',
      hiddenRepositories: []
    },
    jira: {
      baseUrl: '',
      email: '',
      apiToken: ''
    }
  }
};

export const DEFAULT_GITHUB_OWNER_FILTER: GitHubListOrganizationFilter = 'all';
export const DEFAULT_GITHUB_SORT_ORDER: GitHubListSort = 'recently-updated';
export const DEFAULT_GITHUB_PR_STATUS_FILTER: GitHubPrStatusFilter = 'all';
export const DEFAULT_ACTIVE_INTEGRATION: ActiveIntegration = 'github';
export const DEFAULT_ACTIVE_GITHUB_VIEW: ActiveGitHubView = 'prs';
export const DEFAULT_ACTIVE_JIRA_VIEW: ActiveJiraView = 'active';

export function getDefaultSettings() {
  return structuredClone(DEFAULT_SETTINGS);
}

export function getDefaultSettingsTemplate() {
  return DEFAULT_SETTINGS;
}
