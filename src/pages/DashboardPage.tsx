import { ReactNode, useEffect, useRef, useState } from 'react';
import { DashboardHeader } from '../components/DashboardHeader';
import {
  GitHubCard,
  type GitHubSummaryMetrics,
} from '../components/GitHubCard';
import { HeaderMenu } from '../components/HeaderMenu';
import { JiraCard } from '../components/JiraCard';
import { NotesCard } from '../components/NotesCard';
import { PlaceholderCard } from '../components/PlaceholderCard';
import { SummaryCard, TODAY_FOCUS_MAX_ITEMS } from '../components/SummaryCard';
import { GitHubConnectionStatus, GitHubDashboardData } from '../lib/githubApi';
import {
  getJiraIssueCounts,
  JiraConnectionStatus,
  JiraDashboardData,
} from '../lib/jiraApi';
import {
  DashboardSettings,
  FocusItem,
  type ActiveJiraView,
  type GitHubPrStatusFilter,
} from '../lib/storage';
import type { GitHubMockScenarioOption } from '../mocks/github/scenarios';
import { type TodayFocusRefreshSignal } from '../lib/todayFocusSync';
import { useDashboardNavigation } from '../hooks/useDashboardNavigation';
import { useTodayFocusFallbacks } from '../hooks/useTodayFocusFallbacks';
import { useTodayFocusState } from '../hooks/useTodayFocusState';

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
  onGitHubSummaryMetricsChange,
}: DashboardPageProps) {
  const [gitHubSummaryMetrics, setGitHubSummaryMetrics] =
    useState<GitHubSummaryMetrics>({
      connectionStatus: gitHubData.connectionStatus,
      missingUsername: gitHubData.missingUsername,
      readyToMergeCount: 0,
      failedBuildCount: 0,
      failedBuildBadgeCount: 0,
      highlightedReadyCount: 0,
      highlightedWarningCount: 0,
      reviewRequestedCount: 0,
      approvedPrCount: null,
      relevantPrCount: gitHubData.openPrsCount,
    });
  const {
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
  } = useDashboardNavigation({
    syncKey: gitHubMockScenarioKey,
  });
  const {
    todayFocusItems,
    todayFocusItemsRef,
    todayFocusItemIds,
    todayFocusWarning,
    hasLoadedTodayFocusItems,
    commitTodayFocusItems,
    handleAddTodayFocusItem,
    handleRemoveTodayFocusItem,
    handleNestNewTodayFocusPullRequest,
    handleNestExistingTodayFocusPullRequest,
    handleReorderTopLevelTodayFocusItem,
    handleMoveTopLevelTodayFocusItemToEnd,
    handleReorderNestedTodayFocusPullRequest,
  } = useTodayFocusState({
    jiraIssues: jiraData.issues,
    gitHubPullRequests: gitHubData.pullRequests,
  });

  useEffect(() => {
    setGitHubSummaryMetrics((current) => ({
      ...current,
      connectionStatus: gitHubData.connectionStatus,
      missingUsername: gitHubData.missingUsername,
    }));
  }, [gitHubData.connectionStatus, gitHubData.missingUsername]);

  useEffect(() => {
    onGitHubSummaryMetricsChange(gitHubSummaryMetrics);
  }, [gitHubSummaryMetrics, onGitHubSummaryMetricsChange]);

  useTodayFocusFallbacks({
    settings,
    gitHubData,
    jiraData,
    jiraRefreshSignal,
    hasLoadedTodayFocusItems,
    todayFocusItemsRef,
    commitTodayFocusItems,
  });

  if (!hasLoadedTodayFocusItems) {
    return null;
  }

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
    },
  });

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
                readyToMergeBadgeCount={
                  gitHubSummaryMetrics.highlightedReadyCount
                }
                failedBuildCount={gitHubSummaryMetrics.failedBuildCount}
                failedBuildBadgeCount={
                  gitHubSummaryMetrics.failedBuildBadgeCount
                }
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
                jiraBaseUrl={settings.integrations.jira.baseUrl}
                warning={todayFocusWarning}
                onAddItem={handleAddTodayFocusItem}
                onNestNewPullRequest={handleNestNewTodayFocusPullRequest}
                onNestExistingPullRequest={
                  handleNestExistingTodayFocusPullRequest
                }
                onRemoveItem={handleRemoveTodayFocusItem}
                onReorderTopLevelItem={handleReorderTopLevelTodayFocusItem}
                onMoveTopLevelItemToEnd={handleMoveTopLevelTodayFocusItemToEnd}
                onReorderNestedPullRequest={
                  handleReorderNestedTodayFocusPullRequest
                }
              />
              {/* <NotesCard /> */}
            </section>

            <section className="dashboard-panel-column">
              <div className="relative flex min-h-0">
                <div
                  className={`min-h-0 flex-1 ${activeIntegration === 'github' ? 'flex' : 'hidden'}`}
                  aria-hidden={activeIntegration !== 'github'}
                >
                  <GitHubCard
                    topBar={
                      activeIntegration === 'github'
                        ? integrationSwitcher
                        : undefined
                    }
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
                    topBar={
                      activeIntegration === 'jira'
                        ? integrationSwitcher
                        : undefined
                    }
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

type DashboardAlertItem = {
  value: string;
  title: string;
  detail: string;
  tone: 'amber' | 'rose' | 'emerald' | 'blue';
  onClick?: () => void;
};

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
    onOpenApprovedPrs,
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

function getReviewAlertDetail(
  gitHubMetrics: GitHubSummaryMetrics,
  isGitHubLoading: boolean,
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

  return gitHubMetrics.reviewRequestedCount > 0
    ? 'Waiting on your review.'
    : 'No review requests waiting.';
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
    <div className="flex h-full min-h-[84px] items-center gap-2.5 rounded-[var(--radius-card)] border border-white/[0.06] bg-[rgba(255,255,255,0.028)] px-3 py-2.5 shadow-[var(--shadow-card)] backdrop-blur-[var(--card-blur)]">
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
          <p className="min-w-0 truncate text-[0.82rem] font-medium leading-4 text-primary">
            {alert.title}
          </p>
        </div>
        <p className="mt-0.5 text-[0.72rem] leading-4 text-secondary">
          {alert.detail}
        </p>
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

function DashboardAlertIcon({ tone }: { tone: DashboardAlertItem['tone'] }) {
  if (tone === 'amber') {
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <circle cx="12" cy="12" r="8" />
        <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (tone === 'rose') {
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <circle cx="12" cy="12" r="8" />
        <path d="M12 8v5" strokeLinecap="round" />
        <circle cx="12" cy="16.5" r="0.9" fill="currentColor" stroke="none" />
      </svg>
    );
  }

  if (tone === 'emerald') {
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <circle cx="12" cy="12" r="8" />
        <path
          d="m8.5 12 2.4 2.4L15.8 9.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
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
  onClick,
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
  onRefresh,
}: {
  connectionStatus: GitHubConnectionStatus;
  isLoading: boolean;
  isCheckingActivity: boolean;
  lastUpdatedAt: number | null;
  onRefresh: () => void;
}) {
  const buttonLabel =
    connectionStatus === 'connected'
      ? isLoading
        ? 'Refreshing...'
        : 'Refresh'
      : connectionStatus === 'invalid'
        ? 'Invalid token'
        : connectionStatus === 'testing'
          ? 'Testing'
          : connectionStatus === 'error'
            ? 'Connection error'
            : 'Not connected';
  const statusText =
    connectionStatus === 'connected'
      ? `Updated ${formatDashboardTime(lastUpdatedAt)}`
      : connectionStatus === 'invalid'
        ? 'Invalid token'
        : connectionStatus === 'testing'
          ? 'Testing'
          : connectionStatus === 'error'
            ? 'Connection error'
            : 'Not connected';

  return (
    <div className="ml-auto flex flex-col items-end gap-1">
      <div className="flex flex-wrap items-center justify-end">
        <TopBarButton
          onClick={onRefresh}
          disabled={isLoading || connectionStatus !== 'connected'}
        >
          {buttonLabel}
        </TopBarButton>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-y-1 text-[0.68rem] text-white/32">
        <span>{statusText}</span>
      </div>
    </div>
  );
}

function JiraIntegrationStatusBar({
  connectionStatus,
  isLoading,
  lastUpdatedAt,
  onRefresh,
}: {
  connectionStatus: JiraConnectionStatus;
  isLoading: boolean;
  lastUpdatedAt: number | null;
  onRefresh: () => void;
}) {
  const buttonLabel =
    connectionStatus === 'connected'
      ? isLoading
        ? 'Refreshing...'
        : 'Refresh'
      : connectionStatus === 'invalid'
        ? 'Invalid credentials'
        : connectionStatus === 'testing'
          ? 'Testing'
          : connectionStatus === 'error'
            ? 'API error'
            : 'Not connected';
  const statusText =
    connectionStatus === 'connected'
      ? `Updated ${formatDashboardTime(lastUpdatedAt)}`
      : connectionStatus === 'invalid'
        ? 'Invalid credentials'
        : connectionStatus === 'testing'
          ? 'Testing'
          : connectionStatus === 'error'
            ? 'API error'
            : 'Not connected';

  return (
    <div className="ml-auto flex flex-col items-end gap-1">
      <div className="flex flex-wrap items-center justify-end">
        <TopBarButton
          onClick={onRefresh}
          disabled={isLoading || connectionStatus !== 'connected'}
        >
          {buttonLabel}
        </TopBarButton>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-y-1 text-[0.68rem] text-white/32">
        <span>{statusText}</span>
      </div>
    </div>
  );
}

function TopBarButton({
  children,
  disabled,
  onClick,
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
  onOpenJira,
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
      colorClass: 'text-primary',
      label: 'Open pull request warnings',
      onClick: onOpenWarnings,
      icon: <HeaderBlockedIcon />,
    },
    {
      key: 'open-prs',
      count: readyToMergeCount,
      badgeCount: readyToMergeBadgeCount,
      colorClass: 'text-primary',
      label: 'Open ready to merge pull requests',
      onClick: onOpenReadyToMerge,
      icon: (isDimmed: boolean) => <HeaderReadyPrIcon isDimmed={isDimmed} />,
    },
    {
      key: 'failed-build-prs',
      count: failedBuildCount,
      badgeCount: failedBuildBadgeCount,
      colorClass: 'text-primary',
      label: 'Open pull requests with failed builds',
      onClick: onOpenWarnings,
      icon: (isDimmed: boolean) => (
        <HeaderFailedBuildPrIcon isDimmed={isDimmed} />
      ),
    },
    {
      key: 'jira',
      count: jiraBlockingCount,
      colorClass: 'text-sky-400',
      label: 'Open Jira blockers',
      onClick: onOpenJira,
      icon: <HeaderJiraIcon />,
      isHidden: true,
    },
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
              {typeof item.icon === 'function'
                ? item.icon(isDisabled)
                : item.icon}
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
    <svg
      viewBox="0 0 24 24"
      className="h-[1.35rem] w-[1.35rem]"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M12 5.2 18.6 17H5.4L12 5.2Z"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
      <path
        d="M12 9.5v3.9"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      <circle cx="12" cy="15.9" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function HeaderOpenPrIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-[1.12rem] w-[1.12rem]"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25Zm5.677-.177L9.573.677A.25.25 0 0 1 10 .854V2.5h1A2.5 2.5 0 0 1 13.5 5v5.628a2.251 2.251 0 1 1-1.5 0V5a1 1 0 0 0-1-1h-1v1.646a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354ZM3.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm0 9.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm8.25.75a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Z" />
    </svg>
  );
}

function HeaderReadyPrIcon({ isDimmed = false }: { isDimmed?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[1.7rem] w-[1.7rem]"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="9.5"
        stroke="currentColor"
        strokeOpacity={isDimmed ? 0.58 : 0.9}
        strokeWidth="1.8"
      />
      <path
        d="m8.6 12.4 2.3 2.3 4.7-5.2"
        stroke="currentColor"
        strokeOpacity={isDimmed ? 0.58 : 0.9}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HeaderFailedBuildPrIcon({ isDimmed = false }: { isDimmed?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[1.7rem] w-[1.7rem]"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="9.5"
        stroke="currentColor"
        strokeOpacity={isDimmed ? 0.58 : 0.9}
        strokeWidth="1.8"
      />
      <path
        d="m8.8 8.8 6.4 6.4m0-6.4-6.4 6.4"
        stroke="currentColor"
        strokeOpacity={isDimmed ? 0.58 : 0.9}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HeaderJiraIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[1.3rem] w-[1.3rem]"
      fill="currentColor"
      aria-hidden="true"
    >
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
    minute: '2-digit',
  });
}
