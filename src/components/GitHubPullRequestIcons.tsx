import type { GitHubPullRequestItem } from '../lib/githubApi';

export function PullRequestCheckStatusIcon({
  ciStatus,
}: {
  ciStatus: GitHubPullRequestItem['ciStatus'];
}) {
  if (ciStatus === 'passing') {
    return (
      <span className="shrink-0 text-base leading-none text-emerald-400">
        ✓
      </span>
    );
  }

  if (ciStatus === 'failing') {
    return (
      <svg
        viewBox="0 0 16 16"
        aria-hidden="true"
        className="h-[1.08rem] w-[1.08rem] shrink-0 text-rose-500"
        fill="currentColor"
      >
        <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z" />
      </svg>
    );
  }

  if (ciStatus === 'pending') {
    return (
      <svg
        viewBox="0 0 16 16"
        aria-hidden="true"
        className="h-[0.8rem] w-[0.8rem] shrink-0 animate-spin text-amber-300/85"
        fill="none"
      >
        <circle
          cx="8"
          cy="8"
          r="5.25"
          className="text-amber-100/4"
          stroke="currentColor"
          strokeWidth="2.1"
        />
        <path
          d="M8 2.75a5.25 5.25 0 0 1 5.25 5.25"
          className="text-amber-300"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="2.35"
        />
      </svg>
    );
  }

  return null;
}

export function PullRequestReadyToMergeIcon() {
  return (
    <svg
      viewBox="0 0 12 12"
      aria-hidden="true"
      className="h-[0.8rem] w-[0.8rem] shrink-0 text-emerald-300"
      fill="currentColor"
    >
      <path d="M6 0a6 6 0 1 1 0 12A6 6 0 0 1 6 0Zm-.705 8.737L9.63 4.403 8.392 3.166 5.295 6.263l-1.7-1.702L2.356 5.8l2.938 2.938Z" />
    </svg>
  );
}

export function PullRequestQueueIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className="h-[0.82rem] w-[0.82rem] shrink-0"
      fill="currentColor"
    >
      <path d="M3.75 4.5a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5ZM3 7.75a.75.75 0 0 1 1.5 0v2.878a2.251 2.251 0 1 1-1.5 0Zm.75 5.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm5-7.75a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0Zm5.75 2.5a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-1.5 0a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0Z" />
    </svg>
  );
}

export function GitHubItemIcon({
  kind,
  isDraft = false,
}: {
  kind: 'pull-request' | 'issue' | 'commit' | 'discussion';
  isDraft?: boolean;
}) {
  if (kind === 'issue') {
    return (
      <svg
        viewBox="0 0 16 16"
        aria-hidden="true"
        className="h-4 w-4 flex-none text-emerald-400"
        fill="currentColor"
      >
        <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14Zm0-11.75a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm1 8.5v-5h-2v5h2Z" />
      </svg>
    );
  }

  if (kind === 'commit') {
    return (
      <svg
        viewBox="0 0 16 16"
        aria-hidden="true"
        className="h-4 w-4 flex-none text-amber-400"
        fill="currentColor"
      >
        <path d="M6.5 1.75a6.25 6.25 0 0 1 3 11.73v.77a.75.75 0 0 1-1.5 0v-.33a6.26 6.26 0 0 1-2-12.17v-.5a.75.75 0 0 1 1.5 0v.5c.33-.05.66-.07 1-.07Zm0 1.5a4.75 4.75 0 1 0 0 9.5 4.75 4.75 0 0 0 0-9.5Z" />
      </svg>
    );
  }

  if (kind === 'discussion') {
    return (
      <svg
        viewBox="0 0 16 16"
        aria-hidden="true"
        className="h-4 w-4 flex-none text-sky-400"
        fill="currentColor"
      >
        <path d="M1.75 3A2.25 2.25 0 0 1 4 0.75h8A2.25 2.25 0 0 1 14.25 3v5A2.25 2.25 0 0 1 12 10.25H8.56L5.53 13.1A.75.75 0 0 1 4.25 12.55v-2.3H4A2.25 2.25 0 0 1 1.75 8V3ZM4 2.25a.75.75 0 0 0-.75.75v5c0 .414.336.75.75.75H5a.75.75 0 0 1 .75.75v1.32l2.03-1.91a.75.75 0 0 1 .52-.16H12a.75.75 0 0 0 .75-.75V3a.75.75 0 0 0-.75-.75H4Z" />
      </svg>
    );
  }

  if (kind === 'pull-request' && isDraft) {
    return (
      <svg
        viewBox="0 0 16 16"
        aria-hidden="true"
        className="h-4 w-4 flex-none text-white/38"
        fill="currentColor"
      >
        <path d="M3.25 1A2.25 2.25 0 0 1 4 5.372v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.251 2.251 0 0 1 3.25 1Zm9.5 14a2.25 2.25 0 1 1 0-4.5 2.25 2.25 0 0 1 0 4.5ZM2.5 3.25a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0ZM3.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm9.5 0a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5ZM14 7.5a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0Zm0-4.25a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0Z" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className="h-4 w-4 flex-none text-emerald-400"
      fill="currentColor"
    >
      <path d="M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25Zm5.677-.177L9.573.677A.25.25 0 0 1 10 .854V2.5h1A2.5 2.5 0 0 1 13.5 5v5.628a2.251 2.251 0 1 1-1.5 0V5a1 1 0 0 0-1-1h-1v1.646a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354ZM3.75 2.5a.75.75 0 1 0 0 1.5.75.75.75 0 0 0 0-1.5Zm0 9.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm8.25.75a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Z" />
    </svg>
  );
}
