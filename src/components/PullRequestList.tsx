import { Fragment, type ReactNode } from 'react';
import type { GitHubPullRequestItem } from '../lib/githubApi';
import {
  getGitHubPullRequestAttentionStateKey,
  isGitHubPrReadyHighlighted,
  isGitHubPrWarningHighlighted,
  isPullRequestReadyToMerge,
} from '../lib/githubDomain';
import { mapPullRequestToFocusItem } from '../lib/githubCardDomain';
import type {
  ActiveGitHubView,
  GitHubHiddenRepository,
  GitHubPrReadyState,
  GitHubPrWarningState,
  GitHubTeamPrTrackerState,
} from '../lib/storage';
import type { TodayFocusPullRequestRanks } from '../lib/todayFocusPriority';

export type PullRequestListRowProps = {
  pullRequest: GitHubPullRequestItem;
  activeView: ActiveGitHubView;
  newNotificationCount: number;
  isNewTeamPr: boolean;
  todayFocusRank?: number;
  todayFocusTotalRanks: number;
  isReadyHighlighted: boolean;
  isWarningHighlighted: boolean;
  onMarkNotificationsSeen: (pullRequest: GitHubPullRequestItem) => void;
  onMarkTeamPrSeen: (pullRequest: GitHubPullRequestItem) => void;
  onClearWarningHighlight: (pullRequest: GitHubPullRequestItem) => void;
  onHideRepository: (repository: GitHubHiddenRepository) => Promise<void>;
};

type PullRequestListProps = {
  pullRequests: GitHubPullRequestItem[];
  todayFocusPullRequestRanks: TodayFocusPullRequestRanks;
  activeView: ActiveGitHubView;
  gitHubPrReadyState: GitHubPrReadyState;
  gitHubPrWarningState: GitHubPrWarningState;
  gitHubTeamPrTrackerState: GitHubTeamPrTrackerState;
  hasLoadedGitHubTeamPrTrackerState: boolean;
  pullRequestNewCommentCountByKey: Record<string, number>;
  onMarkNotificationsSeen: (pullRequest: GitHubPullRequestItem) => void;
  onMarkTeamPrSeen: (pullRequest: GitHubPullRequestItem) => void;
  onClearWarningHighlight: (pullRequest: GitHubPullRequestItem) => void;
  onHideRepository: (repository: GitHubHiddenRepository) => Promise<void>;
  renderPullRequest: (props: PullRequestListRowProps) => ReactNode;
};

export function PullRequestList({
  pullRequests,
  todayFocusPullRequestRanks,
  activeView,
  gitHubPrReadyState,
  gitHubPrWarningState,
  gitHubTeamPrTrackerState,
  hasLoadedGitHubTeamPrTrackerState,
  pullRequestNewCommentCountByKey,
  onMarkNotificationsSeen,
  onMarkTeamPrSeen,
  onClearWarningHighlight,
  onHideRepository,
  renderPullRequest,
}: PullRequestListProps) {
  const readyToClose = pullRequests.filter((pullRequest) =>
    isPullRequestReadyToMerge(pullRequest),
  );
  const remainingPullRequests = pullRequests.filter(
    (pullRequest) => !isPullRequestReadyToMerge(pullRequest),
  );
  const renderPullRequests = (items: GitHubPullRequestItem[]) =>
    items.map((pullRequest) => (
      <Fragment key={pullRequest.url}>
        {renderPullRequest(
          getPullRequestListRowProps({
            pullRequest,
            todayFocusPullRequestRanks,
            activeView,
            gitHubPrReadyState,
            gitHubPrWarningState,
            gitHubTeamPrTrackerState,
            hasLoadedGitHubTeamPrTrackerState,
            pullRequestNewCommentCountByKey,
            onMarkNotificationsSeen,
            onMarkTeamPrSeen,
            onClearWarningHighlight,
            onHideRepository,
          }),
        )}
      </Fragment>
    ));

  if (readyToClose.length === 0) {
    return (
      <div className="border-b border-white/[0.06] divide-y divide-white/[0.06]">
        {renderPullRequests(remainingPullRequests)}
      </div>
    );
  }

  return (
    <div className="border-b border-white/[0.06] divide-y divide-white/[0.06]">
      {renderPullRequests(readyToClose)}
      {remainingPullRequests.length > 0
        ? renderPullRequests(remainingPullRequests)
        : null}
    </div>
  );
}

function getPullRequestListRowProps(options: {
  pullRequest: GitHubPullRequestItem;
  todayFocusPullRequestRanks: TodayFocusPullRequestRanks;
  activeView: ActiveGitHubView;
  gitHubPrReadyState: GitHubPrReadyState;
  gitHubPrWarningState: GitHubPrWarningState;
  gitHubTeamPrTrackerState: GitHubTeamPrTrackerState;
  hasLoadedGitHubTeamPrTrackerState: boolean;
  pullRequestNewCommentCountByKey: Record<string, number>;
  onMarkNotificationsSeen: (pullRequest: GitHubPullRequestItem) => void;
  onMarkTeamPrSeen: (pullRequest: GitHubPullRequestItem) => void;
  onClearWarningHighlight: (pullRequest: GitHubPullRequestItem) => void;
  onHideRepository: (repository: GitHubHiddenRepository) => Promise<void>;
}): PullRequestListRowProps {
  const {
    pullRequest,
    todayFocusPullRequestRanks,
    activeView,
    gitHubPrReadyState,
    gitHubPrWarningState,
    gitHubTeamPrTrackerState,
    hasLoadedGitHubTeamPrTrackerState,
    pullRequestNewCommentCountByKey,
    onMarkNotificationsSeen,
    onMarkTeamPrSeen,
    onClearWarningHighlight,
    onHideRepository,
  } = options;

  return {
    pullRequest,
    activeView,
    newNotificationCount:
      pullRequestNewCommentCountByKey[
        getGitHubPullRequestAttentionStateKey(pullRequest)
      ] ?? 0,
    isNewTeamPr:
      activeView === 'team-prs' &&
      hasLoadedGitHubTeamPrTrackerState &&
      gitHubTeamPrTrackerState.pendingNewKeys.includes(
        getGitHubPullRequestAttentionStateKey(pullRequest),
      ),
    todayFocusRank: todayFocusPullRequestRanks.ranks.get(
      mapPullRequestToFocusItem(pullRequest).id,
    ),
    todayFocusTotalRanks: todayFocusPullRequestRanks.totalRanks,
    isReadyHighlighted: isGitHubPrReadyHighlighted(
      gitHubPrReadyState,
      pullRequest,
    ),
    isWarningHighlighted: isGitHubPrWarningHighlighted(
      gitHubPrWarningState,
      pullRequest,
    ),
    onMarkNotificationsSeen,
    onMarkTeamPrSeen,
    onClearWarningHighlight,
    onHideRepository,
  };
}
