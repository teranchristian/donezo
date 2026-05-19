import type { GitHubPullRequestItem } from './githubApi';
import type { FocusStatusTone } from './storage';
import type {
  GitHubPrReadyState,
  GitHubPrWarningState,
} from './storage';

export function extractJiraKey(value: string) {
  const match = value.match(/\b([A-Z][A-Z0-9]+-\d+)\b/);
  return match ? match[1].toUpperCase() : null;
}

export function getPullRequestJiraKey(pullRequest: GitHubPullRequestItem) {
  return (
    extractJiraKey(pullRequest.title) ??
    extractJiraKey(pullRequest.headRefName)
  );
}

export function getGitHubFocusStatusLabel(
  reviewStatus: GitHubPullRequestItem['reviewStatus'],
) {
  if (reviewStatus === 'approved') {
    return 'Approved';
  }

  if (reviewStatus === 'changes-requested') {
    return 'Changes Requested';
  }

  if (reviewStatus === 'waiting-review') {
    return 'Waiting Review';
  }

  if (reviewStatus === 'draft') {
    return 'Draft';
  }

  return 'Open';
}

export function getGitHubFocusStatusTone(
  reviewStatus: GitHubPullRequestItem['reviewStatus'],
): FocusStatusTone {
  if (reviewStatus === 'approved') {
    return 'emerald';
  }

  if (reviewStatus === 'changes-requested') {
    return 'amber';
  }

  return 'violet';
}

export function isPullRequestQueued(pullRequest: GitHubPullRequestItem) {
  return Boolean(pullRequest.mergeQueueEntry);
}

export function isPullRequestOutOfDate(pullRequest: GitHubPullRequestItem) {
  return pullRequest.mergeStateStatus === 'BEHIND';
}

export function isPullRequestReadyToMerge(pullRequest: GitHubPullRequestItem) {
  return (
    !isPullRequestQueued(pullRequest) &&
    pullRequest.reviewStatus === 'approved' &&
    pullRequest.ciStatus === 'passing' &&
    !isPullRequestOutOfDate(pullRequest) &&
    pullRequest.mergeStateStatus === 'CLEAN'
  );
}

export function getGitHubPullRequestAttentionStateKey(
  pullRequest: GitHubPullRequestItem,
) {
  return `${pullRequest.repositoryName}#${pullRequest.pullNumber}`;
}

export function getGitHubPullRequestWarningStateKey(
  pullRequest: GitHubPullRequestItem,
) {
  return getGitHubPullRequestAttentionStateKey(pullRequest);
}

export function getActiveGitHubPrWarningCaseKeys(
  pullRequest: GitHubPullRequestItem,
) {
  return GITHUB_PR_WARNING_CASES.filter((warningCase) =>
    warningCase.predicate(pullRequest),
  ).map((warningCase) => warningCase.key);
}

export function buildGitHubPrWarningState(
  currentState: GitHubPrWarningState,
  pullRequests: GitHubPullRequestItem[],
) {
  const nextState: GitHubPrWarningState = {};
  const updatedAt = Date.now();

  for (const pullRequest of pullRequests) {
    const warningStateKey = getGitHubPullRequestWarningStateKey(pullRequest);
    const activeCaseKeys = getActiveGitHubPrWarningCaseKeys(pullRequest);
    const currentEntry = currentState[warningStateKey];
    const hasNewWarningTransition =
      Boolean(currentEntry) &&
      currentEntry.activeCaseKeys.length === 0 &&
      activeCaseKeys.length > 0;

    nextState[warningStateKey] = {
      activeCaseKeys,
      highlighted:
        activeCaseKeys.length > 0
          ? hasNewWarningTransition
            ? true
            : currentEntry?.highlighted ?? false
          : false,
      updatedAt,
    };
  }

  return nextState;
}

export function buildGitHubPrReadyState(
  currentState: GitHubPrReadyState,
  pullRequests: GitHubPullRequestItem[],
) {
  const nextState: GitHubPrReadyState = {};
  const updatedAt = Date.now();

  for (const pullRequest of pullRequests) {
    const readyStateKey = getGitHubPullRequestAttentionStateKey(pullRequest);
    const isReady = isPullRequestReadyToMerge(pullRequest);
    const currentEntry = currentState[readyStateKey];
    const hasNewReadyTransition =
      Boolean(currentEntry) && !currentEntry.isReady && isReady;

    nextState[readyStateKey] = {
      isReady,
      highlighted: isReady
        ? hasNewReadyTransition
          ? true
          : currentEntry?.highlighted ?? false
        : false,
      updatedAt,
    };
  }

  return nextState;
}

export function isGitHubPrWarningHighlighted(
  state: GitHubPrWarningState,
  pullRequest: GitHubPullRequestItem,
) {
  return Boolean(state[getGitHubPullRequestWarningStateKey(pullRequest)]?.highlighted);
}

export function isGitHubPrReadyHighlighted(
  state: GitHubPrReadyState,
  pullRequest: GitHubPullRequestItem,
) {
  return Boolean(state[getGitHubPullRequestAttentionStateKey(pullRequest)]?.highlighted);
}

export function getPullRequestDisplayStatus(pullRequest: GitHubPullRequestItem) {
  if (isPullRequestQueued(pullRequest)) {
    return { label: 'QUEUED' };
  }

  if (isPullRequestReadyToMerge(pullRequest)) {
    return { label: 'READY TO MERGE' };
  }

  if (pullRequest.reviewStatus === 'approved') {
    return { label: 'APPROVED' };
  }

  if (pullRequest.reviewStatus === 'waiting-review') {
    return { label: 'WAITING FOR REVIEW' };
  }

  if (pullRequest.reviewStatus === 'changes-requested') {
    return { label: 'CHANGES REQUESTED' };
  }

  if (pullRequest.reviewStatus === 'draft') {
    return { label: 'DRAFT' };
  }

  return {
    label: getCompactReviewStatusLabel(pullRequest.reviewStatus),
  };
}

const GITHUB_PR_WARNING_CASES = [
  {
    key: 'has-conflicts',
    predicate: (pullRequest: GitHubPullRequestItem) =>
      pullRequest.mergeStateStatus === 'DIRTY',
  },
  {
    key: 'failed-checks',
    predicate: (pullRequest: GitHubPullRequestItem) =>
      pullRequest.ciStatus === 'failing',
  },
  {
    key: 'out-of-date',
    predicate: (pullRequest: GitHubPullRequestItem) =>
      isPullRequestOutOfDate(pullRequest),
  },
] as const;

function getCompactReviewStatusLabel(
  reviewStatus: GitHubPullRequestItem['reviewStatus'],
) {
  if (reviewStatus === 'approved') {
    return 'APPROVED';
  }

  if (reviewStatus === 'changes-requested') {
    return 'CHANGES REQUESTED';
  }

  if (reviewStatus === 'draft') {
    return 'DRAFT';
  }

  if (reviewStatus === 'open') {
    return 'OPEN';
  }

  return 'WAITING FOR REVIEW';
}
