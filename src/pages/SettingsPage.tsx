import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CardShell } from '../components/CardShell';
import { InfoBanner } from '../components/InfoBanner';
import { GitHubConnectionStatus } from '../lib/github';
import { DashboardSettings } from '../lib/storage';

type SettingsPageProps = {
  settings: DashboardSettings;
  onSave: (settings: DashboardSettings) => Promise<void>;
  onTestConnection: (token: string) => Promise<GitHubConnectionStatus>;
  testStatus: GitHubConnectionStatus;
  isTesting: boolean;
};

const TEST_STATUS_COPY: Record<GitHubConnectionStatus, string> = {
  'not-connected': 'No token entered yet.',
  testing: 'Testing GitHub connection...',
  connected: 'GitHub connection succeeded.',
  invalid: 'GitHub rejected the token with a 401 response.',
  error: 'GitHub could not be reached or returned an unexpected response.'
};

export function SettingsPage({
  settings,
  onSave,
  onTestConnection,
  testStatus,
  isTesting
}: SettingsPageProps) {
  const [draft, setDraft] = useState(settings);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setIsSaving(true);
    setSaveMessage('');

    await onSave({
      ...draft,
      name: draft.name.trim() || 'Christian',
      integrations: {
        github: {
          username: draft.integrations.github.username.trim(),
          token: draft.integrations.github.token.trim()
        }
      }
    });

    setIsSaving(false);
    setSaveMessage('Settings saved to local extension storage.');
  }

  async function handleTestConnection() {
    setSaveMessage('');
    await onTestConnection(draft.integrations.github.token);
  }

  return (
    <main className="min-h-screen bg-page-glow px-5 py-6 text-stone-100 sm:px-8 lg:px-12">
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[0.7rem] uppercase tracking-[0.28em] text-textSoft">Settings</p>
            <h1 className="mt-2 font-display text-4xl tracking-tight text-stone-100 sm:text-5xl">
              Dashboard preferences
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-400">
              Manage general information and GitHub credentials for this extension. Values are stored in local extension storage.
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
                placeholder="Christian"
                maxLength={40}
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
                  disabled={isTesting}
                  onClick={() => void handleTestConnection()}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-stone-100 transition hover:border-white/20 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isTesting ? 'Testing...' : 'Test connection'}
                </button>
              </div>

              <div className="rounded-2xl border border-white/5 bg-panelAlt/70 px-4 py-3 text-sm text-stone-300">
                <p>{TEST_STATUS_COPY[testStatus]}</p>
                {saveMessage ? <p className="mt-2 text-stone-400">{saveMessage}</p> : null}
              </div>
            </div>
          </CardShell>
        </form>
      </div>
    </main>
  );
}
