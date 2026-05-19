export function GitHubCardListItemSkeleton() {
  return (
    <div className="rounded-[14px] bg-[var(--card-bg-soft)] px-4 py-3 shadow-[var(--shadow-card-soft)]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="h-4 w-4/5 animate-pulse rounded bg-white/10" />
          <div className="mt-3 h-3 w-2/5 animate-pulse rounded bg-white/10" />
        </div>
        <div className="h-6 w-14 animate-pulse rounded-full bg-white/10" />
      </div>
      <div className="mt-4 h-3 w-24 animate-pulse rounded bg-white/10" />
    </div>
  );
}
