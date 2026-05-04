import { JiraIssue, getJiraIssueFocusTone } from './jiraApi';
import { FocusItem, FocusJiraItem } from './storage';

export type TodayFocusRefreshSignal = {
  lastCompletedAt: number | null;
  lastManualAt: number | null;
};

export type TodayFocusJiraSyncResult = {
  items: FocusItem[];
  missingKeys: string[];
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

  if (
    item.title === nextTitle &&
    item.statusLabel === nextStatusLabel &&
    item.statusTone === nextStatusTone
  ) {
    return item;
  }

  return {
    ...item,
    title: nextTitle,
    statusLabel: nextStatusLabel,
    statusTone: nextStatusTone
  };
}
