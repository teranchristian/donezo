import { getEmptyGitHubDashboardData, type GitHubDashboardData, type GitHubPullRequestItem } from '../../lib/githubApi';
import type { GitHubPrWarningState } from '../../lib/storage';

export type GitHubMockScenario = {
  key: string;
  dashboardData: GitHubDashboardData;
  warningState: GitHubPrWarningState;
};

const BASE_UPDATED_AT = '2026-05-06T09:30:00.000Z';
const BASE_DASHBOARD_DATA: GitHubDashboardData = {
  ...getEmptyGitHubDashboardData('connected'),
  connectionStatus: 'connected',
  notificationsCount: 4,
  openPrsCount: 4,
  reviewRequestedCount: 1,
  missingUsername: false,
  lastUpdatedAt: Date.now(),
  pullRequests: [
    createPullRequest({
      id: 101,
      title: 'Clamp Salesforce sync lookback to 30 days',
      repositoryName: 'acme/platform-web',
      owner: 'acme',
      repo: 'platform-web',
      pullNumber: 1533,
      reviewStatus: 'approved',
      ciStatus: 'passing',
      mergeStateStatus: 'CLEAN',
      updatedAt: BASE_UPDATED_AT
    }),
    createPullRequest({
      id: 102,
      title: 'Refresh focus states after review queue changes',
      repositoryName: 'acme/platform-web',
      owner: 'acme',
      repo: 'platform-web',
      pullNumber: 1534,
      reviewStatus: 'waiting-review',
      ciStatus: 'pending',
      mergeStateStatus: 'CLEAN',
      source: 'review-requested',
      authorLogin: 'reginald',
      updatedAt: '2026-05-06T09:12:00.000Z'
    }),
    createPullRequest({
      id: 103,
      title: 'Improve new dashboard warning badge behavior',
      repositoryName: 'acme/chrome-home-page',
      owner: 'acme',
      repo: 'chrome-home-page',
      pullNumber: 88,
      reviewStatus: 'approved',
      ciStatus: 'passing',
      mergeStateStatus: 'CLEAN',
      updatedAt: '2026-05-06T08:54:00.000Z'
    }),
    createPullRequest({
      id: 104,
      title: 'Tighten Jira panel spacing on small screens',
      repositoryName: 'acme/chrome-home-page',
      owner: 'acme',
      repo: 'chrome-home-page',
      pullNumber: 89,
      reviewStatus: 'open',
      ciStatus: 'no-checks',
      mergeStateStatus: 'CLEAN',
      updatedAt: '2026-05-06T08:20:00.000Z'
    })
  ],
  notifications: []
};

const MOCK_SCENARIOS: Record<string, GitHubMockScenario> = {
  'ready-to-merge': {
    key: 'ready-to-merge',
    dashboardData: cloneDashboardData(BASE_DASHBOARD_DATA),
    warningState: {}
  },
  'warning-conflict-new': createWarningScenario('warning-conflict-new', 'DIRTY', 'has-conflicts'),
  'warning-build-failed-new': createWarningScenario('warning-build-failed-new', 'CLEAN', 'failed-checks'),
  'warning-out-of-date-new': createWarningScenario('warning-out-of-date-new', 'BEHIND', 'out-of-date'),
  'warning-already-seen': (() => {
    const dashboardData = cloneDashboardData(BASE_DASHBOARD_DATA);
    dashboardData.pullRequests = dashboardData.pullRequests.map((pullRequest) =>
      pullRequest.pullNumber === 1533
        ? {
            ...pullRequest,
            mergeStateStatus: 'DIRTY',
            updatedAt: '2026-05-06T09:42:00.000Z'
          }
        : pullRequest
    );

    return {
      key: 'warning-already-seen',
      dashboardData,
      warningState: {
        [getWarningStateKey('acme/platform-web', 1533)]: {
          activeCaseKeys: ['has-conflicts'],
          highlighted: false,
          updatedAt: Date.now() - 10_000
        }
      }
    };
  })(),
  mixed: (() => {
    const dashboardData = cloneDashboardData(BASE_DASHBOARD_DATA);
    dashboardData.pullRequests = dashboardData.pullRequests.map((pullRequest) => {
      if (pullRequest.pullNumber === 1533) {
        return {
          ...pullRequest,
          ciStatus: 'failing',
          updatedAt: '2026-05-06T09:44:00.000Z'
        };
      }

      if (pullRequest.pullNumber === 89) {
        return {
          ...pullRequest,
          reviewStatus: 'approved',
          ciStatus: 'passing',
          mergeStateStatus: 'CLEAN',
          updatedAt: '2026-05-06T09:28:00.000Z'
        };
      }

      return pullRequest;
    });

    return {
      key: 'mixed',
      dashboardData,
      warningState: {
        [getWarningStateKey('acme/platform-web', 1533)]: {
          activeCaseKeys: [],
          highlighted: false,
          updatedAt: Date.now() - 10_000
        }
      }
    };
  })()
};

export function getGitHubMockScenarioKeyFromLocation(search: string, hash: string) {
  const searchMockKey = new URLSearchParams(search).get('mock')?.trim() ?? '';
  const hashMockKey = getHashMockKey(hash);
  return hashMockKey || searchMockKey || null;
}

export function getGitHubMockScenarioByKey(mockKey: string | null | undefined) {
  if (!mockKey) {
    return null;
  }

  return MOCK_SCENARIOS[mockKey] ? cloneScenario(MOCK_SCENARIOS[mockKey]) : null;
}

function getHashMockKey(hash: string) {
  const trimmedHash = hash.replace(/^#/, '').trim();
  if (!trimmedHash) {
    return '';
  }

  const [, rawSearch = ''] = trimmedHash.split('?');
  return new URLSearchParams(rawSearch).get('mock')?.trim() ?? '';
}

function createWarningScenario(
  key: string,
  mergeStateStatus: GitHubPullRequestItem['mergeStateStatus'],
  warningCaseKey: string
): GitHubMockScenario {
  const dashboardData = cloneDashboardData(BASE_DASHBOARD_DATA);
  dashboardData.pullRequests = dashboardData.pullRequests.map((pullRequest) => {
    if (pullRequest.pullNumber !== 1533) {
      return pullRequest;
    }

    return {
      ...pullRequest,
      ciStatus: warningCaseKey === 'failed-checks' ? 'failing' : pullRequest.ciStatus,
      mergeStateStatus,
      updatedAt: '2026-05-06T09:41:00.000Z'
    };
  });

  return {
    key,
    dashboardData,
    warningState: {
      [getWarningStateKey('acme/platform-web', 1533)]: {
        activeCaseKeys: [],
        highlighted: false,
        updatedAt: Date.now() - 10_000
      }
    }
  };
}

function createPullRequest(
  overrides: Partial<GitHubPullRequestItem> &
    Pick<
      GitHubPullRequestItem,
      | 'id'
      | 'title'
      | 'repositoryName'
      | 'owner'
      | 'repo'
      | 'pullNumber'
      | 'reviewStatus'
      | 'ciStatus'
      | 'mergeStateStatus'
      | 'updatedAt'
    >
): GitHubPullRequestItem {
  return {
    id: overrides.id,
    title: overrides.title,
    repositoryName: overrides.repositoryName,
    owner: overrides.owner,
    repo: overrides.repo,
    pullNumber: overrides.pullNumber,
    authorLogin: overrides.authorLogin ?? 'xtian',
    isDraft: overrides.reviewStatus === 'draft',
    updatedAt: overrides.updatedAt,
    url: overrides.url ?? `https://github.com/${overrides.owner}/${overrides.repo}/pull/${overrides.pullNumber}`,
    source: overrides.source ?? 'authored',
    reviewStatus: overrides.reviewStatus,
    ciStatus: overrides.ciStatus,
    mergeStateStatus: overrides.mergeStateStatus,
    mergeQueueEntry: overrides.mergeQueueEntry ?? null,
    detailsLoaded: overrides.detailsLoaded ?? true
  };
}

function cloneScenario(scenario: GitHubMockScenario): GitHubMockScenario {
  return {
    key: scenario.key,
    dashboardData: cloneDashboardData(scenario.dashboardData),
    warningState: structuredClone(scenario.warningState)
  };
}

function cloneDashboardData(data: GitHubDashboardData): GitHubDashboardData {
  return {
    ...structuredClone(data),
    lastUpdatedAt: Date.now()
  };
}

function getWarningStateKey(repositoryName: string, pullNumber: number) {
  return `${repositoryName}#${pullNumber}`;
}
