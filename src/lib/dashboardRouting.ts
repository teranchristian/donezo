import type {
  ActiveGitHubView,
  ActiveIntegration,
  ActiveJiraView,
  GitHubPrStatusFilter
} from './storage';

export type DashboardNavigationState = {
  activeIntegration: ActiveIntegration;
  activeGitHubView: ActiveGitHubView;
  githubPrStatusFilter: GitHubPrStatusFilter;
  activeJiraView: ActiveJiraView;
};

const DEFAULT_DASHBOARD_NAVIGATION_STATE: DashboardNavigationState = {
  activeIntegration: 'github',
  activeGitHubView: 'prs',
  githubPrStatusFilter: 'all',
  activeJiraView: 'active'
};

export function getDefaultDashboardNavigationState(): DashboardNavigationState {
  return { ...DEFAULT_DASHBOARD_NAVIGATION_STATE };
}

export function parseDashboardHashNavigation(hash: string): DashboardNavigationState | null {
  const trimmedHash = hash.replace(/^#/, '').trim();
  if (!trimmedHash) {
    return null;
  }

  const [rawPath, rawSearch = ''] = trimmedHash.split('?');
  const path = rawPath.replace(/^\/+/, '');
  if (path !== 'github' && path !== 'jira') {
    return null;
  }

  const searchParams = new URLSearchParams(rawSearch);

  if (path === 'jira') {
    return {
      ...DEFAULT_DASHBOARD_NAVIGATION_STATE,
      activeIntegration: 'jira',
      activeJiraView: mergeActiveJiraView(searchParams.get('view'))
    };
  }

  const activeGitHubView = mergeActiveGitHubView(searchParams.get('view'));

  return {
    ...DEFAULT_DASHBOARD_NAVIGATION_STATE,
    activeIntegration: 'github',
    activeGitHubView,
    githubPrStatusFilter: activeGitHubView === 'prs'
      ? mergeGitHubPrStatusFilter(searchParams.get('status'))
      : DEFAULT_DASHBOARD_NAVIGATION_STATE.githubPrStatusFilter
  };
}

export function buildDashboardHashNavigation(state: DashboardNavigationState) {
  const searchParams = new URLSearchParams();

  if (state.activeIntegration === 'jira') {
    searchParams.set('view', state.activeJiraView);
    return `#/jira?${searchParams.toString()}`;
  }

  searchParams.set('view', state.activeGitHubView);
  if (state.activeGitHubView === 'prs') {
    searchParams.set('status', state.githubPrStatusFilter);
  }

  return `#/github?${searchParams.toString()}`;
}

function mergeGitHubPrStatusFilter(filter: string | null): GitHubPrStatusFilter {
  return filter === 'approved' || filter === 'ready-to-merge' || filter === 'waiting-review' || filter === 'all'
    ? filter
    : 'all';
}

function mergeActiveGitHubView(activeGitHubView: string | null): ActiveGitHubView {
  return activeGitHubView === 'notifications' || activeGitHubView === 'review' || activeGitHubView === 'prs'
    ? activeGitHubView
    : 'prs';
}

function mergeActiveJiraView(activeJiraView: string | null): ActiveJiraView {
  return activeJiraView === 'in-progress' ||
    activeJiraView === 'blocking' ||
    activeJiraView === 'high-priority' ||
    activeJiraView === 'active'
    ? activeJiraView
    : 'active';
}
