import type { GitHubSummaryMetrics } from '../components/GitHubCard';
import type { GitHubConnectionStatus } from './githubApi';
import { getJiraIssueCounts } from './jiraApi';

export type DashboardAlertItem = {
  value: string;
  title: string;
  detail: string;
  tone: 'amber' | 'rose' | 'emerald' | 'blue';
  onClick?: () => void;
};

export function getDashboardAlerts(options: {
  gitHubMetrics: GitHubSummaryMetrics;
  jiraCounts: ReturnType<typeof getJiraIssueCounts>;
  isGitHubLoading: boolean;
  isJiraLoading: boolean;
  onOpenGitHubPrs: () => void;
  onOpenReviewRequestedPrs: () => void;
  onOpenBlockedIssues: () => void;
  onOpenApprovedPrs: () => void;
}): DashboardAlertItem[] {
  const {
    gitHubMetrics,
    jiraCounts,
    isGitHubLoading,
    isJiraLoading,
    onOpenGitHubPrs,
    onOpenReviewRequestedPrs,
    onOpenBlockedIssues,
    onOpenApprovedPrs,
  } = options;

  return [
    {
      value:
        isGitHubLoading || gitHubMetrics.connectionStatus !== 'connected'
          ? '0'
          : String(gitHubMetrics.reviewRequestedCount),
      title: 'PRs ready for review',
      detail: getReviewAlertDetail(
        gitHubMetrics.connectionStatus,
        gitHubMetrics.missingUsername,
        gitHubMetrics.reviewRequestedCount,
        isGitHubLoading,
      ),
      tone: 'amber',
      onClick:
        gitHubMetrics.connectionStatus === 'connected' && !isGitHubLoading
          ? onOpenReviewRequestedPrs
          : undefined,
    },
    {
      value: isJiraLoading ? '0' : String(jiraCounts.blocking),
      title: jiraCounts.blocking === 1 ? 'Blocked item' : 'Blocked tickets',
      detail: isJiraLoading ? 'Checking Jira blockers.' : 'Needs your input.',
      tone: 'rose',
      onClick: !isJiraLoading ? onOpenBlockedIssues : undefined,
    },
    {
      value:
        isGitHubLoading || gitHubMetrics.approvedPrCount === null
          ? '0'
          : String(gitHubMetrics.approvedPrCount),
      title: 'PRs approved',
      detail:
        gitHubMetrics.connectionStatus === 'connected'
          ? 'Ready to merge.'
          : 'Available once GitHub is connected.',
      tone: 'emerald',
      onClick:
        gitHubMetrics.connectionStatus === 'connected' &&
        gitHubMetrics.approvedPrCount !== null
          ? onOpenApprovedPrs
          : undefined,
    },
    {
      value:
        isGitHubLoading || gitHubMetrics.connectionStatus !== 'connected'
          ? '0'
          : String(gitHubMetrics.relevantPrCount),
      title: 'Open PRs',
      detail:
        gitHubMetrics.connectionStatus === 'connected'
          ? 'Across repositories.'
          : 'Available once GitHub is connected.',
      tone: 'blue',
      onClick:
        gitHubMetrics.connectionStatus === 'connected'
          ? onOpenGitHubPrs
          : undefined,
    },
  ];
}

export function formatDashboardTime(value: number | null) {
  if (!value) {
    return 'Never';
  }

  return new Date(value).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getReviewAlertDetail(
  connectionStatus: GitHubConnectionStatus,
  missingUsername: boolean,
  reviewRequestedCount: number,
  isGitHubLoading: boolean,
) {
  if (isGitHubLoading) {
    return 'Loading GitHub review activity.';
  }

  if (connectionStatus === 'invalid') {
    return 'GitHub token needs attention.';
  }

  if (connectionStatus === 'error') {
    return 'GitHub is temporarily unavailable.';
  }

  if (connectionStatus === 'not-connected') {
    return 'Connect GitHub to load review requests.';
  }

  if (missingUsername) {
    return 'Add your GitHub username in Settings.';
  }

  return reviewRequestedCount > 0
    ? 'Waiting on your review.'
    : 'No review requests waiting.';
}
