import type { ReactNode } from 'react';
import type { GitHubSummaryMetrics } from './GitHubCard';
import type { GitHubConnectionStatus } from '../lib/githubApi';
import type { JiraConnectionStatus } from '../lib/jiraApi';
import type { ActiveIntegration } from '../lib/storage';
import type { GitHubMockScenarioOption } from '../mocks/github/scenarios';
import { HeaderMenu } from './HeaderMenu';

type DashboardHeaderControlsProps = {
  activeIntegration: ActiveIntegration;
  repoLauncherControl?: ReactNode;
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
  onOpenTeamPr: () => void;
  onOpenJira: () => void;
  onApplyGitHubMockScenario: (mockScenarioKey: string) => void;
  onClearGitHubMockScenario: () => void;
};

export function DashboardHeaderControls({
  activeIntegration,
  repoLauncherControl,
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
  onOpenTeamPr,
  onOpenJira,
  onApplyGitHubMockScenario,
  onClearGitHubMockScenario,
}: DashboardHeaderControlsProps) {
  return (
    <div className="dashboard-header-status gap-3">
      <GitHubHeaderShortcuts
        connectionStatus={gitHubSummaryMetrics.connectionStatus}
        warningCount={gitHubSummaryMetrics.highlightedWarningCount}
        readyToMergeCount={gitHubSummaryMetrics.readyToMergeCount}
        readyToMergeBadgeCount={gitHubSummaryMetrics.highlightedReadyCount}
        failedBuildCount={gitHubSummaryMetrics.failedBuildCount}
        failedBuildBadgeCount={gitHubSummaryMetrics.failedBuildBadgeCount}
        openTeamPrCount={gitHubSummaryMetrics.openTeamPrCount}
        jiraBlockingCount={jiraBlockingCount}
        onOpenWarnings={onOpenWarnings}
        onOpenReadyToMerge={onOpenReadyToMerge}
        onOpenTeamPr={onOpenTeamPr}
        onOpenJira={onOpenJira}
      />
      {repoLauncherControl}
      <HeaderMenu
        activeIntegration={activeIntegration}
        gitHubConnectionStatus={gitHubConnectionStatus}
        jiraConnectionStatus={jiraConnectionStatus}
        isGitHubLoading={isGitHubLoading}
        isJiraLoading={isJiraLoading}
        isCheckingGitHubActivity={isCheckingGitHubActivity}
        lastGitHubUpdatedAt={lastGitHubUpdatedAt}
        lastJiraUpdatedAt={lastJiraUpdatedAt}
        isMockMode={isGitHubMockMode}
        mockScenarioKey={gitHubMockScenarioKey}
        mockScenarioOptions={gitHubMockScenarioOptions}
        onRefreshGitHub={onRefreshGitHub}
        onRefreshJira={onRefreshJira}
        onApplyMockScenario={onApplyGitHubMockScenario}
        onClearMockScenario={onClearGitHubMockScenario}
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

function GitHubHeaderShortcuts({
  connectionStatus,
  warningCount,
  readyToMergeCount,
  readyToMergeBadgeCount,
  failedBuildCount,
  failedBuildBadgeCount,
  openTeamPrCount,
  jiraBlockingCount,
  onOpenWarnings,
  onOpenReadyToMerge,
  onOpenTeamPr,
  onOpenJira,
}: {
  connectionStatus: GitHubConnectionStatus;
  warningCount: number;
  readyToMergeCount: number;
  readyToMergeBadgeCount: number;
  failedBuildCount: number;
  failedBuildBadgeCount: number;
  openTeamPrCount: number;
  jiraBlockingCount: number;
  onOpenWarnings: () => void;
  onOpenReadyToMerge: () => void;
  onOpenTeamPr: () => void;
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
      key: 'open-team-pr',
      count: openTeamPrCount,
      colorClass: 'text-primary',
      label: 'Open recent team pull requests',
      onClick: onOpenTeamPr,
      icon: <HeaderTeamPrsIcon />,
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

function HeaderTeamPrsIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="h-[1.1rem] w-[1.1rem]"
      fill="currentColor"
    >
      <path d="M2 5.5a3.5 3.5 0 1 1 5.898 2.549 5.508 5.508 0 0 1 3.034 4.084.75.75 0 1 1-1.482.235 4 4 0 0 0-7.9 0 .75.75 0 0 1-1.482-.236A5.507 5.507 0 0 1 3.102 8.05 3.493 3.493 0 0 1 2 5.5ZM11 4a3.001 3.001 0 0 1 2.22 5.018 5.01 5.01 0 0 1 2.56 3.012.749.749 0 0 1-.885.954.752.752 0 0 1-.549-.514 3.507 3.507 0 0 0-2.522-2.372.75.75 0 0 1-.574-.73v-.352a.75.75 0 0 1 .416-.672A1.5 1.5 0 0 0 11 5.5.75.75 0 0 1 11 4Zm-5.5-.5a2 2 0 1 0-.001 3.999A2 2 0 0 0 5.5 3.5Z" />
    </svg>
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
