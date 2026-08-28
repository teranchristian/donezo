import { describe, expect, it } from 'vitest';

import type { GitHubPullRequestItem } from './githubApi';
import type { JiraIssue } from './jiraApi';
import type {
  FocusJiraItem,
  FocusPullRequestItem,
} from './storage';
import {
  applyGitHubPullRequestStatesToTodayFocusItems,
  reconcileTodayFocusGitHubItems,
  reconcileTodayFocusJiraItems,
} from './todayFocusSync';

function createJiraFocusItem(
  overrides: Partial<FocusJiraItem> = {},
): FocusJiraItem {
  return {
    id: 'jira:ENG-123',
    source: 'jira',
    sourceLabel: 'Jira',
    reference: 'ENG-123',
    jiraKey: 'ENG-123',
    title: 'Old Jira title',
    statusLabel: 'To Do',
    statusTone: 'amber',
    jiraStatusCategoryKey: 'new',
    children: [],
    ...overrides,
  };
}

function createGitHubFocusItem(
  overrides: Partial<FocusPullRequestItem> = {},
): FocusPullRequestItem {
  return {
    id: 'github:teranchristian/donezo#15',
    source: 'github',
    sourceLabel: 'GitHub',
    reference: '#15',
    jiraKey: 'ENG-123',
    repositoryName: 'donezo',
    title: 'Old PR title',
    statusLabel: 'Waiting Review',
    statusTone: 'violet',
    url: 'https://github.com/teranchristian/donezo/pull/15',
    ...overrides,
  };
}

function createJiraIssue(overrides: Partial<JiraIssue> = {}): JiraIssue {
  return {
    id: '10001',
    key: 'ENG-123',
    summary: 'Current Jira title',
    updated: '2026-08-28T00:00:00Z',
    blockingCount: 0,
    blockingIssues: [],
    blockedByIssues: [],
    status: {
      name: 'In Progress',
      statusCategory: { key: 'indeterminate', name: 'In Progress' },
    },
    priority: { name: 'High' },
    ...overrides,
  };
}

function createPullRequest(
  overrides: Partial<GitHubPullRequestItem> = {},
): GitHubPullRequestItem {
  return {
    id: 15,
    title: 'Current PR title',
    headRefName: 'ENG-123-current-pr-title',
    repositoryId: 7,
    repositoryName: 'donezo',
    repositoryUrl: 'https://github.com/teranchristian/donezo',
    owner: 'teranchristian',
    repo: 'donezo',
    pullNumber: 15,
    totalCommentCount: 0,
    authorLogin: 'teranchristian',
    isDraft: false,
    createdAt: '2026-08-01T00:00:00Z',
    updatedAt: '2026-08-28T00:00:00Z',
    url: 'https://github.com/teranchristian/donezo/pull/15',
    source: 'authored',
    reviewStatus: 'approved',
    ciStatus: 'passing',
    mergeStateStatus: 'CLEAN',
    mergeQueueEntry: null,
    detailsLoaded: true,
    ...overrides,
  };
}

describe('Today Focus Jira synchronization', () => {
  it('updates Jira-backed items from fresh issue data', () => {
    const item = createJiraFocusItem();
    const result = reconcileTodayFocusJiraItems([item], [createJiraIssue()]);

    expect(result.missingKeys).toEqual([]);
    expect(result.items[0]).toMatchObject({
      title: 'Current Jira title',
      statusLabel: 'In Progress',
      statusTone: 'violet',
      jiraStatusCategoryKey: 'indeterminate',
    });
  });

  it('preserves the original array when data is unchanged', () => {
    const issue = createJiraIssue();
    const item = createJiraFocusItem({
      title: issue.summary,
      statusLabel: issue.status.name,
      statusTone: 'violet',
      jiraStatusCategoryKey: 'indeterminate',
    });
    const items = [item];

    expect(reconcileTodayFocusJiraItems(items, [issue]).items).toBe(items);
  });

  it('reports Jira keys missing from the dashboard payload', () => {
    const result = reconcileTodayFocusJiraItems(
      [createJiraFocusItem()],
      [],
    );

    expect(result.items[0].title).toBe('Old Jira title');
    expect(result.missingKeys).toEqual(['ENG-123']);
  });
});

describe('Today Focus GitHub synchronization', () => {
  it('updates GitHub-backed items from fresh PR data', () => {
    const result = reconcileTodayFocusGitHubItems(
      [createGitHubFocusItem()],
      [createPullRequest()],
    );

    expect(result.missingPullRequests).toEqual([]);
    expect(result.items[0]).toMatchObject({
      title: 'Current PR title',
      statusLabel: 'Approved',
      statusTone: 'emerald',
      repositoryName: 'donezo',
    });
  });

  it('deduplicates missing PR fallbacks across root and nested items', () => {
    const pullRequest = createGitHubFocusItem();
    const jiraItem = createJiraFocusItem({ children: [pullRequest] });
    const result = reconcileTodayFocusGitHubItems(
      [jiraItem, pullRequest],
      [],
    );

    expect(result.missingPullRequests).toEqual([
      {
        id: pullRequest.id,
        owner: 'teranchristian',
        repo: 'donezo',
        pullNumber: 15,
      },
    ]);
  });

  it('applies terminal PR states to root and nested items', () => {
    const rootPullRequest = createGitHubFocusItem();
    const nestedPullRequest = createGitHubFocusItem({
      id: 'github:teranchristian/donezo#16',
      reference: '#16',
    });
    const jiraItem = createJiraFocusItem({ children: [nestedPullRequest] });

    const result = applyGitHubPullRequestStatesToTodayFocusItems(
      [rootPullRequest, jiraItem],
      {
        [rootPullRequest.id]: 'merged',
        [nestedPullRequest.id]: 'closed',
      },
    );

    expect(result[0]).toMatchObject({
      statusLabel: 'Merged',
      statusTone: 'emerald',
    });
    expect(result[1]).toMatchObject({
      children: [
        expect.objectContaining({
          statusLabel: 'Closed',
          statusTone: 'amber',
        }),
      ],
    });
  });

  it('does not overwrite an existing terminal status', () => {
    const item = createGitHubFocusItem({
      statusLabel: 'Merged',
      statusTone: 'emerald',
    });
    const items = [item];

    expect(
      applyGitHubPullRequestStatesToTodayFocusItems(items, {
        [item.id]: 'closed',
      }),
    ).toBe(items);
  });
});
