import {
  type GitHubPullRequestItem,
  type GitHubPullRequestState,
} from './githubApi';
import {
  getGitHubFocusStatusLabel,
  getGitHubFocusStatusTone,
} from './githubDomain';
import { getJiraIssueFocusTone } from './jiraDomain';
import { JiraIssue } from './jiraApi';
import { FocusItem, FocusJiraItem, FocusPullRequestItem } from './storage';

export type TodayFocusRefreshSignal = {
  lastCompletedAt: number | null;
  lastManualAt: number | null;
};

export type TodayFocusJiraSyncResult = {
  items: FocusItem[];
  missingKeys: string[];
};

export type TodayFocusGitHubSyncResult = {
  items: FocusItem[];
  missingPullRequests: Array<{
    id: string;
    owner: string;
    repo: string;
    pullNumber: number;
  }>;
};

export function reconcileTodayFocusJiraItems(
  items: FocusItem[],
  issues: JiraIssue[]
): TodayFocusJiraSyncResult {
  const issuesByKey = new Map(issues.map((issue) => [issue.key.toUpperCase(), issue] as const));
  const missingKeys = new Set<string>();
  let hasChanges = false;

  const nextItems = items.map((item) => {
    if (item.source !== 'jira') {
      return item;
    }

    const issue = issuesByKey.get(item.jiraKey.toUpperCase());
    if (!issue) {
      missingKeys.add(item.jiraKey);
      return item;
    }

    const nextItem = applyJiraIssueToFocusItem(item, issue);
    if (nextItem !== item) {
      hasChanges = true;
    }

    return nextItem;
  });

  return {
    items: hasChanges ? nextItems : items,
    missingKeys: Array.from(missingKeys)
  };
}

function applyJiraIssueToFocusItem(item: FocusJiraItem, issue: JiraIssue): FocusJiraItem {
  const nextTitle = issue.summary.trim();
  const nextStatusLabel = issue.status.name.trim();
  const nextStatusTone = getJiraIssueFocusTone(issue);
  const nextJiraStatusCategoryKey = issue.status.statusCategory?.key?.trim().toLowerCase() ?? undefined;

  if (
    item.title === nextTitle &&
    item.statusLabel === nextStatusLabel &&
    item.statusTone === nextStatusTone &&
    item.jiraStatusCategoryKey === nextJiraStatusCategoryKey
  ) {
    return item;
  }

  return {
    ...item,
    title: nextTitle,
    statusLabel: nextStatusLabel,
    statusTone: nextStatusTone,
    jiraStatusCategoryKey: nextJiraStatusCategoryKey
  };
}

export function reconcileTodayFocusGitHubItems(
  items: FocusItem[],
  pullRequests: GitHubPullRequestItem[]
): TodayFocusGitHubSyncResult {
  const pullRequestsById = new Map(
    pullRequests.map((pullRequest) => [getFocusPullRequestId(pullRequest), pullRequest] as const)
  );
  const missingPullRequests = new Map<
    string,
    {
      id: string;
      owner: string;
      repo: string;
      pullNumber: number;
    }
  >();
  let hasChanges = false;

  const nextItems = items.map((item) => {
    if (item.source === 'jira') {
      const nextChildren = item.children.map((child) => {
        const nextChild = reconcileGitHubFocusPullRequestItem(
          child,
          pullRequestsById,
          missingPullRequests
        );
        if (nextChild !== child) {
          hasChanges = true;
        }
        return nextChild;
      });

      return nextChildren.some((child, index) => child !== item.children[index])
        ? {
            ...item,
            children: nextChildren
          }
        : item;
    }

    const nextItem = reconcileGitHubFocusPullRequestItem(item, pullRequestsById, missingPullRequests);
    if (nextItem !== item) {
      hasChanges = true;
    }

    return nextItem;
  });

  return {
    items: hasChanges ? nextItems : items,
    missingPullRequests: Array.from(missingPullRequests.values())
  };
}

export function applyGitHubPullRequestStatesToTodayFocusItems(
  items: FocusItem[],
  pullRequestStates: Record<string, GitHubPullRequestState>
): FocusItem[] {
  let hasChanges = false;

  const nextItems = items.map((item) => {
    if (item.source === 'jira') {
      const nextChildren = item.children.map((child) => {
        const nextChild = applyGitHubPullRequestStateToFocusItem(child, pullRequestStates);
        if (nextChild !== child) {
          hasChanges = true;
        }
        return nextChild;
      });

      return nextChildren.some((child, index) => child !== item.children[index])
        ? {
            ...item,
            children: nextChildren
          }
        : item;
    }

    const nextItem = applyGitHubPullRequestStateToFocusItem(item, pullRequestStates);
    if (nextItem !== item) {
      hasChanges = true;
    }

    return nextItem;
  });

  return hasChanges ? nextItems : items;
}

function reconcileGitHubFocusPullRequestItem(
  item: FocusPullRequestItem,
  pullRequestsById: Map<string, GitHubPullRequestItem>,
  missingPullRequests: Map<
    string,
    {
      id: string;
      owner: string;
      repo: string;
      pullNumber: number;
    }
  >
) {
  if (isTerminalGitHubFocusStatus(item.statusLabel)) {
    return item;
  }

  const pullRequest = pullRequestsById.get(item.id);
  if (!pullRequest) {
    const identity = parseGitHubFocusPullRequestIdentity(item.id);
    if (identity) {
      missingPullRequests.set(item.id, identity);
    }
    return item;
  }

  const nextTitle = pullRequest.title.trim();
  const nextStatusLabel = getGitHubFocusStatusLabel(pullRequest.reviewStatus);
  const nextStatusTone = getGitHubFocusStatusTone(pullRequest.reviewStatus);
  const nextUrl = pullRequest.url;
  const nextRepositoryName = pullRequest.repositoryName;

  if (
    item.title === nextTitle &&
    item.statusLabel === nextStatusLabel &&
    item.statusTone === nextStatusTone &&
    item.url === nextUrl &&
    item.repositoryName === nextRepositoryName
  ) {
    return item;
  }

  return {
    ...item,
    title: nextTitle,
    statusLabel: nextStatusLabel,
    statusTone: nextStatusTone,
    url: nextUrl,
    repositoryName: nextRepositoryName
  };
}

function applyGitHubPullRequestStateToFocusItem(
  item: FocusPullRequestItem,
  pullRequestStates: Record<string, GitHubPullRequestState>
) {
  if (isTerminalGitHubFocusStatus(item.statusLabel)) {
    return item;
  }

  const state = pullRequestStates[item.id];
  if (!state || state === 'open') {
    return item;
  }

  const nextStatusLabel =
    state === 'merged' ? 'Merged' : state === 'not-found' ? 'Not found' : 'Closed';
  const nextStatusTone: FocusPullRequestItem['statusTone'] =
    state === 'merged' ? 'emerald' : 'amber';
  if (item.statusLabel === nextStatusLabel && item.statusTone === nextStatusTone) {
    return item;
  }

  return {
    ...item,
    statusLabel: nextStatusLabel,
    statusTone: nextStatusTone
  };
}

function parseGitHubFocusPullRequestIdentity(value: string) {
  const match = value.match(/^github:([^/]+)\/([^#]+)#(\d+)$/);
  if (!match) {
    return null;
  }

  const [, owner, repo, pullNumberValue] = match;
  const pullNumber = Number(pullNumberValue);
  if (!owner || !repo || !Number.isFinite(pullNumber) || pullNumber <= 0) {
    return null;
  }

  return {
    id: value,
    owner,
    repo,
    pullNumber
  };
}

function getFocusPullRequestId(pullRequest: GitHubPullRequestItem) {
  return `github:${pullRequest.owner}/${pullRequest.repo}#${pullRequest.pullNumber}`;
}

function isTerminalGitHubFocusStatus(statusLabel: string) {
  const normalizedStatus = statusLabel.trim().toLowerCase();
  return normalizedStatus === 'merged' || normalizedStatus === 'closed' || normalizedStatus === 'not found';
}
