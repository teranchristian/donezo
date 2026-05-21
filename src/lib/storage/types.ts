export type Note = {
  id: string;
  text: string;
  createdAt: number;
};

export type FocusStatusTone = 'violet' | 'emerald' | 'amber';

type FocusItemBase = {
  id: string;
  sourceLabel: string;
  reference: string;
  url?: string;
  title: string;
  statusLabel: string;
  statusTone: FocusStatusTone;
};

export type FocusPullRequestItem = FocusItemBase & {
  source: 'github';
  jiraKey: string | null;
  repositoryName: string;
};

export type FocusJiraItem = FocusItemBase & {
  source: 'jira';
  jiraKey: string;
  jiraStatusCategoryKey?: string;
  children: FocusPullRequestItem[];
  isPlaceholder?: boolean;
};

export type ManualFocusTaskItem = FocusItemBase & {
  source: 'manual';
  note: string;
  completedAt: number | null;
  createdAt: number;
  updatedAt: number;
};

export type FocusItem =
  | FocusJiraItem
  | FocusPullRequestItem
  | ManualFocusTaskItem;

export type DashboardSettings = {
  name: string;
  integrations: {
    github: {
      username: string;
      token: string;
      ownerFilter: string;
      hiddenRepositories: GitHubHiddenRepository[];
    };
    jira: {
      baseUrl: string;
      email: string;
      apiToken: string;
    };
  };
};

export type GitHubHiddenRepository = {
  id: number;
  name: string;
  fullName: string;
  owner: string;
  url: string;
};

export type GitHubListOrganizationFilter = 'all' | string;
export type GitHubListSort =
  | 'focus-priority'
  | 'recently-updated'
  | 'oldest-updated'
  | 'repository-asc'
  | 'title-asc';
export type GitHubPrStatusFilter = 'all' | 'approved' | 'ready-to-merge' | 'waiting-review';
export type ActiveIntegration = 'github' | 'jira';
export type ActiveGitHubView = 'my-prs' | 'team-prs' | 'review';
export type ActiveJiraView = 'active' | 'in-progress' | 'blocking' | 'high-priority';

export type GitHubPrWarningStateEntry = {
  activeCaseKeys: string[];
  highlightedCaseKeys: string[];
  highlighted: boolean;
  updatedAt: number;
};

export type GitHubPrWarningState = Record<string, GitHubPrWarningStateEntry>;

export type GitHubPrReadyStateEntry = {
  isReady: boolean;
  highlighted: boolean;
  updatedAt: number;
};

export type GitHubPrReadyState = Record<string, GitHubPrReadyStateEntry>;
export type GitHubPrNotificationSeenAtState = Record<string, number>;
export type GitHubTeamPrTrackerState = {
  snapshotKeys: string[];
  pendingNewKeys: string[];
  lastProcessedUpdatedAt: number | null;
};
