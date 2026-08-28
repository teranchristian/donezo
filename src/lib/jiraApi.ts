import { sendBackgroundMessage } from './backgroundBridge';
import type {
  JiraIssue,
  JiraLinkedIssue,
  JiraProfile,
} from './backgroundMessages';
import {
  getJiraIssueFocusTone,
  isJiraIssueHighPriority,
  isJiraIssueInProgress,
} from './jiraDomain';

export type JiraConnectionStatus = 'not-connected' | 'testing' | 'connected' | 'invalid' | 'error';

export type {
  JiraIssue,
  JiraLinkedIssue,
  JiraProfile,
} from './backgroundMessages';

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
    project?: {
      key?: string;
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
    const response = await sendBackgroundMessage({
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
    const response = await sendBackgroundMessage({
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

export async function loadJiraIssuesByKeys(options: {
  baseUrl: string;
  email: string;
  apiToken: string;
  issueKeys: string[];
}) {
  const trimmedBaseUrl = normalizeJiraBaseUrl(options.baseUrl);
  const trimmedEmail = options.email.trim();
  const trimmedApiToken = options.apiToken.trim();
  const issueKeys = Array.from(
    new Set(options.issueKeys.map((issueKey) => issueKey.trim().toUpperCase()).filter(Boolean))
  );

  if (!trimmedBaseUrl || !trimmedEmail || !trimmedApiToken || issueKeys.length === 0) {
    return [];
  }

  if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
    return [];
  }

  try {
    const response = await sendBackgroundMessage({
      type: 'FETCH_JIRA_ISSUES_BY_KEYS',
      payload: {
        jiraBaseUrl: trimmedBaseUrl,
        jiraEmail: trimmedEmail,
        jiraApiToken: trimmedApiToken,
        issueKeys
      }
    });

    if (response?.success) {
      return response.issues.map(normalizeJiraIssue);
    }

    return [];
  } catch {
    return [];
  }
}

export function getJiraIssueCounts(issues: JiraIssue[]) {
  return {
    active: issues.length,
    inProgress: issues.filter(isJiraIssueInProgress).length,
    blocking: issues.filter(isBlockingIssue).length,
    highPriority: issues.filter(isJiraIssueHighPriority).length
  };
}

export function getJiraBrowseUrl(baseUrl: string, issueKey: string) {
  return `${normalizeJiraBaseUrl(baseUrl)}/browse/${issueKey}`;
}

export { getJiraIssueFocusTone };

export function getJiraSearchUrl(baseUrl: string) {
  return `${normalizeJiraBaseUrl(baseUrl)}/issues/?jql=${encodeURIComponent(JIRA_ACTIVE_ISSUES_JQL)}`;
}

export function normalizeJiraBaseUrl(baseUrl: string) {
  const trimmed = baseUrl.trim().replace(/\/+$/, '');
  if (!trimmed) {
    return '';
  }

  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export const JIRA_ACTIVE_ISSUES_JQL =
  'assignee = currentUser() AND statusCategory != Done ORDER BY priority DESC, updated DESC';

function getBlockingCount(issue: JiraIssueLike) {
  return getBlockingIssues(issue).length;
}

export function isBlockingIssue(issue: JiraIssue) {
  return issue.blockingCount > 0;
}

function normalizeJiraIssue(issue: JiraIssueLike): JiraIssue {
  const blockingIssues = getBlockingIssues(issue);
  const blockedByIssues = getBlockedByIssues(issue);

  return {
    id: String(issue?.id ?? ''),
    key: String(issue?.key ?? ''),
    summary: String(issue?.summary ?? issue?.fields?.summary ?? ''),
    updated: String(issue?.updated ?? issue?.fields?.updated ?? ''),
    project: issue?.project ?? issue?.fields?.project,
    blockingCount: blockingIssues.length,
    blockingIssues,
    blockedByIssues,
    status: {
      name: String(issue?.status?.name ?? issue?.fields?.status?.name ?? 'Unknown'),
      statusCategory: issue?.status?.statusCategory ?? issue?.fields?.status?.statusCategory
    },
    priority: issue?.priority ?? issue?.fields?.priority,
    issuelinks: issue?.issuelinks ?? issue?.fields?.issuelinks
  };
}

function getBlockingIssues(issue: JiraIssueLike) {
  return getIssueLinks(issue)
    .filter((link) => getIssueRelationshipType(link) === 'blocks')
    .map(getRelatedIssue)
    .filter((linkedIssue) => Boolean(linkedIssue.key));
}

function getBlockedByIssues(issue: JiraIssueLike) {
  return getIssueLinks(issue)
    .filter((link) => getIssueRelationshipType(link) === 'blocked-by')
    .map(getRelatedIssue)
    .filter((linkedIssue) => Boolean(linkedIssue.key));
}

function getIssueLinks(issue: JiraIssueLike) {
  return issue?.issuelinks ?? issue?.fields?.issuelinks ?? [];
}

function getIssueRelationshipType(link: NonNullable<JiraIssueLike['issuelinks']>[number]) {
  if (link?.type?.name !== 'Blocks') {
    return null;
  }

  const inwardLabel = String(link?.type?.inward ?? '').trim().toLowerCase();
  const outwardLabel = String(link?.type?.outward ?? '').trim().toLowerCase();

  if (outwardLabel === 'blocks') {
    if (link?.inwardIssue) {
      return 'blocks';
    }

    if (link?.outwardIssue) {
      return 'blocked-by';
    }
  }

  if (inwardLabel === 'is blocked by') {
    if (link?.inwardIssue) {
      return 'blocked-by';
    }

    if (link?.outwardIssue) {
      return 'blocks';
    }
  }

  if (link?.outwardIssue) {
    return 'blocks';
  }

  if (link?.inwardIssue) {
    return 'blocked-by';
  }

  return null;
}

function getRelatedIssue(link: NonNullable<JiraIssueLike['issuelinks']>[number]) {
  const relationshipType = getIssueRelationshipType(link);
  const linkedIssue =
    relationshipType === 'blocks'
      ? (link?.inwardIssue ?? link?.outwardIssue)
      : (link?.outwardIssue ?? link?.inwardIssue);

  return {
    key: String(linkedIssue?.key ?? ''),
    summary: linkedIssue?.fields?.summary,
    status: linkedIssue?.fields?.status?.name,
    assignee: linkedIssue?.fields?.assignee?.displayName
  };
}
