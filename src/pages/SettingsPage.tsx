import { FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CardShell } from '../components/CardShell';
import { InfoBanner } from '../components/InfoBanner';
import { GitHubConnectionStatus } from '../lib/githubApi';
import { JiraConnectionStatus } from '../lib/jiraApi';
import { DashboardSettings } from '../lib/storage';

type SettingsPageProps = {
  settings: DashboardSettings;
  gitHubOwnerOptions: string[];
  onLoadGitHubOwnerOptions: (options: {
    token: string;
    username?: string;
  }) => Promise<string[]>;
  onSaveDisplayName: (displayName: string) => Promise<void>;
  onSave: (settings: DashboardSettings) => Promise<void>;
  isGitHubDevModeAvailable: boolean;
  isGitHubDevModeEnabled: boolean;
  onSetGitHubDevMode: (isEnabled: boolean) => Promise<void>;
  onTestGitHubConnection: (token: string) => Promise<GitHubConnectionStatus>;
  onTestJiraConnection: (
    baseUrl: string,
    email: string,
    apiToken: string
  ) => Promise<JiraConnectionStatus>;
  gitHubTestStatus: GitHubConnectionStatus;
  jiraTestStatus: JiraConnectionStatus;
  jiraErrorMessage?: string;
  isTestingGitHub: boolean;
  isTestingJira: boolean;
};

const TEST_STATUS_COPY: Record<GitHubConnectionStatus, string> = {
  'not-connected': 'No token entered yet.',
  testing: 'Testing GitHub connection...',
  connected: 'GitHub connection succeeded.',
  invalid: 'GitHub rejected the token with a 401 response.',
  error: 'GitHub could not be reached or returned an unexpected response.'
};

const JIRA_TEST_STATUS_COPY: Record<JiraConnectionStatus, string> = {
  'not-connected': 'Complete the Jira URL, email, and API token first.',
  testing: 'Testing Jira connection...',
  connected: 'Jira connection succeeded.',
  invalid: 'Jira rejected the credentials with a 401 response.',
  error: 'Jira could not be reached or returned an unexpected response.'
};

export function SettingsPage({
  settings,
  gitHubOwnerOptions,
  onLoadGitHubOwnerOptions,
  onSaveDisplayName,
  onSave,
  isGitHubDevModeAvailable,
  isGitHubDevModeEnabled,
  onSetGitHubDevMode,
  onTestGitHubConnection,
  onTestJiraConnection,
  gitHubTestStatus,
  jiraTestStatus,
  jiraErrorMessage = '',
  isTestingGitHub,
  isTestingJira
}: SettingsPageProps) {
  const location = useLocation();
  const [draft, setDraft] = useState(settings);
  const [isSaving, setIsSaving] = useState(false);
  const [displayNameSaveState, setDisplayNameSaveState] = useState<
    'idle' | 'saving' | 'saved'
  >('idle');
  const [saveMessage, setSaveMessage] = useState('');
  const [isLoadingGitHubOwnerOptions, setIsLoadingGitHubOwnerOptions] = useState(false);
  const isLoadingGitHubOwnerOptionsRef = useRef(false);
  const previousSettingsRef = useRef(settings);
  const [lastSuccessfulGitHubTestToken, setLastSuccessfulGitHubTestToken] = useState(
    gitHubTestStatus === 'connected' ? settings.integrations.github.token.trim() : ''
  );

  useEffect(() => {
    const previousSettings = previousSettingsRef.current;
    previousSettingsRef.current = settings;

    if (
      areSettingsIntegrationsEqual(
        previousSettings.integrations,
        settings.integrations,
      )
    ) {
      setDraft((currentDraft) => ({
        ...currentDraft,
        name: settings.name,
      }));
      return;
    }

    setDraft(settings);
  }, [settings]);

  useEffect(() => {
    const nextDisplayName = draft.name.trim();
    if (nextDisplayName === settings.name.trim()) {
      return;
    }

    setDisplayNameSaveState('saving');
    const timeoutId = window.setTimeout(() => {
      void onSaveDisplayName(nextDisplayName);
    }, 700);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [draft.name, onSaveDisplayName, settings.name]);

  useEffect(() => {
    if (displayNameSaveState !== 'saving') {
      return;
    }

    if (draft.name.trim() !== settings.name.trim()) {
      return;
    }

    setDisplayNameSaveState('saved');
    const timeoutId = window.setTimeout(() => {
      setDisplayNameSaveState('idle');
    }, 1400);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [displayNameSaveState, draft.name, settings.name]);

  useEffect(() => {
    setLastSuccessfulGitHubTestToken(
      gitHubTestStatus === 'connected' ? settings.integrations.github.token.trim() : ''
    );
  }, [gitHubTestStatus, settings.integrations.github.token]);

  useEffect(() => {
    const hash = location.hash.replace(/^#/, '').trim();
    if (!hash) {
      return;
    }

    const scrollToTarget = () => {
      const element = document.getElementById(hash);
      if (!element) {
        return;
      }

      element.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    };

    window.requestAnimationFrame(scrollToTarget);
  }, [location.hash]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setIsSaving(true);
    setSaveMessage('');

    await onSave({
      ...draft,
      name: draft.name.trim(),
        integrations: {
          github: {
            username: draft.integrations.github.username.trim(),
            token: draft.integrations.github.token.trim(),
            ownerFilter: draft.integrations.github.ownerFilter.trim(),
            hiddenRepositories: draft.integrations.github.hiddenRepositories
          },
          jira: {
            baseUrl: draft.integrations.jira.baseUrl.trim(),
          email: draft.integrations.jira.email.trim(),
          apiToken: draft.integrations.jira.apiToken.trim()
        }
      }
    });

    setIsSaving(false);
    setSaveMessage('Settings saved to local extension storage.');
  }

  async function handleTestConnection() {
    setSaveMessage('');
    const status = await onTestGitHubConnection(draft.integrations.github.token);
    setLastSuccessfulGitHubTestToken(status === 'connected' ? draft.integrations.github.token.trim() : '');
  }

  async function handleTestJira() {
    setSaveMessage('');
    await onTestJiraConnection(
      draft.integrations.jira.baseUrl,
      draft.integrations.jira.email,
      draft.integrations.jira.apiToken
    );
  }

  async function handleDisplayNameBlur() {
    const nextDisplayName = draft.name.trim();
    if (nextDisplayName === settings.name.trim()) {
      return;
    }

    setDisplayNameSaveState('saving');
    await onSaveDisplayName(nextDisplayName);
  }

  async function handleShowRepositoryAgain(fullName: string) {
    const nextSettings: DashboardSettings = {
      ...draft,
      integrations: {
        ...draft.integrations,
        github: {
          ...draft.integrations.github,
          hiddenRepositories: draft.integrations.github.hiddenRepositories.filter(
            (entry) => entry.fullName !== fullName
          )
        }
      }
    };

    setDraft(nextSettings);
    setSaveMessage('');
    await onSave(nextSettings);
    setSaveMessage('Hidden repositories updated.');
  }

  const ownerOptions = getGitHubOwnerOptions({
    ownerOptions: gitHubOwnerOptions,
    selectedOwner: draft.integrations.github.ownerFilter,
    username: draft.integrations.github.username,
    isLoading: isLoadingGitHubOwnerOptions
  });
  const hasValidatedCurrentGitHubToken =
    gitHubTestStatus === 'connected' && draft.integrations.github.token.trim() === lastSuccessfulGitHubTestToken;
  const shouldShowOwnerFilter = hasValidatedCurrentGitHubToken;
  const hiddenRepositories = draft.integrations.github.hiddenRepositories;

  async function handleLoadGitHubOwnerOptions() {
    if (isLoadingGitHubOwnerOptionsRef.current) {
      return;
    }

    isLoadingGitHubOwnerOptionsRef.current = true;
    setIsLoadingGitHubOwnerOptions(true);

    try {
      await onLoadGitHubOwnerOptions({
        token: draft.integrations.github.token,
        username: draft.integrations.github.username
      });
    } finally {
      isLoadingGitHubOwnerOptionsRef.current = false;
      setIsLoadingGitHubOwnerOptions(false);
    }
  }

  return (
    <main className="min-h-screen px-5 py-6 text-stone-100 sm:px-8 lg:px-12">
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[0.7rem] uppercase tracking-[0.28em] text-textSoft">Settings</p>
            <h1 className="mt-2 text-[2rem] font-semibold tracking-[-0.04em] text-primary sm:text-[2.35rem]">
              Dashboard preferences
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-400">
              Manage general information and integration credentials for this extension. Values are stored in local extension storage.
            </p>
          </div>

          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-stone-100 transition hover:border-white/20 hover:bg-white/10"
          >
            Back
          </Link>
        </div>

        <form className="grid gap-6" onSubmit={handleSubmit}>
          <CardShell>
            <div className="mb-5">
              <p className="text-[0.7rem] uppercase tracking-[0.28em] text-textSoft">General</p>
              <h2 className="mt-2 text-xl font-medium text-stone-100">Name</h2>
            </div>

            <label className="block">
              <span className="mb-2 block text-sm text-stone-300">Display name</span>
              <input
                value={draft.name}
                onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                onBlur={() => void handleDisplayNameBlur()}
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-stone-100 outline-none transition placeholder:text-stone-500 focus:border-accent/50 focus:ring-1 focus:ring-accent/40"
                placeholder="Your name"
                maxLength={40}
              />
              {displayNameSaveState !== 'idle' ? (
                <span className="mt-2 block text-xs text-stone-500">
                  {displayNameSaveState === 'saving' ? 'Saving...' : 'Saved'}
                </span>
              ) : null}
            </label>

            {isGitHubDevModeAvailable ? (
              <label className="mt-5 flex items-start justify-between gap-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <div>
                  <span className="block text-sm text-stone-300">Enable dev mode</span>
                  <span className="mt-1 block text-sm leading-6 text-stone-400">
                    Uses stored mock GitHub data for dashboard testing. Scenario selection stays in the header menu.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={isGitHubDevModeEnabled}
                  onChange={(event) => void onSetGitHubDevMode(event.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-white/10 bg-black/20 text-accent focus:ring-accent/40"
                />
              </label>
            ) : null}
          </CardShell>

          <CardShell>
            <div className="mb-5">
              <p className="text-[0.7rem] uppercase tracking-[0.28em] text-textSoft">Integrations</p>
              <h2 className="mt-2 text-xl font-medium text-stone-100">GitHub</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-400">
                Save your GitHub username and personal access token, then verify the token against the GitHub API.
              </p>
            </div>

            <div className="space-y-4">
              <InfoBanner title="GitHub Token Required">
                <p>To connect GitHub, create a Personal Access Token (classic).</p>
                <ul className="mt-3 list-disc space-y-1 pl-5 text-indigo-100/90 marker:text-indigo-200/80">
                  <li>
                    Go to:{' '}
                    <a
                      href="https://github.com/settings/tokens"
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-100 underline decoration-indigo-200/50 underline-offset-4 transition hover:text-white"
                    >
                      https://github.com/settings/tokens
                    </a>
                  </li>
                  <li>Select: “Tokens (classic)”</li>
                  <li>Required scopes:</li>
                  <li className="list-none pl-1">repo</li>
                  <li className="list-none pl-1">notifications</li>
                  <li className="list-none pl-1">read:user</li>
                  <li className="list-none pl-1">read:org</li>
                </ul>
                <p className="mt-3 text-indigo-100/75">
                  Classic tokens are recommended for this app for simplicity.
                </p>
              </InfoBanner>

              <label className="block">
                <span className="mb-2 block text-sm text-stone-300">GitHub username</span>
                <input
                  value={draft.integrations.github.username}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      integrations: {
                        ...current.integrations,
                        github: {
                          ...current.integrations.github,
                          username: event.target.value
                        }
                      }
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-stone-100 outline-none transition placeholder:text-stone-500 focus:border-accent/50 focus:ring-1 focus:ring-accent/40"
                  placeholder="octocat"
                  autoComplete="off"
                  spellCheck={false}
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm text-stone-300">GitHub personal access token</span>
                <input
                  type="password"
                  value={draft.integrations.github.token}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      integrations: {
                        ...current.integrations,
                        github: {
                          ...current.integrations.github,
                          token: event.target.value
                        }
                      }
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-stone-100 outline-none transition placeholder:text-stone-500 focus:border-accent/50 focus:ring-1 focus:ring-accent/40"
                  placeholder="ghp_..."
                  autoComplete="off"
                  spellCheck={false}
                />
              </label>

              {shouldShowOwnerFilter ? (
                <label className="block">
                  <span className="mb-2 block text-sm text-stone-300">Dashboard owner or org</span>
                  <select
                    value={draft.integrations.github.ownerFilter.trim() || (ownerOptions.some((option) => option.value === 'all') ? 'all' : '__loading__')}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        integrations: {
                          ...current.integrations,
                          github: {
                            ...current.integrations.github,
                            ownerFilter:
                              event.target.value === 'all' || event.target.value === '__loading__'
                                ? ''
                                : event.target.value
                          }
                        }
                      }))
                    }
                    onFocus={() => void handleLoadGitHubOwnerOptions()}
                    onMouseDown={() => void handleLoadGitHubOwnerOptions()}
                    className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-stone-100 outline-none transition focus:border-accent/50 focus:ring-1 focus:ring-accent/40"
                  >
                    {ownerOptions.map((option) => (
                      <option
                        key={option.value}
                        value={option.value}
                        disabled={option.disabled}
                        className="bg-panel text-stone-100"
                      >
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-2 text-sm leading-6 text-stone-400">
                    Loads from GitHub when you open the dropdown. Leave it on All to keep your combined view.
                  </p>
                </label>
              ) : null}

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-2xl bg-accent px-4 py-3 text-sm font-medium text-stone-950 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isSaving ? 'Saving...' : 'Save settings'}
                </button>

                <button
                  type="button"
                  disabled={isTestingGitHub}
                  onClick={() => void handleTestConnection()}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-stone-100 transition hover:border-white/20 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isTestingGitHub ? 'Testing...' : 'Test connection'}
                </button>
              </div>

              <div className="rounded-2xl border border-white/5 bg-panelAlt/70 px-4 py-3 text-sm text-stone-300">
                <p>{TEST_STATUS_COPY[gitHubTestStatus]}</p>
                {saveMessage ? <p className="mt-2 text-stone-400">{saveMessage}</p> : null}
              </div>

              <div
                id="hidden-repositories"
                className="rounded-3xl border border-white/10 bg-black/20 p-4 scroll-mt-6"
              >
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-stone-100">Hidden repositories</h3>
                    <p className="mt-1 text-sm leading-6 text-stone-400">
                      Hidden repos stay out of the Spotlight search until you restore them here.
                    </p>
                  </div>
                  <span className="text-[0.7rem] uppercase tracking-[0.2em] text-stone-500">
                    {hiddenRepositories.length} hidden
                  </span>
                </div>

                {hiddenRepositories.length === 0 ? (
                  <p className="mt-4 text-sm text-stone-400">No repositories are hidden.</p>
                ) : (
                  <div className="mt-4 grid gap-3">
                    {hiddenRepositories
                      .slice()
                      .sort((left, right) => left.fullName.localeCompare(right.fullName))
                      .map((repository) => (
                        <div
                          key={repository.fullName}
                          className="flex flex-col gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-stone-100">
                              {repository.name}
                            </p>
                            <p className="truncate text-sm text-stone-400">
                              {repository.fullName}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => void handleShowRepositoryAgain(repository.fullName)}
                            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-stone-100 transition hover:border-white/20 hover:bg-white/10"
                          >
                            Show again
                          </button>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          </CardShell>

          <CardShell>
            <div className="mb-5">
              <p className="text-[0.7rem] uppercase tracking-[0.28em] text-textSoft">Integrations</p>
              <h2 className="mt-2 text-xl font-medium text-stone-100">Jira</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-400">
                Save your Jira site URL, email, and API token, then verify the credentials against the Jira API.
              </p>
            </div>

            <div className="space-y-4">
              <InfoBanner title="Jira API Token Required">
                <p>To connect Jira, create an API token from your Atlassian account.</p>
                <ul className="mt-3 list-disc space-y-1 pl-5 text-indigo-100/90 marker:text-indigo-200/80">
                  <li>
                    Go to:{' '}
                    <a
                      href="https://id.atlassian.com/manage-profile/security/api-tokens"
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-100 underline decoration-indigo-200/50 underline-offset-4 transition hover:text-white"
                    >
                      https://id.atlassian.com/manage-profile/security/api-tokens
                    </a>
                  </li>
                  <li>Click “Create API token”</li>
                  <li>Use your Jira email + API token (NOT your password)</li>
                  <li>Jira site URL should look like: https://your-company.atlassian.net</li>
                </ul>
              </InfoBanner>

              <label className="block">
                <span className="mb-2 block text-sm text-stone-300">Jira site URL</span>
                <input
                  value={draft.integrations.jira.baseUrl}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      integrations: {
                        ...current.integrations,
                        jira: {
                          ...current.integrations.jira,
                          baseUrl: event.target.value
                        }
                      }
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-stone-100 outline-none transition placeholder:text-stone-500 focus:border-accent/50 focus:ring-1 focus:ring-accent/40"
                  placeholder="https://company.atlassian.net"
                  autoComplete="off"
                  spellCheck={false}
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm text-stone-300">Jira email</span>
                <input
                  type="email"
                  value={draft.integrations.jira.email}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      integrations: {
                        ...current.integrations,
                        jira: {
                          ...current.integrations.jira,
                          email: event.target.value
                        }
                      }
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-stone-100 outline-none transition placeholder:text-stone-500 focus:border-accent/50 focus:ring-1 focus:ring-accent/40"
                  placeholder="you@company.com"
                  autoComplete="off"
                  spellCheck={false}
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm text-stone-300">Jira API token</span>
                <input
                  type="password"
                  value={draft.integrations.jira.apiToken}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      integrations: {
                        ...current.integrations,
                        jira: {
                          ...current.integrations.jira,
                          apiToken: event.target.value
                        }
                      }
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-stone-100 outline-none transition placeholder:text-stone-500 focus:border-accent/50 focus:ring-1 focus:ring-accent/40"
                  placeholder="Atlassian API token"
                  autoComplete="off"
                  spellCheck={false}
                />
              </label>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-2xl bg-accent px-4 py-3 text-sm font-medium text-stone-950 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isSaving ? 'Saving...' : 'Save settings'}
                </button>

                <button
                  type="button"
                  disabled={isTestingJira}
                  onClick={() => void handleTestJira()}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-stone-100 transition hover:border-white/20 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isTestingJira ? 'Testing...' : 'Test connection'}
                </button>
              </div>

              <div className="rounded-2xl border border-white/5 bg-panelAlt/70 px-4 py-3 text-sm text-stone-300">
                <p>{JIRA_TEST_STATUS_COPY[jiraTestStatus]}</p>
                {jiraErrorMessage ? <p className="mt-2 text-stone-400">{jiraErrorMessage}</p> : null}
                {saveMessage ? <p className="mt-2 text-stone-400">{saveMessage}</p> : null}
              </div>
            </div>
          </CardShell>
        </form>
      </div>
    </main>
  );
}

function getGitHubOwnerOptions({
  ownerOptions,
  selectedOwner,
  username,
  isLoading
}: {
  ownerOptions: string[];
  selectedOwner: string;
  username: string;
  isLoading: boolean;
}) {
  const owners = new Set<string>();

  for (const owner of ownerOptions) {
    const trimmedOwner = owner.trim();
    if (trimmedOwner) {
      owners.add(trimmedOwner);
    }
  }

  const trimmedUsername = username.trim();
  if (trimmedUsername) {
    owners.add(trimmedUsername);
  }

  const trimmedSelectedOwner = selectedOwner.trim();

  if (owners.size === 0 && isLoading) {
    const options = [];

    if (trimmedSelectedOwner && trimmedSelectedOwner !== 'all') {
      options.push({ value: trimmedSelectedOwner, label: trimmedSelectedOwner, disabled: false });
    }

    options.push({ value: '__loading__', label: 'Loading owners...', disabled: true });
    return options;
  }

  const sortedOwners = [...owners].sort((left, right) => left.localeCompare(right));
  const options = [{ value: 'all', label: 'All', disabled: false }];

  for (const owner of sortedOwners) {
    options.push({ value: owner, label: owner, disabled: false });
  }

  if (
    trimmedSelectedOwner &&
    trimmedSelectedOwner !== 'all' &&
    !options.some((option) => option.value === trimmedSelectedOwner)
  ) {
    options.push({ value: trimmedSelectedOwner, label: trimmedSelectedOwner, disabled: false });
  }

  return options;
}

function areSettingsIntegrationsEqual(
  left: DashboardSettings['integrations'],
  right: DashboardSettings['integrations'],
) {
  return (
    left.github.username === right.github.username &&
    left.github.token === right.github.token &&
    left.github.ownerFilter === right.github.ownerFilter &&
    areHiddenRepositoriesEqual(
      left.github.hiddenRepositories,
      right.github.hiddenRepositories,
    ) &&
    left.jira.baseUrl === right.jira.baseUrl &&
    left.jira.email === right.jira.email &&
    left.jira.apiToken === right.jira.apiToken
  );
}

function areHiddenRepositoriesEqual(
  left: DashboardSettings['integrations']['github']['hiddenRepositories'],
  right: DashboardSettings['integrations']['github']['hiddenRepositories'],
) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((repository, index) => {
    const rightRepository = right[index];

    return (
      rightRepository &&
      repository.id === rightRepository.id &&
      repository.name === rightRepository.name &&
      repository.fullName === rightRepository.fullName &&
      repository.owner === rightRepository.owner &&
      repository.url === rightRepository.url
    );
  });
}
