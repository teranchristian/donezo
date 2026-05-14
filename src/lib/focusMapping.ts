import type { GitHubPullRequestItem } from './githubApi';
import {
  extractJiraKey,
  getGitHubFocusStatusLabel,
  getGitHubFocusStatusTone,
} from './githubDomain';
import type { JiraIssue } from './jiraApi';
import { getJiraBrowseUrl } from './jiraApi';
import { getJiraIssueFocusTone } from './jiraDomain';
import type { FocusItem, FocusPullRequestItem } from './storage';

export function mapGitHubPullRequestToFocusItem(
  pullRequest: GitHubPullRequestItem,
): FocusPullRequestItem {
  return {
    id: `github:${pullRequest.repositoryName}#${pullRequest.pullNumber}`,
    source: 'github',
    sourceLabel: 'GitHub',
    reference: `#${pullRequest.pullNumber}`,
    url: pullRequest.url,
    title: pullRequest.title,
    statusLabel: getGitHubFocusStatusLabel(pullRequest.reviewStatus),
    statusTone: getGitHubFocusStatusTone(pullRequest.reviewStatus),
    jiraKey: extractJiraKey(pullRequest.title),
  };
}

export function mapJiraIssueToFocusItem(
  issue: JiraIssue,
  baseUrl: string,
): FocusItem {
  return {
    id: `jira:${issue.key}`,
    source: 'jira',
    sourceLabel: 'Jira',
    reference: issue.key,
    url: getJiraBrowseUrl(baseUrl, issue.key),
    title: issue.summary,
    statusLabel: issue.status.name,
    statusTone: getJiraIssueFocusTone(issue),
    jiraKey: issue.key,
    jiraStatusCategoryKey:
      issue.status.statusCategory?.key?.trim().toLowerCase() ?? undefined,
    children: [],
  };
}

export function getMatchingGitHubFocusPullRequests(
  pullRequests: GitHubPullRequestItem[],
  jiraKey: string,
) {
  return pullRequests
    .filter((pullRequest) => extractJiraKey(pullRequest.title) === jiraKey)
    .map((pullRequest) => mapGitHubPullRequestToFocusItem(pullRequest));
}
