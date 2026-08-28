import { afterEach, describe, expect, it, vi } from 'vitest';

import type { GitHubPullRequestItem } from './githubApi';
import {
  buildGitHubPrReadyState,
  buildGitHubPrWarningState,
  extractJiraKey,
  getActiveGitHubPrWarningCaseKeys,
  getPullRequestJiraKey,
  isPullRequestReadyToMerge,
} from './githubDomain';

function createPullRequest(
  overrides: Partial<GitHubPullRequestItem> = {},
): GitHubPullRequestItem {
  return {
    id: 42,
    title: 'ENG-123 Add dashboard tests',
    headRefName: 'eng-123-dashboard-tests',
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
    updatedAt: '2026-08-02T00:00:00Z',
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

afterEach(() => {
  vi.restoreAllMocks();
});

describe('GitHub Jira key mapping', () => {
  it('extracts uppercase Jira keys from surrounding text', () => {
    expect(extractJiraKey('Fix ENG-123 before release')).toBe('ENG-123');
    expect(extractJiraKey('eng-123 stays lowercase')).toBeNull();
    expect(extractJiraKey('No ticket here')).toBeNull();
  });

  it('prefers the PR title and falls back to the branch name', () => {
    expect(getPullRequestJiraKey(createPullRequest())).toBe('ENG-123');
    expect(
      getPullRequestJiraKey(
        createPullRequest({
          title: 'Add dashboard tests',
          headRefName: 'feature/OPS-88-dashboard-tests',
        }),
      ),
    ).toBe('OPS-88');
  });
});

describe('GitHub pull request attention rules', () => {
  it('only marks approved, passing, clean, unqueued PRs as ready', () => {
    expect(isPullRequestReadyToMerge(createPullRequest())).toBe(true);
    expect(
      isPullRequestReadyToMerge(
        createPullRequest({ mergeQueueEntry: { position: 1, state: 'QUEUED' } }),
      ),
    ).toBe(false);
    expect(
      isPullRequestReadyToMerge(createPullRequest({ ciStatus: 'failing' })),
    ).toBe(false);
    expect(
      isPullRequestReadyToMerge(
        createPullRequest({ mergeStateStatus: 'BEHIND' }),
      ),
    ).toBe(false);
  });

  it('reports each active warning case', () => {
    expect(
      getActiveGitHubPrWarningCaseKeys(
        createPullRequest({
          ciStatus: 'failing',
          mergeStateStatus: 'DIRTY',
        }),
      ),
    ).toEqual(['has-conflicts', 'failed-checks']);
  });

  it('highlights newly introduced warning cases without reviving acknowledged ones', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000);
    const pullRequest = createPullRequest({ ciStatus: 'failing' });
    const key = 'donezo#15';

    const nextState = buildGitHubPrWarningState(
      {
        [key]: {
          activeCaseKeys: [],
          highlightedCaseKeys: [],
          highlighted: false,
          updatedAt: 500,
        },
      },
      [pullRequest],
    );

    expect(nextState[key]).toEqual({
      activeCaseKeys: ['failed-checks'],
      highlightedCaseKeys: ['failed-checks'],
      highlighted: true,
      updatedAt: 1_000,
    });

    const acknowledgedState = buildGitHubPrWarningState(
      {
        [key]: {
          ...nextState[key],
          highlightedCaseKeys: [],
          highlighted: false,
        },
      },
      [pullRequest],
    );

    expect(acknowledgedState[key].highlighted).toBe(false);
  });

  it('highlights a transition into ready-to-merge', () => {
    vi.spyOn(Date, 'now').mockReturnValue(2_000);
    const key = 'donezo#15';

    const nextState = buildGitHubPrReadyState(
      {
        [key]: {
          isReady: false,
          highlighted: false,
          updatedAt: 1_000,
        },
      },
      [createPullRequest()],
    );

    expect(nextState[key]).toEqual({
      isReady: true,
      highlighted: true,
      updatedAt: 2_000,
    });
  });
});
