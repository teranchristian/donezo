type PullRequestCommentBadgeProps = {
  newCount: number;
  totalCount: number;
};

export function PullRequestCommentBadge({
  newCount,
  totalCount,
}: PullRequestCommentBadgeProps) {
  const label =
    newCount > 0
      ? `${newCount} new · ${totalCount} total`
      : `${totalCount} total`;

  return (
    <span
      className="inline-flex min-w-[5.5rem] items-center justify-center gap-1 px-2 py-0.5 text-[0.64rem] font-medium leading-none text-white/60"
      title={label}
    >
      <svg
        viewBox="0 0 16 16"
        aria-hidden="true"
        className={`h-3.5 w-3.5 shrink-0 ${newCount > 0 ? 'text-white' : 'text-white/42'}`}
        fill="currentColor"
      >
        <path d="M2.25 3.75A2.25 2.25 0 0 1 4.5 1.5h7a2.25 2.25 0 0 1 2.25 2.25v4.5A2.25 2.25 0 0 1 11.5 10.5H8.78l-2.5 2.1a.75.75 0 0 1-1.23-.57V10.5H4.5a2.25 2.25 0 0 1-2.25-2.25v-4.5Z" />
      </svg>
      {newCount > 0 ? (
        <span>
          <span className="font-bold text-white">{newCount} new</span>
          <span className="text-white/38"> {'·'} </span>
          <span>{totalCount} total</span>
        </span>
      ) : (
        <span>{totalCount} total</span>
      )}
    </span>
  );
}
