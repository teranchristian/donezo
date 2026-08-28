import { describe, expect, it } from 'vitest';

import {
  buildDashboardHashNavigation,
  getDefaultDashboardNavigationState,
  parseDashboardHashNavigation,
} from './dashboardRouting';

describe('dashboardRouting', () => {
  it('returns a fresh default navigation state', () => {
    const first = getDefaultDashboardNavigationState();
    const second = getDefaultDashboardNavigationState();

    expect(first).toEqual({
      activeIntegration: 'github',
      activeGitHubView: 'my-prs',
      githubPrStatusFilter: 'all',
      activeJiraView: 'active',
    });
    expect(first).not.toBe(second);
  });

  it.each(['', '#', '#/settings', '#/unknown?view=active'])(
    'rejects unsupported hashes: %s',
    (hash) => {
      expect(parseDashboardHashNavigation(hash)).toBeNull();
    },
  );

  it('parses a GitHub view and status filter', () => {
    expect(
      parseDashboardHashNavigation('#/github?view=my-prs&status=ready-to-merge'),
    ).toEqual({
      activeIntegration: 'github',
      activeGitHubView: 'my-prs',
      githubPrStatusFilter: 'ready-to-merge',
      activeJiraView: 'active',
    });
  });

  it('uses safe GitHub defaults for invalid query values', () => {
    expect(
      parseDashboardHashNavigation('#/github?view=invalid&status=invalid'),
    ).toEqual(getDefaultDashboardNavigationState());
  });

  it('ignores the status filter outside the My PRs view', () => {
    expect(
      parseDashboardHashNavigation('#/github?view=review&status=approved'),
    ).toMatchObject({
      activeGitHubView: 'review',
      githubPrStatusFilter: 'all',
    });
  });

  it('parses Jira navigation and falls back to the active view', () => {
    expect(parseDashboardHashNavigation('#/jira?view=blocking')).toMatchObject({
      activeIntegration: 'jira',
      activeJiraView: 'blocking',
    });
    expect(parseDashboardHashNavigation('#/jira?view=invalid')).toMatchObject({
      activeIntegration: 'jira',
      activeJiraView: 'active',
    });
  });

  it('builds canonical GitHub and Jira hashes', () => {
    expect(
      buildDashboardHashNavigation({
        ...getDefaultDashboardNavigationState(),
        githubPrStatusFilter: 'waiting-review',
      }),
    ).toBe('#/github?view=my-prs&status=waiting-review');

    expect(
      buildDashboardHashNavigation({
        ...getDefaultDashboardNavigationState(),
        activeIntegration: 'jira',
        activeJiraView: 'high-priority',
      }),
    ).toBe('#/jira?view=high-priority');
  });
});
