import type { FocusStatusTone } from './storage';
import type { JiraIssue, JiraLinkedIssue } from './jiraApi';

export function isJiraIssueInProgress(issue: JiraIssue) {
  const statusName = issue.status.name.toLowerCase();
  const statusCategoryName = issue.status.statusCategory?.name?.toLowerCase() ?? '';
  const statusCategoryKey = issue.status.statusCategory?.key?.toLowerCase() ?? '';

  return (
    statusName.includes('in progress') ||
    statusCategoryName === 'indeterminate' ||
    statusCategoryKey === 'indeterminate'
  );
}

export function isJiraIssueHighPriority(issue: JiraIssue) {
  const priorityName = issue.priority?.name?.toLowerCase() ?? '';
  return priorityName === 'highest' || priorityName === 'high';
}

export function getJiraIssueFocusTone(issue: JiraIssue): FocusStatusTone {
  const statusCategoryKey = issue.status.statusCategory?.key;
  const normalizedStatus = issue.status.name.toLowerCase();

  if (
    statusCategoryKey === 'done' ||
    normalizedStatus.includes('done') ||
    normalizedStatus.includes('closed')
  ) {
    return 'emerald';
  }

  if (
    statusCategoryKey === 'new' ||
    normalizedStatus.includes('to do') ||
    normalizedStatus.includes('todo')
  ) {
    return 'amber';
  }

  return 'violet';
}

export function getJiraRelatedIssueTooltip(issue: JiraLinkedIssue) {
  const parts = [
    issue.summary,
    issue.status,
    issue.assignee ? `Owner: ${issue.assignee}` : undefined,
  ].filter(Boolean);

  return parts.join(' • ');
}
