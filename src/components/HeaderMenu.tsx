import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { GitHubConnectionStatus } from '../lib/githubApi';
import type { JiraConnectionStatus } from '../lib/jiraApi';
import { formatDashboardTime } from '../lib/dashboardPageDomain';
import type { ActiveIntegration } from '../lib/storage';
import type { GitHubMockScenarioOption } from '../mocks/github/scenarios';

type HeaderMenuProps = {
  activeIntegration: ActiveIntegration;
  gitHubConnectionStatus: GitHubConnectionStatus;
  jiraConnectionStatus: JiraConnectionStatus;
  isGitHubLoading?: boolean;
  isJiraLoading?: boolean;
  isCheckingGitHubActivity?: boolean;
  lastGitHubUpdatedAt?: number | null;
  lastJiraUpdatedAt?: number | null;
  isMockMode?: boolean;
  mockScenarioKey?: string | null;
  mockScenarioOptions?: GitHubMockScenarioOption[];
  onRefreshGitHub?: () => void;
  onRefreshJira?: () => void;
  onApplyMockScenario?: (mockScenarioKey: string) => void;
  onClearMockScenario?: () => void;
};

export function HeaderMenu({
  activeIntegration,
  gitHubConnectionStatus,
  jiraConnectionStatus,
  isGitHubLoading = false,
  isJiraLoading = false,
  isCheckingGitHubActivity = false,
  lastGitHubUpdatedAt = null,
  lastJiraUpdatedAt = null,
  isMockMode = false,
  mockScenarioKey = null,
  mockScenarioOptions = [],
  onRefreshGitHub,
  onRefreshJira,
  onApplyMockScenario,
  onClearMockScenario
}: HeaderMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedMockScenarioKey, setSelectedMockScenarioKey] = useState(mockScenarioKey ?? '');
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setSelectedMockScenarioKey(mockScenarioKey ?? '');
  }, [mockScenarioKey]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleEscape);

    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const isRefreshDisabled =
    activeIntegration === 'github'
      ? isGitHubLoading || gitHubConnectionStatus !== 'connected'
      : isJiraLoading || jiraConnectionStatus !== 'connected';
  const refreshLabel =
    activeIntegration === 'github' && isGitHubLoading
      ? 'Refreshing...'
      : activeIntegration === 'jira' && isJiraLoading
        ? 'Refreshing...'
        : 'Refresh';
  const statusText =
    activeIntegration === 'github'
      ? gitHubConnectionStatus === 'connected'
        ? `Updated ${formatDashboardTime(lastGitHubUpdatedAt)}`
        : gitHubConnectionStatus === 'invalid'
          ? 'Invalid token'
          : gitHubConnectionStatus === 'testing'
            ? 'Testing'
            : gitHubConnectionStatus === 'error'
              ? 'Connection error'
              : 'Not connected'
      : jiraConnectionStatus === 'connected'
        ? `Updated ${formatDashboardTime(lastJiraUpdatedAt)}`
        : jiraConnectionStatus === 'invalid'
          ? 'Invalid credentials'
          : jiraConnectionStatus === 'testing'
            ? 'Testing'
            : jiraConnectionStatus === 'error'
              ? 'API error'
              : 'Not connected';

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-primary shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)] transition hover:bg-white/10"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label="Open menu"
      >
        <span className="flex flex-col gap-1">
          <span className="block h-0.5 w-5 rounded-full bg-current" />
          <span className="block h-0.5 w-5 rounded-full bg-current" />
          <span className="block h-0.5 w-5 rounded-full bg-current" />
        </span>
      </button>

      {isOpen ? (
        <div className="header-menu-panel absolute right-0 top-14 z-20 min-w-[280px] rounded-[26px] bg-panel p-4 shadow-glow">
          <div className="header-menu-refresh">
            <div className="header-menu-refresh__meta">
              <p className="header-menu-refresh__label">Last updated</p>
              <p className="header-menu-refresh__value">{statusText.replace('Updated ', '')}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (activeIntegration === 'github') {
                  onRefreshGitHub?.();
                } else {
                  onRefreshJira?.();
                }
                setIsOpen(false);
              }}
              disabled={isRefreshDisabled}
              className="header-menu-refresh__button"
            >
              <span className="header-menu-refresh__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                  <path d="M20 6v5h-5" strokeLinecap="round" strokeLinejoin="round" />
                  <path
                    d="M20 11a8 8 0 1 1-2.34-5.66L20 7.66"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <span>{refreshLabel}</span>
            </button>
          </div>
          <div className="header-menu-divider" />
          {isMockMode ? (
            <div className="mb-3 rounded-xl bg-white/[0.03] px-4 py-3">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[0.66rem] font-medium uppercase tracking-[0.14em] text-white/38">
                    Using mock data
                  </p>
                  <div className="mt-2 space-y-2">
                    <select
                      value={selectedMockScenarioKey}
                      onChange={(event) => setSelectedMockScenarioKey(event.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-primary outline-none transition focus:border-white/20"
                    >
                      {mockScenarioOptions.map((option) => (
                        <option key={option.key} value={option.key} className="bg-panel text-primary">
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedMockScenarioKey && onApplyMockScenario) {
                            onApplyMockScenario(selectedMockScenarioKey);
                          }
                          setIsOpen(false);
                        }}
                        className="rounded-lg bg-white/[0.08] px-3 py-1.5 text-xs font-medium uppercase tracking-[0.12em] text-primary transition hover:bg-white/[0.12]"
                      >
                        OK
                      </button>
                      <p className="min-w-0 truncate text-sm text-primary/82">{mockScenarioKey}</p>
                    </div>
                  </div>
                </div>
                {onClearMockScenario ? (
                  <button
                    type="button"
                    onClick={() => {
                      onClearMockScenario();
                      setIsOpen(false);
                    }}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-white/42 transition hover:bg-white/5 hover:text-white/72"
                    aria-label="Clear mock data"
                    title="Clear mock data"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M4.5 7h15" strokeLinecap="round" />
                      <path d="M9.5 3.75h5" strokeLinecap="round" />
                      <path d="M8 7v11.25c0 .55.45 1 1 1h6c.55 0 1-.45 1-1V7" strokeLinecap="round" />
                      <path d="M10 10.25v5.5M14 10.25v5.5" strokeLinecap="round" />
                    </svg>
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
          <Link
            to="/settings"
            onClick={() => setIsOpen(false)}
            className="header-menu-settings"
          >
            <span className="header-menu-settings__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path
                  d="M12 8.75A3.25 3.25 0 1 1 8.75 12 3.25 3.25 0 0 1 12 8.75Z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M19 12a7 7 0 0 0-.08-1l2.02-1.57-1.92-3.32-2.4.83a7.02 7.02 0 0 0-1.74-1l-.37-2.5h-3.84l-.37 2.5a7.02 7.02 0 0 0-1.74 1l-2.4-.83-1.92 3.32L5.08 11a7 7 0 0 0 0 2l-2.02 1.57 1.92 3.32 2.4-.83a7.02 7.02 0 0 0 1.74 1l.37 2.5h3.84l.37-2.5a7.02 7.02 0 0 0 1.74-1l2.4.83 1.92-3.32L18.92 13c.05-.33.08-.66.08-1Z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span className="header-menu-settings__body">
              <span className="header-menu-settings__title">Settings</span>
              <span className="header-menu-settings__detail">Preferences and account</span>
            </span>
          </Link>
        </div>
      ) : null}
    </div>
  );
}
