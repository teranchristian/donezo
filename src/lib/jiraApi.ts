export type JiraConnectionStatus = 'not-connected' | 'testing' | 'connected' | 'invalid' | 'error';

export type JiraProfile = {
  accountId: string;
  displayName: string;
  emailAddress?: string;
};

export type JiraIssue = {
  id: string;
  key: string;
  summary: string;
  updated: string;
  blockingCount: number;
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
    };
    outwardIssue?: {
      key?: string;
    };
  }>;
};

type JiraIssueLike = JiraIssue & {
  fields?: {
    summary?: string;
    updated?: string;
    status?: {
      name?: string;
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
      };
      outwardIssue?: {
        key?: string;
      };
    }>;
  };
};

export type JiraDashboardData = {
  connectionStatus: JiraConnectionStatus;
  issues: JiraIssue[];
  errorMessage: string | null;
  lastUpdatedAt: number | null;
};

export type JiraConnectionResult = {
  status: JiraConnectionStatus;
  profile: JiraProfile | null;
  errorMessage?: string;
};

export function getEmptyJiraDashboardData(
  connectionStatus: JiraConnectionStatus = 'not-connected'
): JiraDashboardData {
  return {
    connectionStatus,
    issues: [],
    errorMessage: null,
    lastUpdatedAt: null
  };
}

export async function testJiraConnection(
  baseUrl: string,
  email: string,
  apiToken: string
): Promise<JiraConnectionResult> {
  const trimmedBaseUrl = normalizeJiraBaseUrl(baseUrl);
  const trimmedEmail = email.trim();
  const trimmedApiToken = apiToken.trim();

  if (!trimmedBaseUrl || !trimmedEmail || !trimmedApiToken) {
    return { status: 'not-connected', profile: null };
  }

  if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
    return { status: 'error', profile: null, errorMessage: 'chrome.runtime.sendMessage is unavailable' };
  }

  try {
    const response = await sendMessage<BackgroundJiraConnectionResponse>({
      type: 'TEST_JIRA_CONNECTION',
      payload: {
        jiraBaseUrl: trimmedBaseUrl,
        jiraEmail: trimmedEmail,
        jiraApiToken: trimmedApiToken
      }
    });

    if (response?.success) {
      return { status: 'connected', profile: response.user, errorMessage: undefined };
    }

    if (response?.status === 401) {
      return { status: 'invalid', profile: null, errorMessage: response.error };
    }

    return { status: 'error', profile: null, errorMessage: response?.error ?? 'Unknown Jira connection error' };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown message bridge failure';
    return { status: 'error', profile: null, errorMessage };
  }
}

export async function loadJiraDashboardData(options: {
  baseUrl: string;
  email: string;
  apiToken: string;
  forceRefresh?: boolean;
}): Promise<JiraDashboardData> {
  const trimmedBaseUrl = normalizeJiraBaseUrl(options.baseUrl);
  const trimmedEmail = options.email.trim();
  const trimmedApiToken = options.apiToken.trim();

  if (!trimmedBaseUrl || !trimmedEmail || !trimmedApiToken) {
    return getEmptyJiraDashboardData('not-connected');
  }

  if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
    return {
      ...getEmptyJiraDashboardData('error'),
      errorMessage: 'chrome.runtime.sendMessage is unavailable'
    };
  }

  try {
    const response = await sendMessage<BackgroundJiraIssuesResponse>({
      type: 'FETCH_JIRA_ISSUES',
      payload: {
        jiraBaseUrl: trimmedBaseUrl,
        jiraEmail: trimmedEmail,
        jiraApiToken: trimmedApiToken,
        forceRefresh: Boolean(options.forceRefresh)
      }
    });

    if (response?.success) {
      return {
        connectionStatus: 'connected',
        issues: response.issues.map(normalizeJiraIssue),
        errorMessage: null,
        lastUpdatedAt: Date.now()
      };
    }

    if (response?.status === 401) {
      return {
        ...getEmptyJiraDashboardData('invalid'),
        errorMessage: response.error ?? 'Invalid Jira credentials'
      };
    }

    return {
      ...getEmptyJiraDashboardData('error'),
      errorMessage: response?.error ?? 'Jira data could not be loaded right now.'
    };
  } catch (error) {
    return {
      ...getEmptyJiraDashboardData('error'),
      errorMessage: error instanceof Error ? error.message : 'Unknown Jira message bridge failure'
    };
  }
}

export function getJiraIssueCounts(issues: JiraIssue[]) {
  return {
    active: issues.length,
    inProgress: issues.filter(isInProgressIssue).length,
    blocking: issues.filter(isBlockingIssue).length,
    highPriority: issues.filter(isHighPriorityIssue).length
  };
}

export function getJiraBrowseUrl(baseUrl: string, issueKey: string) {
  return `${normalizeJiraBaseUrl(baseUrl)}/browse/${issueKey}`;
}

export function getJiraSearchUrl(baseUrl: string) {
  return `${normalizeJiraBaseUrl(baseUrl)}/issues/?jql=${encodeURIComponent(JIRA_ACTIVE_ISSUES_JQL)}`;
}

export function normalizeJiraBaseUrl(baseUrl: string) {
  return baseUrl.trim().replace(/\/+$/, '');
}

export const JIRA_ACTIVE_ISSUES_JQL =
  'assignee = currentUser() AND statusCategory != Done ORDER BY priority DESC, updated DESC';

type BackgroundJiraConnectionResponse =
  | { success: true; user: JiraProfile }
  | { success: false; status?: number; error?: string };

type BackgroundJiraIssuesResponse =
  | { success: true; issues: JiraIssue[] }
  | { success: false; status?: number; error?: string };

function isInProgressIssue(issue: JiraIssue) {
  const statusName = issue.status.name.toLowerCase();
  const statusCategoryName = issue.status.statusCategory?.name?.toLowerCase() ?? '';
  const statusCategoryKey = issue.status.statusCategory?.key?.toLowerCase() ?? '';

  return (
    statusName.includes('in progress') ||
    statusCategoryName === 'indeterminate' ||
    statusCategoryKey === 'indeterminate'
  );
}

function isHighPriorityIssue(issue: JiraIssue) {
  const priorityName = issue.priority?.name?.toLowerCase() ?? '';
  return priorityName === 'highest' || priorityName === 'high';
}

function getBlockingCount(issue: JiraIssueLike) {
  const issueLinks = issue?.issuelinks ?? issue?.fields?.issuelinks ?? [];

  return issueLinks.filter(
    (link) => link?.type?.name === 'Blocks' && Boolean(link?.outwardIssue)
  ).length;
}

export function isBlockingIssue(issue: JiraIssue) {
  return issue.blockingCount > 0;
}

function normalizeJiraIssue(issue: JiraIssueLike): JiraIssue {
  return {
    id: String(issue?.id ?? ''),
    key: String(issue?.key ?? ''),
    summary: String(issue?.summary ?? issue?.fields?.summary ?? ''),
    updated: String(issue?.updated ?? issue?.fields?.updated ?? ''),
    blockingCount: getBlockingCount(issue),
    status: {
      name: String(issue?.status?.name ?? issue?.fields?.status?.name ?? 'Unknown'),
      statusCategory: issue?.status?.statusCategory ?? issue?.fields?.status?.statusCategory
    },
    priority: issue?.priority ?? issue?.fields?.priority,
    issuelinks: issue?.issuelinks ?? issue?.fields?.issuelinks
  };
}

function sendMessage<ResponseType>(message: Record<string, unknown>) {
  return new Promise<ResponseType>((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      const runtimeError = chrome.runtime.lastError;
      if (runtimeError) {
        reject(new Error(runtimeError.message));
        return;
      }

      resolve(response as ResponseType);
    });
  });
}
