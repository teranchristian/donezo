import type { ReactNode } from 'react';
import type { GitHubSummaryMetrics } from './GitHubCard';
import type { GitHubConnectionStatus } from '../lib/githubApi';
import type { JiraConnectionStatus } from '../lib/jiraApi';
import type { ActiveIntegration } from '../lib/storage';
import type { GitHubMockScenarioOption } from '../mocks/github/scenarios';
import { formatDashboardTime } from '../lib/dashboardPageDomain';
import { HeaderMenu } from './HeaderMenu';

type DashboardHeaderControlsProps = {
  activeIntegration: ActiveIntegration;
  gitHubSummaryMetrics: GitHubSummaryMetrics;
  jiraBlockingCount: number;
  gitHubConnectionStatus: GitHubConnectionStatus;
  jiraConnectionStatus: JiraConnectionStatus;
  isGitHubLoading: boolean;
  isJiraLoading: boolean;
  isCheckingGitHubActivity: boolean;
  lastGitHubUpdatedAt: number | null;
  lastJiraUpdatedAt: number | null;
  isGitHubMockMode: boolean;
  gitHubMockScenarioKey: string | null;
  gitHubMockScenarioOptions: GitHubMockScenarioOption[];
  onRefreshGitHub: () => void;
  onRefreshJira: () => void;
  onOpenWarnings: () => void;
  onOpenReadyToMerge: () => void;
  onOpenJira: () => void;
  onSetActiveIntegration: (integration: ActiveIntegration) => void;
  onApplyGitHubMockScenario: (mockScenarioKey: string) => void;
  onClearGitHubMockScenario: () => void;
};

export function DashboardHeaderControls({
  activeIntegration,
  gitHubSummaryMetrics,
  jiraBlockingCount,
  gitHubConnectionStatus,
  jiraConnectionStatus,
  isGitHubLoading,
  isJiraLoading,
  isCheckingGitHubActivity,
  lastGitHubUpdatedAt,
  lastJiraUpdatedAt,
  isGitHubMockMode,
  gitHubMockScenarioKey,
  gitHubMockScenarioOptions,
  onRefreshGitHub,
  onRefreshJira,
  onOpenWarnings,
  onOpenReadyToMerge,
  onOpenJira,
  onSetActiveIntegration,
  onApplyGitHubMockScenario,
  onClearGitHubMockScenario,
}: DashboardHeaderControlsProps) {
  return (
    <div className="dashboard-header-status gap-3">
      {activeIntegration === 'github' ? (
        <GitHubIntegrationStatusBar
          connectionStatus={gitHubConnectionStatus}
          isLoading={isGitHubLoading}
          isCheckingActivity={isCheckingGitHubActivity}
          lastUpdatedAt={lastGitHubUpdatedAt}
          onRefresh={onRefreshGitHub}
        />
      ) : (
        <JiraIntegrationStatusBar
          connectionStatus={jiraConnectionStatus}
          isLoading={isJiraLoading}
          lastUpdatedAt={lastJiraUpdatedAt}
          onRefresh={onRefreshJira}
        />
      )}
      {activeIntegration === 'github' ? (
        <GitHubHeaderShortcuts
          connectionStatus={gitHubSummaryMetrics.connectionStatus}
          warningCount={gitHubSummaryMetrics.highlightedWarningCount}
          readyToMergeCount={gitHubSummaryMetrics.readyToMergeCount}
          readyToMergeBadgeCount={gitHubSummaryMetrics.highlightedReadyCount}
          failedBuildCount={gitHubSummaryMetrics.failedBuildCount}
          failedBuildBadgeCount={gitHubSummaryMetrics.failedBuildBadgeCount}
          jiraBlockingCount={jiraBlockingCount}
          onOpenWarnings={onOpenWarnings}
          onOpenReadyToMerge={onOpenReadyToMerge}
          onOpenJira={onOpenJira}
        />
      ) : null}
      <HeaderMenu
        isMockMode={isGitHubMockMode}
        mockScenarioKey={gitHubMockScenarioKey}
        mockScenarioOptions={gitHubMockScenarioOptions}
        onApplyMockScenario={onApplyGitHubMockScenario}
        onClearMockScenario={onClearGitHubMockScenario}
      />
      <DashboardIntegrationSwitcher
        activeIntegration={activeIntegration}
        onSetActiveIntegration={onSetActiveIntegration}
      />
    </div>
  );
}

export function DashboardIntegrationSwitcher({
  activeIntegration,
  onSetActiveIntegration,
}: {
  activeIntegration: ActiveIntegration;
  onSetActiveIntegration: (integration: ActiveIntegration) => void;
}) {
  return (
    <div className="inline-flex flex-wrap items-center gap-1 rounded-full border border-white/[0.035] bg-white/[0.025] p-1">
      <IntegrationTabButton
        label="GitHub"
        isActive={activeIntegration === 'github'}
        onClick={() => onSetActiveIntegration('github')}
      />
      <IntegrationTabButton
        label="Jira"
        isActive={activeIntegration === 'jira'}
        onClick={() => onSetActiveIntegration('jira')}
      />
    </div>
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
