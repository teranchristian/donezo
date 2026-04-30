import { GitHubConnectionStatus } from '../lib/github';
import { CardShell } from './CardShell';
import { SectionHeading } from './SectionHeading';

type GitHubCardProps = {
  status: GitHubConnectionStatus;
  username: string;
};

const STATUS_COPY: Record<GitHubConnectionStatus, { label: string; tone: string; message: string }> = {
  'not-connected': {
    label: 'Not connected',
    tone: 'border-white/10 bg-white/5 text-stone-300',
    message: 'Add a personal access token in Settings to enable GitHub integration.'
  },
  testing: {
    label: 'Testing',
    tone: 'border-amber-300/20 bg-amber-200/10 text-amber-100',
    message: 'Checking the saved token against the GitHub API.'
  },
  connected: {
    label: 'Connected',
    tone: 'border-emerald-300/20 bg-emerald-200/10 text-emerald-100',
    message: 'Saved credentials passed the GitHub API connection test.'
  },
  invalid: {
    label: 'Invalid token',
    tone: 'border-rose-300/20 bg-rose-200/10 text-rose-100',
    message: 'GitHub returned 401 for the saved token. Update the token and test again.'
  },
  error: {
    label: 'Connection error',
    tone: 'border-amber-300/20 bg-amber-200/10 text-amber-100',
    message: 'The saved token could not be verified right now.'
  }
};

export function GitHubCard({ status, username }: GitHubCardProps) {
  const copy = STATUS_COPY[status];

  return (
    <CardShell>
      <SectionHeading
        eyebrow="Integration"
        title="GitHub"
        description="Connection status for the saved GitHub credentials."
      />

      <div className="space-y-4 rounded-[22px] border border-white/5 bg-panelAlt/80 p-5 shadow-glow">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm uppercase tracking-[0.28em] text-textSoft">Connection</p>
          <span className={`rounded-full border px-3 py-1 text-sm ${copy.tone}`}>{copy.label}</span>
        </div>

        <p className="text-sm leading-6 text-stone-300">{copy.message}</p>

        <div className="rounded-2xl border border-dashed border-white/10 bg-black/10 px-4 py-3">
          <p className="text-xs uppercase tracking-[0.2em] text-textSoft">Username</p>
          <p className="mt-2 text-sm text-stone-200">{username.trim() || 'Not set'}</p>
        </div>
      </div>
    </CardShell>
  );
}
