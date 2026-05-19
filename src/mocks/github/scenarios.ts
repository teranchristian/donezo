import {
  getEmptyGitHubDashboardData,
  type GitHubDashboardData,
  type GitHubNotification,
  type GitHubPullRequestItem
} from '../../lib/githubApi';
import type {
  GitHubPrNotificationSeenAtState,
  GitHubPrReadyState,
  GitHubTeamPrTrackerState,
  GitHubPrWarningState
} from '../../lib/storage';

export type GitHubMockScenario = {
  key: string;
  dashboardData: GitHubDashboardData;
  readyState: GitHubPrReadyState;
  warningState: GitHubPrWarningState;
  notificationSeenAtState: GitHubPrNotificationSeenAtState;
  teamPrTrackerState: GitHubTeamPrTrackerState;
};

export type GitHubMockScenarioOption = {
  key: string;
  label: string;
};

export const DEFAULT_GITHUB_MOCK_SCENARIO_KEY = 'base';

const BASE_UPDATED_AT = '2026-05-06T09:30:00.000Z';
const BASE_DASHBOARD_DATA: GitHubDashboardData = {
  ...getEmptyGitHubDashboardData('connected'),
  connectionStatus: 'connected',
  notificationsCount: 4,
  openPrsCount: 4,
  recentOpenPrsCount: 2,
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
  recentPullRequests: [
    createPullRequest({
      id: 301,
      title: 'Ship operator quick filters for dashboards',
      repositoryName: 'acme/platform-web',
      owner: 'acme',
      repo: 'platform-web',
      pullNumber: 1548,
      reviewStatus: 'open',
      ciStatus: 'pending',
      mergeStateStatus: 'CLEAN',
      source: 'recent',
      authorLogin: 'ava',
      updatedAt: '2026-05-06T09:44:00.000Z'
    }),
    createPullRequest({
      id: 302,
      title: 'Stabilize launch metrics export formatting',
      repositoryName: 'acme/chrome-home-page',
      owner: 'acme',
      repo: 'chrome-home-page',
      pullNumber: 94,
      reviewStatus: 'open',
      ciStatus: 'passing',
      mergeStateStatus: 'CLEAN',
      source: 'recent',
      authorLogin: 'noah',
      updatedAt: '2026-05-06T09:15:00.000Z'
    })
  ],
  notifications: []
};

const MOCK_SCENARIO_OPTIONS: GitHubMockScenarioOption[] = [
  { key: DEFAULT_GITHUB_MOCK_SCENARIO_KEY, label: 'Base' },
  { key: 'jira-auto-group', label: 'Jira auto group' },
  { key: 'ready-to-merge', label: 'Ready to merge' },
  { key: 'warning-conflict-new', label: 'Warning: conflict' },
  { key: 'warning-build-failed-new', label: 'Warning: build failed' },
  { key: 'warning-out-of-date-new', label: 'Warning: out of date' },
  { key: 'warning-already-seen', label: 'Warning: already seen' },
  { key: 'comment-badges', label: 'Comment badges' },
  { key: 'queued-prs', label: 'Queued PRs' },
  { key: 'team-prs-new', label: 'Team PRs: new' },
  { key: 'mixed', label: 'Mixed' }
];

const MOCK_SCENARIOS: Record<string, GitHubMockScenario> = {
  [DEFAULT_GITHUB_MOCK_SCENARIO_KEY]: {
    key: DEFAULT_GITHUB_MOCK_SCENARIO_KEY,
    dashboardData: cloneDashboardData(BASE_DASHBOARD_DATA),
    readyState: {},
    warningState: {},
    notificationSeenAtState: {},
    teamPrTrackerState: {
        snapshotKeys: [],
        pendingNewKeys: [],
        lastProcessedUpdatedAt: null,
      }
  },
  'jira-auto-group': (() => {
    const dashboardData = cloneDashboardData(BASE_DASHBOARD_DATA);
    dashboardData.pullRequests = [
      createPullRequest({
        id: 201,
        title: 'CLK-112 Fix venue provision defaults',
        repositoryName: 'acme/chrome-home-page',
        owner: 'acme',
        repo: 'chrome-home-page',
        pullNumber: 142,
        reviewStatus: 'approved',
        ciStatus: 'passing',
        mergeStateStatus: 'CLEAN',
        updatedAt: '2026-05-06T09:48:00.000Z'
      }),
      createPullRequest({
        id: 202,
        title: 'Venue play pause schedule update',
        headRefName: 'xtian/CLK-112-venue-play-pause-schedule-update',
        repositoryName: 'acme/platform-web',
        owner: 'acme',
        repo: 'platform-web',
        pullNumber: 2,
        reviewStatus: 'open',
        ciStatus: 'pending',
        mergeStateStatus: 'CLEAN',
        updatedAt: '2026-05-06T09:34:00.000Z'
      }),
      createPullRequest({
        id: 203,
        title: 'CLK-118 Tighten homepage review banner spacing',
        repositoryName: 'acme/chrome-home-page',
        owner: 'acme',
        repo: 'chrome-home-page',
        pullNumber: 91,
        reviewStatus: 'waiting-review',
        ciStatus: 'no-checks',
        mergeStateStatus: 'CLEAN',
        updatedAt: '2026-05-06T09:18:00.000Z'
      }),
      createPullRequest({
        id: 204,
        title: 'General cleanup for dashboard filters',
        repositoryName: 'acme/platform-web',
        owner: 'acme',
        repo: 'platform-web',
        pullNumber: 1540,
        reviewStatus: 'approved',
        ciStatus: 'passing',
        mergeStateStatus: 'CLEAN',
        updatedAt: '2026-05-06T08:58:00.000Z'
      })
    ];
    dashboardData.openPrsCount = dashboardData.pullRequests.filter(
      (pullRequest) => pullRequest.source === 'authored'
    ).length;
    dashboardData.recentOpenPrsCount = dashboardData.recentPullRequests.length;
    dashboardData.reviewRequestedCount = dashboardData.pullRequests.filter(
      (pullRequest) => pullRequest.source === 'review-requested'
    ).length;

    return {
      key: 'jira-auto-group',
      dashboardData,
      readyState: {},
      warningState: {},
      notificationSeenAtState: {},
      teamPrTrackerState: {
        snapshotKeys: [],
        pendingNewKeys: [],
        lastProcessedUpdatedAt: null,
      }
    };
  })(),
  'ready-to-merge': {
    key: 'ready-to-merge',
    dashboardData: cloneDashboardData(BASE_DASHBOARD_DATA),
    readyState: {
      [getStateKey('acme/platform-web', 1533)]: {
        isReady: false,
        highlighted: false,
        updatedAt: Date.now() - 10_000
      },
      [getStateKey('acme/chrome-home-page', 88)]: {
        isReady: false,
        highlighted: false,
        updatedAt: Date.now() - 10_000
      }
    },
    warningState: {},
    notificationSeenAtState: {},
    teamPrTrackerState: {
        snapshotKeys: [],
        pendingNewKeys: [],
        lastProcessedUpdatedAt: null,
      }
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
      readyState: {},
      warningState: {
        [getStateKey('acme/platform-web', 1533)]: {
          activeCaseKeys: ['has-conflicts'],
          highlighted: false,
          updatedAt: Date.now() - 10_000
        }
      },
      notificationSeenAtState: {},
      teamPrTrackerState: {
        snapshotKeys: [],
        pendingNewKeys: [],
        lastProcessedUpdatedAt: null,
      }
    };
  })(),
  'queued-prs': (() => {
    const dashboardData = cloneDashboardData(BASE_DASHBOARD_DATA);
    dashboardData.pullRequests = [
      createPullRequest({
        id: 301,
        title: 'EAP-48: Use provision endpoints and gate Create Group by permission',
        repositoryName: 'qsic-hq-admin/qsic-hq-admin',
        owner: 'qsic-hq-admin',
        repo: 'qsic-hq-admin',
        pullNumber: 412,
        reviewStatus: 'approved',
        ciStatus: 'passing',
        mergeStateStatus: 'CLEAN',
        mergeQueueEntry: {
          position: 1,
          state: 'QUEUED',
        },
        updatedAt: '2026-05-06T09:48:00.000Z'
      }),
      createPullRequest({
        id: 302,
        title: 'Refine access policy validation for venue sync',
        repositoryName: 'qsic-hq-admin/qsic-hq-admin',
        owner: 'qsic-hq-admin',
        repo: 'qsic-hq-admin',
        pullNumber: 413,
        reviewStatus: 'open',
        ciStatus: 'pending',
        mergeStateStatus: 'CLEAN',
        updatedAt: '2026-05-06T09:20:00.000Z'
      }),
    ];
    dashboardData.openPrsCount = dashboardData.pullRequests.filter(
      (pullRequest) => pullRequest.source === 'authored'
    ).length;
    dashboardData.reviewRequestedCount = dashboardData.pullRequests.filter(
      (pullRequest) => pullRequest.source === 'review-requested'
    ).length;

    return {
      key: 'queued-prs',
      dashboardData,
      readyState: {},
      warningState: {},
      notificationSeenAtState: {},
      teamPrTrackerState: {
        snapshotKeys: [],
        pendingNewKeys: [],
        lastProcessedUpdatedAt: null,
      }
    };
  })(),
  'comment-badges': (() => {
    const dashboardData = cloneDashboardData(BASE_DASHBOARD_DATA);
    dashboardData.pullRequests = dashboardData.pullRequests.map((pullRequest) => {
      if (pullRequest.pullNumber === 1533) {
        return {
          ...pullRequest,
          title: 'PR with new comments',
          totalCommentCount: 4,
          updatedAt: '2026-05-06T09:48:00.000Z'
        };
      }

      if (pullRequest.pullNumber === 1534) {
        return {
          ...pullRequest,
          title: 'PR with comments already seen',
          totalCommentCount: 2,
          updatedAt: '2026-05-06T09:25:00.000Z'
        };
      }

      if (pullRequest.pullNumber === 88) {
        return {
          ...pullRequest,
          title: 'PR with zero comments',
          totalCommentCount: 0
        };
      }

      return pullRequest;
    });
    dashboardData.notifications = [
      createNotification({
        id: 'comment-new-1',
        repositoryName: 'acme/platform-web',
        pullNumber: 1533,
        title: 'PR with new comments',
        updatedAt: '2026-05-06T09:47:00.000Z',
        authorLogin: 'reginald'
      }),
      createNotification({
        id: 'comment-new-2',
        repositoryName: 'acme/platform-web',
        pullNumber: 1533,
        title: 'PR with new comments',
        updatedAt: '2026-05-06T09:46:00.000Z',
        authorLogin: 'reginald'
      }),
      createNotification({
        id: 'comment-seen-1',
        repositoryName: 'acme/platform-web',
        pullNumber: 1534,
        title: 'PR with comments already seen',
        updatedAt: '2026-05-06T09:20:00.000Z',
        authorLogin: 'reginald'
      })
    ];
    dashboardData.notificationsCount = dashboardData.notifications.length;
    dashboardData.recentOpenPrsCount = dashboardData.recentPullRequests.length;

    return {
      key: 'comment-badges',
      dashboardData,
      readyState: {},
      warningState: {},
      notificationSeenAtState: {
        [getStateKey('acme/platform-web', 1534)]: Date.parse('2026-05-06T09:30:00.000Z')
      },
      teamPrTrackerState: {
        snapshotKeys: [],
        pendingNewKeys: [],
        lastProcessedUpdatedAt: null,
      }
    };
  })(),
  'team-prs-new': (() => {
    const dashboardData = cloneDashboardData(BASE_DASHBOARD_DATA);
    dashboardData.recentPullRequests = [
      createPullRequest({
        id: 401,
        title: 'Add product attributes to campaign data',
        repositoryName: 'qsic-data/qsic-data',
        owner: 'qsic-data',
        repo: 'qsic-data',
        pullNumber: 287,
        reviewStatus: 'open',
        ciStatus: 'pending',
        mergeStateStatus: 'DIRTY',
        source: 'recent',
        authorLogin: 'noah-antoun',
        updatedAt: '2026-05-06T09:52:00.000Z'
      }),
      createPullRequest({
        id: 402,
        title: 'Normalize campaign export date handling',
        repositoryName: 'qsic-data/qsic-data',
        owner: 'qsic-data',
        repo: 'qsic-data',
        pullNumber: 286,
        reviewStatus: 'open',
        ciStatus: 'passing',
        mergeStateStatus: 'CLEAN',
        source: 'recent',
        authorLogin: 'ava',
        updatedAt: '2026-05-06T09:18:00.000Z'
      }),
      createPullRequest({
        id: 403,
        title: 'Refactor warehouse feed adapter',
        repositoryName: 'qsic-data/ingestion',
        owner: 'qsic-data',
        repo: 'ingestion',
        pullNumber: 143,
        reviewStatus: 'open',
        ciStatus: 'no-checks',
        mergeStateStatus: 'CLEAN',
        source: 'recent',
        authorLogin: 'leo',
        updatedAt: '2026-05-06T08:56:00.000Z'
      })
    ];
    dashboardData.recentOpenPrsCount = dashboardData.recentPullRequests.length;

    const previousSnapshotKeys = [
      getStateKey('qsic-data/qsic-data', 286),
      getStateKey('qsic-data/ingestion', 143),
    ];
    const pendingNewKeys = [getStateKey('qsic-data/qsic-data', 287)];

    return {
      key: 'team-prs-new',
      dashboardData,
      readyState: {},
      warningState: {},
      notificationSeenAtState: {},
      teamPrTrackerState: {
        snapshotKeys: previousSnapshotKeys,
        pendingNewKeys,
        lastProcessedUpdatedAt: Date.now() - 60_000,
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
      readyState: {
        [getStateKey('acme/chrome-home-page', 89)]: {
          isReady: false,
          highlighted: false,
          updatedAt: Date.now() - 10_000
        }
      },
      warningState: {
        [getStateKey('acme/platform-web', 1533)]: {
          activeCaseKeys: [],
          highlighted: false,
          updatedAt: Date.now() - 10_000
        }
      },
      notificationSeenAtState: {},
      teamPrTrackerState: {
        snapshotKeys: [],
        pendingNewKeys: [],
        lastProcessedUpdatedAt: null,
      }
    };
  })()
};

export function getGitHubMockScenarioOptions() {
  return MOCK_SCENARIO_OPTIONS;
}

export function getGitHubMockScenarioByKey(mockKey: string | null | undefined) {
  if (!mockKey) {
    return null;
  }

  return MOCK_SCENARIOS[mockKey] ? cloneScenario(MOCK_SCENARIOS[mockKey]) : null;
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
    readyState: {},
    warningState: {
      [getStateKey('acme/platform-web', 1533)]: {
        activeCaseKeys: [],
        highlighted: false,
        updatedAt: Date.now() - 10_000
      }
    },
    notificationSeenAtState: {},
    teamPrTrackerState: {
        snapshotKeys: [],
        pendingNewKeys: [],
        lastProcessedUpdatedAt: null,
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
    headRefName: overrides.headRefName ?? '',
    repositoryId: overrides.repositoryId ?? overrides.id,
    repositoryName: overrides.repositoryName,
    repositoryUrl:
      overrides.repositoryUrl ??
      `https://github.com/${overrides.owner}/${overrides.repo}`,
    owner: overrides.owner,
    repo: overrides.repo,
    pullNumber: overrides.pullNumber,
    totalCommentCount: overrides.totalCommentCount ?? 0,
    authorLogin: overrides.authorLogin ?? 'xtian',
    isDraft: overrides.reviewStatus === 'draft',
    createdAt: overrides.createdAt ?? overrides.updatedAt,
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
    readyState: structuredClone(scenario.readyState),
    warningState: structuredClone(scenario.warningState),
    notificationSeenAtState: structuredClone(scenario.notificationSeenAtState),
    teamPrTrackerState: structuredClone(scenario.teamPrTrackerState)
  };
}

function cloneDashboardData(data: GitHubDashboardData): GitHubDashboardData {
  return {
    ...structuredClone(data),
    lastUpdatedAt: Date.now()
  };
}

function getStateKey(repositoryName: string, pullNumber: number) {
  return `${repositoryName}#${pullNumber}`;
}

function createNotification({
  id,
  repositoryName,
  pullNumber,
  title,
  updatedAt,
  authorLogin
}: {
  id: string;
  repositoryName: string;
  pullNumber: number;
  title: string;
  updatedAt: string;
  authorLogin?: string;
}): GitHubNotification {
  const [owner, repo] = repositoryName.split('/');

  return {
    id,
    unread: true,
    updated_at: updatedAt,
    reason: 'comment',
    authorLogin,
    repository: {
      full_name: repositoryName
    },
    subject: {
      title,
      type: 'PullRequest',
      url: `https://api.github.com/repos/${owner}/${repo}/pulls/${pullNumber}`,
      latest_comment_url: `https://api.github.com/repos/${owner}/${repo}/issues/comments/${pullNumber}`
    }
  };
}
