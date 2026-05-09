import { ReactNode, useEffect, useRef, useState } from 'react';
import { DashboardHeader } from '../components/DashboardHeader';
import { GitHubCard, type GitHubSummaryMetrics } from '../components/GitHubCard';
import { HeaderMenu } from '../components/HeaderMenu';
import { JiraCard } from '../components/JiraCard';
import { NotesCard } from '../components/NotesCard';
import { PlaceholderCard } from '../components/PlaceholderCard';
import { SummaryCard, TODAY_FOCUS_MAX_ITEMS } from '../components/SummaryCard';
import { GitHubConnectionStatus, GitHubDashboardData, GitHubPullRequestItem } from '../lib/githubApi';
import {
  getJiraIssueCounts,
  JiraConnectionStatus,
  JiraDashboardData,
  loadJiraIssuesByKeys
} from '../lib/jiraApi';
import {
  buildDashboardHashNavigation,
  parseDashboardHashNavigation
} from '../lib/dashboardRouting';
import {
  DashboardSettings,
  FocusItem,
  FocusPullRequestItem,
  getStoredActiveGitHubView,
  getStoredActiveIntegration,
  getStoredActiveJiraView,
  getStoredGitHubPrStatusFilter,
  getStoredTodayFocusItems,
  saveStoredActiveIntegration,
  saveStoredActiveGitHubView,
  saveStoredActiveJiraView,
  saveStoredGitHubPrStatusFilter,
  saveStoredTodayFocusItems,
  type ActiveGitHubView,
  type ActiveIntegration,
  type ActiveJiraView,
  type GitHubPrStatusFilter
} from '../lib/storage';
import type { GitHubMockScenarioOption } from '../mocks/github/scenarios';
import {
  reconcileTodayFocusJiraItems,
  type TodayFocusRefreshSignal
} from '../lib/todayFocusSync';

type DashboardPageProps = {
  settings: DashboardSettings;
  gitHubData: GitHubDashboardData;
  gitHubMockScenarioKey: string | null;
  isGitHubMockMode: boolean;
  gitHubMockScenarioOptions: GitHubMockScenarioOption[];
  isGitHubLoading: boolean;
  isCheckingGitHubActivity: boolean;
  lastGitHubActivityCheckAt: number | null;
  onClearGitHubMockScenario: () => void;
  onApplyGitHubMockScenario: (mockScenarioKey: string) => void;
  onRefreshGitHub: () => void;
  jiraData: JiraDashboardData;
  jiraRefreshSignal: TodayFocusRefreshSignal;
  isJiraLoading: boolean;
  onRefreshJira: () => void;
  onGitHubSummaryMetricsChange: (metrics: GitHubSummaryMetrics) => void;
};

export function DashboardPage({
  settings,
  gitHubData,
  gitHubMockScenarioKey,
  isGitHubMockMode,
  gitHubMockScenarioOptions,
  isGitHubLoading,
  isCheckingGitHubActivity,
  lastGitHubActivityCheckAt,
  onClearGitHubMockScenario,
  onApplyGitHubMockScenario,
  onRefreshGitHub,
  jiraData,
  jiraRefreshSignal,
  isJiraLoading,
  onRefreshJira,
  onGitHubSummaryMetricsChange
}: DashboardPageProps) {
  const [activeIntegration, setActiveIntegration] = useState<ActiveIntegration>('github');
  const [activeGitHubView, setActiveGitHubView] = useState<ActiveGitHubView>('prs');
  const [githubPrStatusFilter, setGitHubPrStatusFilter] = useState<GitHubPrStatusFilter>('all');
  const [activeJiraView, setActiveJiraView] = useState<ActiveJiraView>('active');
  const [hasLoadedNavigation, setHasLoadedNavigation] = useState(false);
  const [todayFocusItems, setTodayFocusItems] = useState<FocusItem[]>([]);
  const [hasLoadedTodayFocusItems, setHasLoadedTodayFocusItems] = useState(false);
  const [todayFocusWarning, setTodayFocusWarning] = useState<string | null>(null);
  const hasLoadedTodayFocusItemsRef = useRef(false);
  const hasRunInitialFocusedJiraFallbackRef = useRef(false);
  const isFocusedJiraFallbackInFlightRef = useRef(false);
  const lastFocusedJiraFallbackAtRef = useRef<number | null>(null);
  const todayFocusItemsRef = useRef<FocusItem[]>([]);
  const [gitHubSummaryMetrics, setGitHubSummaryMetrics] = useState<GitHubSummaryMetrics>({
    connectionStatus: gitHubData.connectionStatus,
    missingUsername: gitHubData.missingUsername,
    readyToMergeCount: 0,
    failedBuildCount: 0,
    failedBuildBadgeCount: 0,
    highlightedReadyCount: 0,
    highlightedWarningCount: 0,
    reviewRequestedCount: 0,
    approvedPrCount: null,
    relevantPrCount: gitHubData.openPrsCount
  });
  const todayFocusItemIds = collectTodayFocusItemIds(todayFocusItems);

  useEffect(() => {
    todayFocusItemsRef.current = todayFocusItems;
  }, [todayFocusItems]);

  useEffect(() => {
    let isActive = true;

    const applyNavigationState = (nextState: {
      activeIntegration: ActiveIntegration;
      activeGitHubView: ActiveGitHubView;
      githubPrStatusFilter: GitHubPrStatusFilter;
      activeJiraView: ActiveJiraView;
    }) => {
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
        storedActiveJiraView
      ] = await Promise.all([
        getStoredActiveIntegration(),
        getStoredActiveGitHubView(),
        getStoredGitHubPrStatusFilter(),
        getStoredActiveJiraView()
      ]);

      if (!isActive) {
        return;
      }

      const nextState = {
        activeIntegration: storedActiveIntegration,
        activeGitHubView: storedActiveGitHubView,
        githubPrStatusFilter: storedGitHubPrStatusFilter,
        activeJiraView: storedActiveJiraView
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
  }, [gitHubMockScenarioKey]);

  useEffect(() => {
    if (!hasLoadedNavigation) {
      return;
    }

    void Promise.all([
      saveStoredActiveIntegration(activeIntegration),
      saveStoredActiveGitHubView(activeGitHubView),
      saveStoredGitHubPrStatusFilter(githubPrStatusFilter),
      saveStoredActiveJiraView(activeJiraView)
    ]);
  }, [
    activeGitHubView,
    activeIntegration,
    activeJiraView,
    githubPrStatusFilter,
    hasLoadedNavigation
  ]);

  useEffect(() => {
    let isMounted = true;

    getStoredTodayFocusItems().then((storedItems) => {
      if (!isMounted) {
        return;
      }

      const nextItems = storedItems ?? getDefaultTodayFocusItems();
      todayFocusItemsRef.current = nextItems;
      setTodayFocusItems(nextItems);
      hasLoadedTodayFocusItemsRef.current = true;
      setHasLoadedTodayFocusItems(true);
      if (storedItems === null) {
        void saveStoredTodayFocusItems(nextItems);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    setGitHubSummaryMetrics((current) => ({
      ...current,
      connectionStatus: gitHubData.connectionStatus,
      missingUsername: gitHubData.missingUsername
    }));
  }, [gitHubData.connectionStatus, gitHubData.missingUsername]);

  useEffect(() => {
    onGitHubSummaryMetricsChange(gitHubSummaryMetrics);
  }, [gitHubSummaryMetrics, onGitHubSummaryMetricsChange]);

  useEffect(() => {
    if (!hasLoadedTodayFocusItemsRef.current) {
      return;
    }

    const syncResult = reconcileTodayFocusJiraItems(todayFocusItemsRef.current, jiraData.issues);
    if (syncResult.items === todayFocusItemsRef.current) {
      return;
    }

    commitTodayFocusItems(syncResult.items);
  }, [hasLoadedTodayFocusItems, jiraData.issues]);

  useEffect(() => {
    if (!hasLoadedTodayFocusItemsRef.current || jiraRefreshSignal.lastCompletedAt === null) {
      return;
    }

    if (!hasRunInitialFocusedJiraFallbackRef.current) {
      hasRunInitialFocusedJiraFallbackRef.current = true;
      void runFocusedJiraFallback();
      return;
    }

    if (
      lastFocusedJiraFallbackAtRef.current !== null &&
      jiraRefreshSignal.lastCompletedAt - lastFocusedJiraFallbackAtRef.current < 5 * 60 * 1000
    ) {
      return;
    }

    void runFocusedJiraFallback();
  }, [
    hasLoadedTodayFocusItems,
    jiraRefreshSignal.lastCompletedAt,
    jiraData.issues,
    settings.integrations.jira.apiToken,
    settings.integrations.jira.baseUrl,
    settings.integrations.jira.email
  ]);

  useEffect(() => {
    if (!hasLoadedTodayFocusItemsRef.current || jiraRefreshSignal.lastManualAt === null) {
      return;
    }

    void runFocusedJiraFallback();
  }, [
    hasLoadedTodayFocusItems,
    jiraRefreshSignal.lastManualAt,
    settings.integrations.jira.apiToken,
    settings.integrations.jira.baseUrl,
    settings.integrations.jira.email
  ]);

  const jiraCounts = getJiraIssueCounts(jiraData.issues);
  const dashboardAlerts = getDashboardAlerts({
    gitHubMetrics: gitHubSummaryMetrics,
    jiraCounts,
    isGitHubLoading,
    isJiraLoading,
    onOpenGitHubPrs: () => {
      navigateToGitHubPrs('all');
    },
    onOpenReviewRequestedPrs: () => {
      handleGitHubViewChange('review');
    },
    onOpenBlockedIssues: () => {
      navigateToJiraView('blocking');
    },
    onOpenApprovedPrs: () => {
      navigateToGitHubPrs('approved');
    }
  });

  function updateDashboardNavigation(nextState: {
    activeIntegration: ActiveIntegration;
    activeGitHubView: ActiveGitHubView;
    githubPrStatusFilter: GitHubPrStatusFilter;
    activeJiraView: ActiveJiraView;
  }) {
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
      activeGitHubView: 'prs',
      githubPrStatusFilter: prStatusFilter,
      activeJiraView
    });
  }

  function navigateToJiraView(view: ActiveJiraView) {
    updateDashboardNavigation({
      activeIntegration: 'jira',
      activeGitHubView,
      githubPrStatusFilter,
      activeJiraView: view
    });
  }

  function handleIntegrationChange(nextIntegration: ActiveIntegration) {
    updateDashboardNavigation({
      activeIntegration: nextIntegration,
      activeGitHubView,
      githubPrStatusFilter,
      activeJiraView
    });
  }

  function handleGitHubViewChange(view: ActiveGitHubView) {
    updateDashboardNavigation({
      activeIntegration: 'github',
      activeGitHubView: view,
      githubPrStatusFilter,
      activeJiraView
    });
  }

  function handleGitHubPrStatusFilterChange(prStatusFilter: GitHubPrStatusFilter) {
    updateDashboardNavigation({
      activeIntegration: 'github',
      activeGitHubView: 'prs',
      githubPrStatusFilter: prStatusFilter,
      activeJiraView
    });
  }

  function handleJiraViewChange(view: ActiveJiraView) {
    updateDashboardNavigation({
      activeIntegration: 'jira',
      activeGitHubView,
      githubPrStatusFilter,
      activeJiraView: view
    });
  }

  function handleAddTodayFocusItem(item: FocusItem) {
    setTodayFocusWarning(null);

    const addResult = addTodayFocusItem(todayFocusItems, item);
    if (addResult.warning) {
      setTodayFocusWarning(addResult.warning);
      return;
    }

    commitTodayFocusItems(addResult.items);
  }

  function handleRemoveTodayFocusItem(itemId: string) {
    setTodayFocusWarning(null);
    const nextItems = removeTodayFocusItem(todayFocusItems, itemId);
    commitTodayFocusItems(nextItems);
  }

  function handleNestNewTodayFocusPullRequest(parentId: string, item: FocusPullRequestItem) {
    setTodayFocusWarning(null);

    const nextState = nestNewPullRequestUnderJira(todayFocusItems, parentId, item);
    if (nextState.warning) {
      setTodayFocusWarning(nextState.warning);
      return;
    }

    commitTodayFocusItems(nextState.items);
  }

  function handleNestExistingTodayFocusPullRequest(parentId: string, itemId: string) {
    setTodayFocusWarning(null);
    const nextItems = moveStandalonePullRequestUnderJira(todayFocusItems, parentId, itemId);
    commitTodayFocusItems(nextItems);
  }

  function handleReorderTopLevelTodayFocusItem(itemId: string, targetId: string) {
    setTodayFocusWarning(null);
    const nextItems = reorderTopLevelTodayFocusItems(todayFocusItems, itemId, targetId);
    commitTodayFocusItems(nextItems);
  }

  function handleMoveTopLevelTodayFocusItemToEnd(itemId: string) {
    setTodayFocusWarning(null);
    const nextItems = moveTopLevelTodayFocusItemToEnd(todayFocusItems, itemId);
    commitTodayFocusItems(nextItems);
  }

  function handleReorderNestedTodayFocusPullRequest(parentId: string, itemId: string, targetId: string) {
    setTodayFocusWarning(null);
    const nextItems = reorderNestedPullRequests(todayFocusItems, parentId, itemId, targetId);
    commitTodayFocusItems(nextItems);
  }

  function commitTodayFocusItems(nextItems: FocusItem[]) {
    todayFocusItemsRef.current = nextItems;
    setTodayFocusItems(nextItems);
    void saveStoredTodayFocusItems(nextItems);
  }

  async function runFocusedJiraFallback() {
    const { baseUrl, email, apiToken } = settings.integrations.jira;
    if (!baseUrl.trim() || !email.trim() || !apiToken.trim() || isFocusedJiraFallbackInFlightRef.current) {
      return;
    }

    const syncResult = reconcileTodayFocusJiraItems(todayFocusItemsRef.current, jiraData.issues);
    if (syncResult.missingKeys.length === 0) {
      return;
    }

    isFocusedJiraFallbackInFlightRef.current = true;
    lastFocusedJiraFallbackAtRef.current = Date.now();

    try {
      const fallbackIssues = await loadJiraIssuesByKeys({
        baseUrl,
        email,
        apiToken,
        issueKeys: syncResult.missingKeys
      });

      if (fallbackIssues.length === 0) {
        return;
      }

      const fallbackSyncResult = reconcileTodayFocusJiraItems(todayFocusItemsRef.current, fallbackIssues);
      if (fallbackSyncResult.items !== todayFocusItemsRef.current) {
        commitTodayFocusItems(fallbackSyncResult.items);
      }
    } finally {
      isFocusedJiraFallbackInFlightRef.current = false;
    }
  }

  const integrationSwitcher = (
    <div className="inline-flex flex-wrap items-center gap-1 rounded-full border border-white/[0.035] bg-white/[0.025] p-1">
      <IntegrationTabButton
        label="GitHub"
        isActive={activeIntegration === 'github'}
        onClick={() => handleIntegrationChange('github')}
      />
      <IntegrationTabButton
        label="Jira"
        isActive={activeIntegration === 'jira'}
        onClick={() => handleIntegrationChange('jira')}
      />
    </div>
  );
  const integrationStatusBar =
    activeIntegration === 'github' ? (
      <GitHubIntegrationStatusBar
        connectionStatus={gitHubData.connectionStatus}
        isLoading={isGitHubLoading}
        isCheckingActivity={isCheckingGitHubActivity}
        lastUpdatedAt={gitHubData.lastUpdatedAt}
        lastCheckedAt={lastGitHubActivityCheckAt}
        onRefresh={onRefreshGitHub}
      />
    ) : (
      <JiraIntegrationStatusBar
        connectionStatus={jiraData.connectionStatus}
        isLoading={isJiraLoading}
        lastUpdatedAt={jiraData.lastUpdatedAt}
        onRefresh={onRefreshJira}
      />
    );
  const [primaryAlert, ...secondaryAlerts] = dashboardAlerts;

  return (
    <main className="min-h-screen py-6 text-stone-100 sm:py-7">
      <div className="dashboard-container flex flex-col gap-5">
        <div className="dashboard-header-row">
          <DashboardHeader name={settings.name} />
          <div className="dashboard-header-status gap-3">
            {integrationStatusBar}
            {activeIntegration === 'github' ? (
              <GitHubHeaderShortcuts
                connectionStatus={gitHubSummaryMetrics.connectionStatus}
                warningCount={gitHubSummaryMetrics.highlightedWarningCount}
                readyToMergeCount={gitHubSummaryMetrics.readyToMergeCount}
                readyToMergeBadgeCount={gitHubSummaryMetrics.highlightedReadyCount}
                failedBuildCount={gitHubSummaryMetrics.failedBuildCount}
                failedBuildBadgeCount={gitHubSummaryMetrics.failedBuildBadgeCount}
                jiraBlockingCount={jiraCounts.blocking}
                onOpenWarnings={() => navigateToGitHubPrs('all')}
                onOpenReadyToMerge={() => navigateToGitHubPrs('ready-to-merge')}
                onOpenJira={() => navigateToJiraView('blocking')}
              />
            ) : null}
            <HeaderMenu
              isMockMode={isGitHubMockMode}
              mockScenarioKey={gitHubMockScenarioKey}
              mockScenarioOptions={gitHubMockScenarioOptions}
              onApplyMockScenario={onApplyGitHubMockScenario}
              onClearMockScenario={onClearGitHubMockScenario}
            />
          </div>
        </div>

        <section className="main-content flex flex-col gap-3">
          <div className="summary-cards-grid">
            {primaryAlert ? <DashboardAlert alert={primaryAlert} /> : null}
            {secondaryAlerts.map((alert) => (
              <DashboardAlert key={alert.title} alert={alert} />
            ))}
          </div>

          <div className="dashboard-main-grid">
            <section className="dashboard-side-column">
              <SummaryCard
                items={todayFocusItems}
                warning={todayFocusWarning}
                onAddItem={handleAddTodayFocusItem}
                onNestNewPullRequest={handleNestNewTodayFocusPullRequest}
                onNestExistingPullRequest={handleNestExistingTodayFocusPullRequest}
                onRemoveItem={handleRemoveTodayFocusItem}
                onReorderTopLevelItem={handleReorderTopLevelTodayFocusItem}
                onMoveTopLevelItemToEnd={handleMoveTopLevelTodayFocusItemToEnd}
                onReorderNestedPullRequest={handleReorderNestedTodayFocusPullRequest}
              />
              <NotesCard />
              <PlaceholderCard
                title="Calendar"
                subtitle="Placeholder"
                description="Upcoming meetings and focus blocks will fit here once calendar integration is added."
                className="min-h-[220px]"
              />
              <PlaceholderCard
                title="Workspace"
                subtitle="Later"
                description="This area can hold quick links, streaks, or a small pomodoro widget when you want to expand the dashboard."
                className="min-h-[220px]"
              />
            </section>

            <section className="dashboard-panel-column">
              <div className="relative flex min-h-0">
                <div
                  className={`min-h-0 flex-1 ${activeIntegration === 'github' ? 'flex' : 'hidden'}`}
                  aria-hidden={activeIntegration !== 'github'}
                >
                  <GitHubCard
                    topBar={activeIntegration === 'github' ? integrationSwitcher : undefined}
                    data={gitHubData}
                    todayFocusItemIds={todayFocusItemIds}
                    username={settings.integrations.github.username}
                    token={settings.integrations.github.token}
                    ownerFilter={settings.integrations.github.ownerFilter}
                    isMockMode={isGitHubMockMode}
                    isLoading={isGitHubLoading}
                    isCheckingActivity={isCheckingGitHubActivity}
                    lastActivityCheckAt={lastGitHubActivityCheckAt}
                    onRefresh={onRefreshGitHub}
                    onSummaryMetricsChange={setGitHubSummaryMetrics}
                    activeView={activeGitHubView}
                    prStatusFilter={githubPrStatusFilter}
                    onViewChange={handleGitHubViewChange}
                    onPrStatusFilterChange={handleGitHubPrStatusFilterChange}
                  />
                </div>
                <div
                  className={`min-h-0 flex-1 ${activeIntegration === 'jira' ? 'flex' : 'hidden'}`}
                  aria-hidden={activeIntegration !== 'jira'}
                >
                  <JiraCard
                    topBar={activeIntegration === 'jira' ? integrationSwitcher : undefined}
                    baseUrl={settings.integrations.jira.baseUrl}
                    data={jiraData}
                    todayFocusItemIds={todayFocusItemIds}
                    isLoading={isJiraLoading}
                    onRefresh={onRefreshJira}
                    activeView={activeJiraView}
                    onViewChange={handleJiraViewChange}
                  />
                </div>
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}

function collectTodayFocusItemIds(items: FocusItem[]) {
  const itemIds = new Set<string>();

  for (const item of items) {
    itemIds.add(item.id);

    if (item.source === 'jira') {
      for (const child of item.children) {
        itemIds.add(child.id);
      }
    }
  }

  return itemIds;
}

function replaceDashboardHash(nextState: {
  activeIntegration: ActiveIntegration;
  activeGitHubView: ActiveGitHubView;
  githubPrStatusFilter: GitHubPrStatusFilter;
  activeJiraView: ActiveJiraView;
}) {
  const nextHash = buildDashboardHashNavigation(nextState);
  if (window.location.hash === nextHash) {
    return;
  }

  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${nextHash}`);
}

function getDefaultTodayFocusItems(): FocusItem[] {
  return [
    {
      id: 'jira:CLK-112',
      source: 'jira',
      sourceLabel: 'Jira',
      reference: 'CLK-112',
      jiraKey: 'CLK-112',
      title: 'Fix lead status bug in dashboard',
      statusLabel: 'In Progress',
      statusTone: 'violet',
      children: [
        {
          id: 'github:dashboard#142',
          source: 'github',
          sourceLabel: 'GitHub',
          reference: '#142',
          title: 'CLK-112 Fix venue provision defaults',
          statusLabel: 'Approved',
          statusTone: 'emerald',
          jiraKey: 'CLK-112'
        }
      ]
    }
  ];
}

type DashboardAlertItem = {
  value: string;
  title: string;
  detail: string;
  tone: 'amber' | 'rose' | 'emerald' | 'blue';
  onClick?: () => void;
};

function addTodayFocusItem(items: FocusItem[], item: FocusItem) {
  if (hasTodayFocusItem(items, item.id)) {
    return { items, warning: 'That item is already in Today focus.' };
  }

  if (items.length >= TODAY_FOCUS_MAX_ITEMS) {
    return { items, warning: 'Today focus already has 3 items.' };
  }

  return {
    items: [...items, normalizeTopLevelTodayFocusItem(item)],
    warning: null
  };
}

function removeTodayFocusItem(items: FocusItem[], itemId: string) {
  const nextItems: FocusItem[] = [];

  for (const item of items) {
    if (item.id === itemId) {
      continue;
    }

    if (item.source === 'jira') {
      const nextChildren = item.children.filter((child) => child.id !== itemId);
      nextItems.push(
        nextChildren.length === item.children.length
          ? item
          : {
              ...item,
              children: nextChildren
            }
      );
      continue;
    }

    nextItems.push(item);
  }

  return nextItems;
}

function hasTodayFocusItem(items: FocusItem[], itemId: string) {
  return items.some((item) => item.id === itemId || (item.source === 'jira' && item.children.some((child) => child.id === itemId)));
}

function nestNewPullRequestUnderJira(items: FocusItem[], parentId: string, pullRequest: FocusPullRequestItem) {
  if (hasTodayFocusItem(items, pullRequest.id)) {
    return { items, warning: 'That item is already in Today focus.' };
  }

  if (!items.some((item) => item.id === parentId && item.source === 'jira')) {
    return { items, warning: null };
  }

  return {
    items: items.map((item) =>
      item.id === parentId && item.source === 'jira'
        ? {
            ...item,
            children: [...item.children, pullRequest]
          }
        : item
    ),
    warning: null
  };
}

function moveStandalonePullRequestUnderJira(items: FocusItem[], parentId: string, itemId: string) {
  const standalonePullRequest = items.find(
    (item): item is FocusPullRequestItem => item.id === itemId && item.source === 'github'
  );

  if (!standalonePullRequest || !items.some((item) => item.id === parentId && item.source === 'jira')) {
    return items;
  }

  return items.reduce<FocusItem[]>((nextItems, item) => {
    if (item.id === itemId) {
      return nextItems;
    }

    if (item.id === parentId && item.source === 'jira') {
      nextItems.push({
        ...item,
        children: [...item.children, standalonePullRequest]
      });
      return nextItems;
    }

    nextItems.push(item);
    return nextItems;
  }, []);
}

function reorderTopLevelTodayFocusItems(items: FocusItem[], itemId: string, targetId: string) {
  if (itemId === targetId) {
    return items;
  }

  const sourceIndex = items.findIndex((item) => item.id === itemId);
  const targetIndex = items.findIndex((item) => item.id === targetId);
  if (sourceIndex < 0 || targetIndex < 0) {
    return items;
  }

  const nextItems = [...items];
  const [movedItem] = nextItems.splice(sourceIndex, 1);
  const insertIndex = nextItems.findIndex((item) => item.id === targetId);
  nextItems.splice(insertIndex, 0, movedItem);
  return nextItems;
}

function moveTopLevelTodayFocusItemToEnd(items: FocusItem[], itemId: string) {
  const sourceIndex = items.findIndex((item) => item.id === itemId);
  if (sourceIndex < 0 || sourceIndex === items.length - 1) {
    return items;
  }

  const nextItems = [...items];
  const [movedItem] = nextItems.splice(sourceIndex, 1);
  nextItems.push(movedItem);
  return nextItems;
}

function reorderNestedPullRequests(items: FocusItem[], parentId: string, itemId: string, targetId: string) {
  if (itemId === targetId) {
    return items;
  }

  return items.map((item) => {
    if (item.id !== parentId || item.source !== 'jira') {
      return item;
    }

    const sourceIndex = item.children.findIndex((child) => child.id === itemId);
    if (sourceIndex < 0) {
      return item;
    }

    const nextChildren = [...item.children];
    const [movedChild] = nextChildren.splice(sourceIndex, 1);
    const insertIndex =
      targetId === getNestedPullRequestEndTargetId(parentId)
        ? nextChildren.length
        : nextChildren.findIndex((child) => child.id === targetId);
    if (insertIndex < 0) {
      return item;
    }
    nextChildren.splice(insertIndex, 0, movedChild);

    return {
      ...item,
      children: nextChildren
    };
  });
}

function normalizeTopLevelTodayFocusItem(item: FocusItem): FocusItem {
  return item.source === 'jira'
    ? {
        ...item,
        children: item.children ?? []
      }
    : item;
}

function getNestedPullRequestEndTargetId(parentId: string) {
  return `__end__:${parentId}`;
}

function getDashboardAlerts(options: {
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
    onOpenApprovedPrs
  } = options;

  return [
    {
      value:
        isGitHubLoading || gitHubMetrics.connectionStatus !== 'connected'
          ? '0'
          : String(gitHubMetrics.reviewRequestedCount),
      title: 'PRs ready for review',
      detail: getReviewAlertDetail(gitHubMetrics, isGitHubLoading),
      tone: 'amber',
      onClick:
        gitHubMetrics.connectionStatus === 'connected' && !isGitHubLoading
          ? onOpenReviewRequestedPrs
          : undefined
    },
    {
      value: isJiraLoading ? '0' : String(jiraCounts.blocking),
      title: jiraCounts.blocking === 1 ? 'Blocked item' : 'Blocked items',
      detail: isJiraLoading ? 'Checking Jira blockers.' : 'Needs your input.',
      tone: 'rose',
      onClick: !isJiraLoading ? onOpenBlockedIssues : undefined
    },
    {
      value:
        isGitHubLoading || gitHubMetrics.approvedPrCount === null ? '0' : String(gitHubMetrics.approvedPrCount),
      title: 'PRs approved',
      detail:
        gitHubMetrics.connectionStatus === 'connected'
          ? 'Ready to merge or follow through.'
          : 'Available once GitHub is connected.',
      tone: 'emerald',
      onClick:
        gitHubMetrics.connectionStatus === 'connected' && gitHubMetrics.approvedPrCount !== null
          ? onOpenApprovedPrs
          : undefined
    },
    {
      value:
        isGitHubLoading || gitHubMetrics.connectionStatus !== 'connected'
          ? '0'
          : String(gitHubMetrics.relevantPrCount),
      title: 'PRs open',
      detail:
        gitHubMetrics.connectionStatus === 'connected'
          ? 'Across repositories.'
          : 'Available once GitHub is connected.',
      tone: 'blue',
      onClick: gitHubMetrics.connectionStatus === 'connected' ? onOpenGitHubPrs : undefined
    }
  ];
}

function getReviewAlertDetail(
  gitHubMetrics: GitHubSummaryMetrics,
  isGitHubLoading: boolean
) {
  if (isGitHubLoading) {
    return 'Loading GitHub review activity.';
  }

  if (gitHubMetrics.connectionStatus === 'invalid') {
    return 'GitHub token needs attention.';
  }

  if (gitHubMetrics.connectionStatus === 'error') {
    return 'GitHub is temporarily unavailable.';
  }

  if (gitHubMetrics.connectionStatus === 'not-connected') {
    return 'Connect GitHub to load review requests.';
  }

  if (gitHubMetrics.missingUsername) {
    return 'Add your GitHub username in Settings.';
  }

  return gitHubMetrics.reviewRequestedCount > 0 ? 'Waiting on your review.' : 'No review requests waiting.';
}

function DashboardAlert({ alert }: { alert: DashboardAlertItem }) {
  const iconWrapClass =
    alert.tone === 'amber'
      ? 'bg-amber-500/14 text-amber-300'
      : alert.tone === 'rose'
        ? 'bg-rose-500/14 text-rose-300'
        : alert.tone === 'emerald'
          ? 'bg-emerald-500/14 text-emerald-300'
          : 'bg-sky-500/14 text-sky-300';

  const content = (
    <div
      className="flex h-full min-h-[84px] items-center gap-2.5 rounded-[var(--radius-card)] border border-white/[0.06] bg-[rgba(255,255,255,0.028)] px-3 py-2.5 shadow-[var(--shadow-card)] backdrop-blur-[var(--card-blur)]"
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${iconWrapClass}`}
        aria-hidden="true"
      >
        <DashboardAlertIcon tone={alert.tone} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-baseline gap-2">
          <p className="shrink-0 text-[1.7rem] font-semibold leading-none tracking-[-0.045em] text-primary">
            {alert.value}
          </p>
          <p className="min-w-0 truncate text-[0.82rem] font-medium leading-4 text-primary">{alert.title}</p>
        </div>
        <p className="mt-0.5 text-[0.72rem] leading-4 text-secondary">{alert.detail}</p>
      </div>
    </div>
  );

  if (!alert.onClick) {
    return content;
  }

  return (
    <button
      type="button"
      onClick={alert.onClick}
      className="dashboard-summary-button text-left transition hover:translate-y-[-1px] hover:opacity-100"
    >
      {content}
    </button>
  );
}

function DashboardAlertIcon({
  tone
}: {
  tone: DashboardAlertItem['tone'];
}) {
  if (tone === 'amber') {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="8" />
        <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (tone === 'rose') {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="8" />
        <path d="M12 8v5" strokeLinecap="round" />
        <circle cx="12" cy="16.5" r="0.9" fill="currentColor" stroke="none" />
      </svg>
    );
  }

  if (tone === 'emerald') {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="8" />
        <path d="m8.5 12 2.4 2.4L15.8 9.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="6.5" cy="6.5" r="1.6" />
      <circle cx="17.5" cy="6.5" r="1.6" />
      <circle cx="12" cy="17.5" r="1.6" />
      <path d="M8 7.4h8" strokeLinecap="round" />
      <path d="M7.4 8l3.5 7.2" strokeLinecap="round" />
      <path d="M16.6 8 13 15.2" strokeLinecap="round" />
    </svg>
  );
}

function IntegrationTabButton({
  label,
  isActive,
  onClick
}: {
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-[0.82rem] font-medium transition ${
        isActive
          ? 'bg-white/[0.12] text-primary shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]'
          : 'bg-transparent text-secondary hover:bg-white/[0.045] hover:text-primary'
      }`}
    >
      {label}
    </button>
  );
}

function GitHubIntegrationStatusBar({
  connectionStatus,
  isLoading,
  isCheckingActivity,
  lastUpdatedAt,
  lastCheckedAt,
  onRefresh
}: {
  connectionStatus: GitHubConnectionStatus;
  isLoading: boolean;
  isCheckingActivity: boolean;
  lastUpdatedAt: number | null;
  lastCheckedAt: number | null;
  onRefresh: () => void;
}) {
  const toneClass =
    connectionStatus === 'connected'
      ? 'bg-emerald-200/10 text-emerald-100'
      : connectionStatus === 'invalid'
        ? 'bg-rose-200/10 text-rose-100'
        : connectionStatus === 'testing' || connectionStatus === 'error'
          ? 'bg-amber-200/10 text-amber-100'
          : 'bg-white/6 text-stone-300';
  const label =
    connectionStatus === 'connected'
      ? 'Connected'
      : connectionStatus === 'invalid'
        ? 'Invalid token'
        : connectionStatus === 'testing'
          ? 'Testing'
          : connectionStatus === 'error'
            ? 'Connection error'
            : 'Not connected';

  return (
    <div className="ml-auto flex flex-col items-end gap-1">
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        <TopBarBadge className={toneClass}>{label}</TopBarBadge>
        <TopBarButton onClick={onRefresh} disabled={isLoading}>
          {isLoading ? 'Refreshing...' : 'Refresh'}
        </TopBarButton>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1 text-[0.68rem] text-white/32">
        <span>Updated {formatDashboardTime(lastUpdatedAt)}</span>
        <span>·</span>
        <span>
          Checked {formatDashboardTime(lastCheckedAt)}
          {isCheckingActivity ? ' · Checking…' : ''}
        </span>
      </div>
    </div>
  );
}

function JiraIntegrationStatusBar({
  connectionStatus,
  isLoading,
  lastUpdatedAt,
  onRefresh
}: {
  connectionStatus: JiraConnectionStatus;
  isLoading: boolean;
  lastUpdatedAt: number | null;
  onRefresh: () => void;
}) {
  const toneClass =
    connectionStatus === 'connected'
      ? 'bg-emerald-200/10 text-emerald-100'
      : connectionStatus === 'invalid'
        ? 'bg-rose-200/10 text-rose-100'
        : connectionStatus === 'testing' || connectionStatus === 'error'
          ? 'bg-amber-200/10 text-amber-100'
          : 'bg-white/6 text-stone-300';
  const label =
    connectionStatus === 'connected'
      ? 'Connected'
      : connectionStatus === 'invalid'
        ? 'Invalid credentials'
        : connectionStatus === 'testing'
          ? 'Testing'
          : connectionStatus === 'error'
            ? 'API error'
            : 'Not connected';

  return (
    <div className="ml-auto flex flex-col items-end gap-1">
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        <TopBarBadge className={toneClass}>{label}</TopBarBadge>
        <TopBarButton onClick={onRefresh} disabled={isLoading || connectionStatus === 'not-connected'}>
          {isLoading ? 'Refreshing...' : 'Refresh'}
        </TopBarButton>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1 text-[0.68rem] text-white/32">
        <span>Updated {formatDashboardTime(lastUpdatedAt)}</span>
      </div>
    </div>
  );
}

function TopBarBadge({
  children,
  className
}: {
  children: ReactNode;
  className: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[0.62rem] font-medium uppercase tracking-[0.14em] ${className}`}
    >
      {children}
    </span>
  );
}

function TopBarButton({
  children,
  disabled,
  onClick
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center rounded-full bg-white/[0.045] px-2.5 py-0.5 text-[0.62rem] uppercase tracking-[0.16em] text-white/48 transition hover:bg-white/[0.08] hover:text-white/72 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function GitHubHeaderShortcuts({
  connectionStatus,
  warningCount,
  readyToMergeCount,
  readyToMergeBadgeCount,
  failedBuildCount,
  failedBuildBadgeCount,
  jiraBlockingCount,
  onOpenWarnings,
  onOpenReadyToMerge,
  onOpenJira
}: {
  connectionStatus: GitHubConnectionStatus;
  warningCount: number;
  readyToMergeCount: number;
  readyToMergeBadgeCount: number;
  failedBuildCount: number;
  failedBuildBadgeCount: number;
  jiraBlockingCount: number;
  onOpenWarnings: () => void;
  onOpenReadyToMerge: () => void;
  onOpenJira: () => void;
}) {
  const isConnected = connectionStatus === 'connected';
  const items = [
    {
      key: 'notifications',
      count: warningCount,
      badgeCount: warningCount,
      colorClass: 'text-rose-300',
      label: 'Open pull request warnings',
      onClick: onOpenWarnings,
      icon: <HeaderBlockedIcon />
    },
    {
      key: 'open-prs',
      count: readyToMergeCount,
      badgeCount: readyToMergeBadgeCount,
      colorClass: 'text-emerald-400',
      label: 'Open ready to merge pull requests',
      onClick: onOpenReadyToMerge,
      icon: (isDimmed: boolean) => <HeaderReadyPrIcon isDimmed={isDimmed} />
    },
    {
      key: 'failed-build-prs',
      count: failedBuildCount,
      badgeCount: failedBuildBadgeCount,
      colorClass: 'text-emerald-400',
      label: 'Open pull requests with failed builds',
      onClick: onOpenWarnings,
      icon: (isDimmed: boolean) => <HeaderFailedBuildPrIcon isDimmed={isDimmed} />
    },
    {
      key: 'jira',
      count: jiraBlockingCount,
      colorClass: 'text-sky-400',
      label: 'Open Jira blockers',
      onClick: onOpenJira,
      icon: <HeaderJiraIcon />,
      isHidden: true
    }
  ];

  return (
    <div className="flex items-center gap-2">
      {items.map((item) => {
        if (item.isHidden) {
          return null;
        }

        const effectiveBadgeCount = item.badgeCount ?? item.count;
        const isDisabled = !isConnected || effectiveBadgeCount === 0;
        const showBadge = isConnected && effectiveBadgeCount > 0;

        return (
          <button
            key={item.key}
            type="button"
            onClick={item.onClick}
            disabled={isDisabled}
            aria-label={item.label}
            className={`relative inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)] transition ${
              isDisabled ? 'cursor-default opacity-45' : 'hover:bg-white/10'
            }`}
          >
            <span className={item.colorClass} aria-hidden="true">
              {typeof item.icon === 'function' ? item.icon(isDisabled) : item.icon}
            </span>
            {showBadge ? (
              <span className="absolute right-1.5 top-1.5 inline-flex min-w-[1.15rem] items-center justify-center rounded-full bg-rose-500 px-1 py-[0.1rem] text-[0.62rem] font-semibold leading-none text-white shadow-[0_4px_12px_rgba(244,63,94,0.28)]">
                {effectiveBadgeCount > 9 ? '9+' : effectiveBadgeCount}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function HeaderBlockedIcon() {
  return (
    <span className="text-[1.2rem] leading-none" aria-hidden="true">
      ⚠
    </span>
  );
}

function HeaderOpenPrIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-[1.12rem] w-[1.12rem]" fill="currentColor" aria-hidden="true">
      <path d="M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25Zm5.677-.177L9.573.677A.25.25 0 0 1 10 .854V2.5h1A2.5 2.5 0 0 1 13.5 5v5.628a2.251 2.251 0 1 1-1.5 0V5a1 1 0 0 0-1-1h-1v1.646a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354ZM3.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm0 9.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm8.25.75a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Z" />
    </svg>
  );
}

function HeaderReadyPrIcon({ isDimmed = false }: { isDimmed?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-[1.7rem] w-[1.7rem]" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9.5" fill="#1fb236" fillOpacity={isDimmed ? 0.42 : 1} />
      <circle cx="12" cy="12" r="9.5" fill="url(#ready-pr-glow)" fillOpacity={isDimmed ? 0.16 : 0.3} />
      <path
        d="m8.6 12.4 2.3 2.3 4.7-5.2"
        stroke="#fff"
        strokeOpacity={isDimmed ? 0.82 : 1}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <defs>
        <radialGradient id="ready-pr-glow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(9 8) rotate(45) scale(13)">
          <stop stopColor="#fff" stopOpacity="0.45" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
    </svg>
  );
}

function HeaderFailedBuildPrIcon({ isDimmed = false }: { isDimmed?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-[1.7rem] w-[1.7rem]" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9.5" fill="#ef2029" fillOpacity={isDimmed ? 0.42 : 1} />
      <circle cx="12" cy="12" r="9.5" fill="url(#failed-pr-glow)" fillOpacity={isDimmed ? 0.14 : 0.26} />
      <path
        d="m8.8 8.8 6.4 6.4m0-6.4-6.4 6.4"
        stroke="#fff"
        strokeOpacity={isDimmed ? 0.82 : 1}
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <defs>
        <radialGradient id="failed-pr-glow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(9 8) rotate(45) scale(13)">
          <stop stopColor="#fff" stopOpacity="0.4" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
    </svg>
  );
}

function HeaderJiraIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[1.3rem] w-[1.3rem]" fill="currentColor" aria-hidden="true">
      <path d="M12 3 21 12l-9 9-9-9 9-9Zm0 4.2L7.2 12 12 16.8 16.8 12 12 7.2Zm0 2.8 2 2-2 2-2-2 2-2Z" />
    </svg>
  );
}

function formatDashboardTime(value: number | null) {
  if (!value) {
    return 'Never';
  }

  return new Date(value).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit'
  });
}
