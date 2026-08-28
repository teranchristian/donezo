export type GitHubConnectionStatus =
  | 'not-connected'
  | 'testing'
  | 'connected'
  | 'invalid'
  | 'error';

export type GitHubPullRequestState =
  | 'open'
  | 'merged'
  | 'closed'
  | 'not-found';

export type GitHubNotification = {
  id: string;
  unread: boolean;
  last_read_at?: string | null;
  updated_at: string;
  reason: string;
  authorLogin?: string;
  pullRequestState?: GitHubPullRequestState;
  repository: {
    full_name: string;
  };
  subject: {
    title: string;
    type: string;
    url: string | null;
    latest_comment_url?: string | null;
  };
};

export type GitHubPullRequestItem = {
  id: number;
  title: string;
  headRefName: string;
  repositoryId: number;
  repositoryName: string;
  repositoryUrl: string;
  owner: string;
  repo: string;
  pullNumber: number;
  totalCommentCount: number;
  authorLogin: string;
  isDraft: boolean;
  createdAt: string;
  updatedAt: string;
  url: string;
  source: 'authored' | 'review-requested' | 'recent';
  reviewStatus:
    | 'approved'
    | 'changes-requested'
    | 'waiting-review'
    | 'draft'
    | 'open';
  ciStatus: 'passing' | 'failing' | 'pending' | 'no-checks';
  mergeStateStatus:
    | 'BEHIND'
    | 'BLOCKED'
    | 'CLEAN'
    | 'DIRTY'
    | 'DRAFT'
    | 'HAS_HOOKS'
    | 'UNKNOWN'
    | 'UNSTABLE';
  mergeQueueEntry: {
    position: number;
    state:
      | 'AWAITING_CHECKS'
      | 'LOCKED'
      | 'MERGEABLE'
      | 'QUEUED'
      | 'UNMERGEABLE';
  } | null;
  detailsLoaded: boolean;
};

export type GitHubDashboardData = {
  connectionStatus: GitHubConnectionStatus;
  notificationsCount: number;
  openPrsCount: number;
  recentOpenPrsCount: number;
  reviewRequestedCount: number;
  notifications: GitHubNotification[];
  pullRequests: GitHubPullRequestItem[];
  recentPullRequests: GitHubPullRequestItem[];
  errorMessage: string | null;
  missingUsername: boolean;
  lastUpdatedAt: number | null;
};

export type GitHubRepository = {
  id: number;
  name: string;
  fullName: string;
  owner: string;
  url: string;
  isPrivate: boolean;
  updatedAt: string;
  description: string;
};

export type JiraProfile = {
  accountId: string;
  displayName: string;
  emailAddress?: string;
};

export type JiraLinkedIssue = {
  key: string;
  summary?: string;
  status?: string;
  assignee?: string;
};

export type JiraIssue = {
  id: string;
  key: string;
  summary: string;
  updated: string;
  project?: {
    key?: string;
    name?: string;
  };
  blockingCount: number;
  blockingIssues: JiraLinkedIssue[];
  blockedByIssues: JiraLinkedIssue[];
  status: {
    name: string;
    statusCategory?: {
      key?: string;
      name?: string;
    };
  };
  priority?: {
    name?: string;
  };
  issuelinks?: Array<{
    type?: {
      name?: string;
      inward?: string;
      outward?: string;
    };
    inwardIssue?: {
      key?: string;
      fields?: {
        summary?: string;
        status?: {
          name?: string;
        };
        assignee?: {
          displayName?: string;
        };
      };
    };
    outwardIssue?: {
      key?: string;
      fields?: {
        summary?: string;
        status?: {
          name?: string;
        };
        assignee?: {
          displayName?: string;
        };
      };
    };
  }>;
};

type GitHubDashboardCredentials = {
  username: string;
  token: string;
  ownerFilter: string;
};

type JiraCredentials = {
  jiraBaseUrl: string;
  jiraEmail: string;
  jiraApiToken: string;
};

export type BackgroundMessageMap = {
  TEST_GITHUB_CONNECTION: {
    payload: {
      token: string;
    };
    response:
      | {
          success: true;
          status: GitHubConnectionStatus;
        }
      | {
          success: false;
          status?: GitHubConnectionStatus;
          error?: string;
        };
  };
  FETCH_GITHUB_OWNER_OPTIONS: {
    payload: {
      token: string;
      username: string;
    };
    response:
      | {
          success: true;
          owners: string[];
        }
      | {
          success: false;
          owners?: string[];
          error?: string;
        };
  };
  FETCH_GITHUB_DASHBOARD: {
    payload: GitHubDashboardCredentials & {
      forceRefresh: boolean;
      source?: string;
      requestId?: string;
    };
    response:
      | {
          success: true;
          data: GitHubDashboardData;
        }
      | {
          success: false;
          error?: string;
        };
  };
  FETCH_GITHUB_REPO_INDEX: {
    payload: GitHubDashboardCredentials & {
      forceRefresh: boolean;
    };
    response:
      | {
          success: true;
          repos: GitHubRepository[];
        }
      | {
          success: false;
          repos?: GitHubRepository[];
          error?: string;
        };
  };
  POLL_GITHUB_ACTIVITY: {
    payload: GitHubDashboardCredentials;
    response:
      | {
          success: true;
          hasChanges: boolean;
          data?: GitHubDashboardData;
          changedNotificationIds: string[];
        }
      | {
          success: false;
          hasChanges?: boolean;
          data?: GitHubDashboardData;
          changedNotificationIds?: string[];
          error?: string;
        };
  };
  FETCH_GITHUB_PULL_REQUEST_STATE: {
    payload: {
      owner: string;
      repo: string;
      pullNumber: number;
      token: string;
    };
    response:
      | {
          success: true;
          state: GitHubPullRequestState;
        }
      | {
          success: false;
          state?: GitHubPullRequestState;
          error?: string;
        };
  };
  FETCH_GITHUB_PULL_REQUEST_STATES: {
    payload: {
      token: string;
      pullRequests: Array<{
        id: string;
        owner: string;
        repo: string;
        pullNumber: number;
      }>;
    };
    response:
      | {
          success: true;
          states: Record<string, GitHubPullRequestState>;
        }
      | {
          success: false;
          states?: Record<string, GitHubPullRequestState>;
          error?: string;
        };
  };
  TEST_JIRA_CONNECTION: {
    payload: JiraCredentials;
    response:
      | {
          success: true;
          user: JiraProfile;
        }
      | {
          success: false;
          status?: number;
          error?: string;
        };
  };
  FETCH_JIRA_ISSUES: {
    payload: JiraCredentials & {
      forceRefresh: boolean;
    };
    response: JiraIssuesResponse;
  };
  FETCH_JIRA_ISSUES_BY_KEYS: {
    payload: JiraCredentials & {
      issueKeys: string[];
    };
    response: JiraIssuesResponse;
  };
};

type JiraIssuesResponse =
  | {
      success: true;
      issues: JiraIssue[];
    }
  | {
      success: false;
      status?: number;
      error?: string;
    };

export type BackgroundMessageType = keyof BackgroundMessageMap;

export type BackgroundRequest<
  MessageType extends BackgroundMessageType = BackgroundMessageType,
> = {
  [Type in MessageType]: {
    type: Type;
    payload: BackgroundMessageMap[Type]['payload'];
  };
}[MessageType];

export type BackgroundResponse<MessageType extends BackgroundMessageType> =
  BackgroundMessageMap[MessageType]['response'];
