import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CardShell } from '../components/CardShell';
import { InfoBanner } from '../components/InfoBanner';
import { GitHubConnectionStatus } from '../lib/githubApi';
import { JiraConnectionStatus } from '../lib/jiraApi';
import { DashboardSettings } from '../lib/storage';

type SettingsPageProps = {
  settings: DashboardSettings;
  gitHubOwnerOptions: string[];
  onSave: (settings: DashboardSettings) => Promise<void>;
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
  onSave,
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
  const [draft, setDraft] = useState(settings);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [lastSuccessfulGitHubTestToken, setLastSuccessfulGitHubTestToken] = useState(
    gitHubTestStatus === 'connected' ? settings.integrations.github.token.trim() : ''
  );

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  useEffect(() => {
    setLastSuccessfulGitHubTestToken(
      gitHubTestStatus === 'connected' ? settings.integrations.github.token.trim() : ''
    );
  }, [gitHubTestStatus, settings.integrations.github.token]);

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
            ownerFilter: draft.integrations.github.ownerFilter.trim()
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

  const ownerOptions = getGitHubOwnerOptions(gitHubOwnerOptions, draft.integrations.github.ownerFilter);
  const hasValidatedCurrentGitHubToken =
    gitHubTestStatus === 'connected' && draft.integrations.github.token.trim() === lastSuccessfulGitHubTestToken;
  const shouldShowOwnerFilter = hasValidatedCurrentGitHubToken && ownerOptions.length > 0;

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
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-stone-100 outline-none transition placeholder:text-stone-500 focus:border-accent/50 focus:ring-1 focus:ring-accent/40"
                placeholder="Your name"
                maxLength={40}
              />
            </label>

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
                    value={draft.integrations.github.ownerFilter.trim() || 'all'}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        integrations: {
                          ...current.integrations,
                          github: {
                            ...current.integrations.github,
                            ownerFilter: event.target.value === 'all' ? '' : event.target.value
                          }
                        }
                      }))
                    }
                    className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-stone-100 outline-none transition focus:border-accent/50 focus:ring-1 focus:ring-accent/40"
                  >
                    {ownerOptions.map((option) => (
                      <option key={option.value} value={option.value} className="bg-panel text-stone-100">
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-2 text-sm leading-6 text-stone-400">
                    Loaded from GitHub after a successful connection test. Leave it on All to keep your combined view.
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

function getGitHubOwnerOptions(ownerOptions: string[], selectedOwner: string) {
  const owners = new Set<string>();

  for (const owner of ownerOptions) {
    const trimmedOwner = owner.trim();
    if (trimmedOwner) {
      owners.add(trimmedOwner);
    }
  }

  const trimmedSelectedOwner = selectedOwner.trim();
  const sortedOwners = [...owners].sort((left, right) => left.localeCompare(right));
  const options = [{ value: 'all', label: 'All' }];

  for (const owner of sortedOwners) {
    options.push({ value: owner, label: owner });
  }

  if (
    trimmedSelectedOwner &&
    trimmedSelectedOwner !== 'all' &&
    !options.some((option) => option.value === trimmedSelectedOwner)
  ) {
    options.push({ value: trimmedSelectedOwner, label: trimmedSelectedOwner });
  }

  return options;
}
