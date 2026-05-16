import { useEffect, useState } from 'react';
import {
  buildDashboardHashNavigation,
  parseDashboardHashNavigation,
} from '../lib/dashboardRouting';
import {
  getStoredActiveGitHubView,
  getStoredActiveIntegration,
  getStoredActiveJiraView,
  getStoredGitHubPrStatusFilter,
  saveStoredActiveGitHubView,
  saveStoredActiveIntegration,
  saveStoredActiveJiraView,
  saveStoredGitHubPrStatusFilter,
  type ActiveGitHubView,
  type ActiveIntegration,
  type ActiveJiraView,
  type GitHubPrStatusFilter,
} from '../lib/storage';

type DashboardNavigationState = {
  activeIntegration: ActiveIntegration;
  activeGitHubView: ActiveGitHubView;
  githubPrStatusFilter: GitHubPrStatusFilter;
  activeJiraView: ActiveJiraView;
};

type UseDashboardNavigationOptions = {
  syncKey: string | null;
};

export function useDashboardNavigation({
  syncKey,
}: UseDashboardNavigationOptions) {
  const [activeIntegration, setActiveIntegration] =
    useState<ActiveIntegration>('github');
  const [activeGitHubView, setActiveGitHubView] =
    useState<ActiveGitHubView>('my-prs');
  const [githubPrStatusFilter, setGitHubPrStatusFilter] =
    useState<GitHubPrStatusFilter>('all');
  const [activeJiraView, setActiveJiraView] =
    useState<ActiveJiraView>('active');
  const [hasLoadedNavigation, setHasLoadedNavigation] = useState(false);

  useEffect(() => {
    let isActive = true;

    const applyNavigationState = (nextState: DashboardNavigationState) => {
      if (!isActive) {
        return;
      }

      setActiveIntegration(nextState.activeIntegration);
      setActiveGitHubView(nextState.activeGitHubView);
      setGitHubPrStatusFilter(nextState.githubPrStatusFilter);
      setActiveJiraView(nextState.activeJiraView);
      setHasLoadedNavigation(true);
    };

    const syncFromHashOrStorage = async (options?: { replaceUrl?: boolean }) => {
      const hashState = parseDashboardHashNavigation(window.location.hash);
      if (hashState) {
        applyNavigationState(hashState);
        return;
      }

      const [
        storedActiveIntegration,
        storedActiveGitHubView,
        storedGitHubPrStatusFilter,
        storedActiveJiraView,
      ] = await Promise.all([
        getStoredActiveIntegration(),
        getStoredActiveGitHubView(),
        getStoredGitHubPrStatusFilter(),
        getStoredActiveJiraView(),
      ]);

      if (!isActive) {
        return;
      }

      const nextState = {
        activeIntegration: storedActiveIntegration,
        activeGitHubView: storedActiveGitHubView,
        githubPrStatusFilter: storedGitHubPrStatusFilter,
        activeJiraView: storedActiveJiraView,
      };

      applyNavigationState(nextState);

      if (options?.replaceUrl) {
        replaceDashboardHash(nextState);
      }
    };

    void syncFromHashOrStorage({ replaceUrl: true });

    const handleHashChange = () => {
      void syncFromHashOrStorage({ replaceUrl: true });
    };

    window.addEventListener('hashchange', handleHashChange);

    return () => {
      isActive = false;
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, [syncKey]);

  useEffect(() => {
    if (!hasLoadedNavigation) {
      return;
    }

    void Promise.all([
      saveStoredActiveIntegration(activeIntegration),
      saveStoredActiveGitHubView(activeGitHubView),
      saveStoredGitHubPrStatusFilter(githubPrStatusFilter),
      saveStoredActiveJiraView(activeJiraView),
    ]);
  }, [
    activeGitHubView,
    activeIntegration,
    activeJiraView,
    githubPrStatusFilter,
    hasLoadedNavigation,
  ]);

  function updateDashboardNavigation(nextState: DashboardNavigationState) {
    setActiveIntegration(nextState.activeIntegration);
    setActiveGitHubView(nextState.activeGitHubView);
    setGitHubPrStatusFilter(nextState.githubPrStatusFilter);
    setActiveJiraView(nextState.activeJiraView);
    setHasLoadedNavigation(true);
    window.location.hash = buildDashboardHashNavigation(nextState);
  }

  function navigateToGitHubPrs(prStatusFilter: GitHubPrStatusFilter) {
    updateDashboardNavigation({
      activeIntegration: 'github',
      activeGitHubView: 'my-prs',
      githubPrStatusFilter: prStatusFilter,
      activeJiraView,
    });
  }

  function navigateToJiraView(view: ActiveJiraView) {
    updateDashboardNavigation({
      activeIntegration: 'jira',
      activeGitHubView,
      githubPrStatusFilter,
      activeJiraView: view,
    });
  }

  function handleIntegrationChange(nextIntegration: ActiveIntegration) {
    updateDashboardNavigation({
      activeIntegration: nextIntegration,
      activeGitHubView,
      githubPrStatusFilter,
      activeJiraView,
    });
  }

  function handleGitHubViewChange(view: ActiveGitHubView) {
    updateDashboardNavigation({
      activeIntegration: 'github',
      activeGitHubView: view,
      githubPrStatusFilter,
      activeJiraView,
    });
  }

  function handleGitHubPrStatusFilterChange(
    prStatusFilter: GitHubPrStatusFilter,
  ) {
    updateDashboardNavigation({
      activeIntegration: 'github',
      activeGitHubView: 'my-prs',
      githubPrStatusFilter: prStatusFilter,
      activeJiraView,
    });
  }

  function handleJiraViewChange(view: ActiveJiraView) {
    updateDashboardNavigation({
      activeIntegration: 'jira',
      activeGitHubView,
      githubPrStatusFilter,
      activeJiraView: view,
    });
  }

  return {
    activeIntegration,
    activeGitHubView,
    githubPrStatusFilter,
    activeJiraView,
    navigateToGitHubPrs,
    navigateToJiraView,
    handleIntegrationChange,
    handleGitHubViewChange,
    handleGitHubPrStatusFilterChange,
    handleJiraViewChange,
  };
}

function replaceDashboardHash(nextState: DashboardNavigationState) {
  const nextHash = buildDashboardHashNavigation(nextState);
  if (window.location.hash === nextHash) {
    return;
  }

  window.history.replaceState(
    null,
    '',
    `${window.location.pathname}${window.location.search}${nextHash}`,
  );
}
