import { FocusEvent, useState } from 'react';
import { CardShell } from './CardShell';
import { type FocusItem, type FocusJiraItem, type FocusPullRequestItem } from '../lib/storage';

export const TODAY_FOCUS_MAX_ITEMS = 3;
export const TODAY_FOCUS_DRAG_MIME = 'application/x-dashboard-today-focus-item';

type SummaryCardProps = {
  items: FocusItem[];
  limit?: number;
  warning?: string | null;
  onRemoveItem: (itemId: string) => void;
  onAddItem: (item: FocusItem) => void;
};

export function SummaryCard({
  items,
  limit = TODAY_FOCUS_MAX_ITEMS,
  warning,
  onRemoveItem,
  onAddItem
}: SummaryCardProps) {
  const [isDropTargetActive, setIsDropTargetActive] = useState(false);
  const visibleItems = items.slice(0, limit);

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDropTargetActive(false);

    const payload = event.dataTransfer.getData(TODAY_FOCUS_DRAG_MIME);
    if (!payload) {
      return;
    }

    try {
      const parsedItem = JSON.parse(payload) as FocusItem;
      onAddItem(parsedItem);
    } catch {
      return;
    }
  }

  function handleDragOver(event: React.DragEvent<HTMLDivElement>) {
    if (!event.dataTransfer.types.includes(TODAY_FOCUS_DRAG_MIME)) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }

  function handleDragEnter(event: React.DragEvent<HTMLDivElement>) {
    if (!event.dataTransfer.types.includes(TODAY_FOCUS_DRAG_MIME)) {
      return;
    }

    event.preventDefault();
    setIsDropTargetActive(true);
  }

  function handleDragLeave(event: React.DragEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setIsDropTargetActive(false);
    }
  }

  function handleBlur(event: FocusEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setIsDropTargetActive(false);
    }
  }

  return (
    <CardShell>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-500/14 text-violet-300"
              aria-hidden="true"
            >
              <FocusTargetIcon />
            </span>
            <h2 className="text-[0.95rem] font-medium text-primary sm:text-[1.02rem]">Today focus</h2>
          </div>
          <p className="mt-2 text-[0.82rem] leading-5 text-white/42">What do you want to close today?</p>
        </div>

        <span className="inline-flex shrink-0 items-center rounded-full bg-violet-500/16 px-3 py-1.5 text-[0.82rem] font-semibold text-violet-100 shadow-[inset_0_0_0_1px_rgba(139,92,246,0.18)]">
          {visibleItems.length} / {limit}
        </span>
      </div>

      <div className="mt-3.5 space-y-2">
        {visibleItems.map((item) => (
          <FocusItemCard key={item.id} item={item} onRemove={onRemoveItem} />
        ))}

        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onBlur={handleBlur}
          className={`rounded-[16px] border px-3 shadow-[inset_0_0_0_1px_rgba(139,92,246,0.08)] transition ${
            visibleItems.length > 0 ? 'py-2.5' : 'py-3'
          } ${
            isDropTargetActive
              ? 'border-violet-400/40 bg-violet-500/[0.09]'
              : 'border-violet-500/18 bg-violet-500/[0.05]'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <span
              className={`flex shrink-0 items-center justify-center rounded-[11px] bg-violet-500/14 text-violet-200 ${
                visibleItems.length > 0 ? 'h-8 w-8' : 'h-9 w-9'
              }`}
              aria-hidden="true"
            >
              <FocusDropZoneIcon />
            </span>
            <div className="min-w-0">
              <p className="text-[0.84rem] font-medium text-violet-100/92">Drag Jira tickets or PRs here</p>
              {visibleItems.length === 0 ? (
                <p className="text-[0.75rem] leading-4.5 text-violet-200/50">to focus on them today</p>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 text-[0.82rem] text-white/40">
          <span>Focus on up to {limit} items</span>
          <span className="text-[var(--text-tertiary)]" aria-hidden="true">
            <InfoIcon />
          </span>
        </div>
        {warning ? <p className="text-right text-xs font-medium text-amber-200">{warning}</p> : null}
      </div>
    </CardShell>
  );
}

function FocusItemCard({
  item,
  onRemove
}: {
  item: FocusItem;
  onRemove: (itemId: string) => void;
}) {
  if (item.source === 'jira') {
    return <FocusJiraCard item={item} onRemove={onRemove} />;
  }

  return <FocusPullRequestCard item={item} onRemove={() => onRemove(item.id)} isNested={false} />;
}

function FocusJiraCard({
  item,
  onRemove
}: {
  item: FocusJiraItem;
  onRemove: (itemId: string) => void;
}) {
  const statusToneClass = getStatusToneClass(item.statusTone);

  return (
    <div className="group rounded-[16px] bg-[var(--card-bg-soft)] px-3 py-2.5 shadow-[var(--shadow-card-soft)]">
      <div className="relative pr-8">
        <button
          type="button"
          onClick={() => onRemove(item.id)}
          className="absolute right-0 top-0 z-10 inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-black/20 text-white/70 shadow-[0_1px_8px_rgba(0,0,0,0.22)] transition hover:border-white/20 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/50"
          aria-label={`Remove ${item.sourceLabel} ${item.reference} from Today focus`}
        >
          <CloseIcon />
        </button>

        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center" aria-hidden="true">
            <JiraItemIcon />
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-start gap-2 pr-1">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="shrink-0 text-[0.63rem] font-medium uppercase tracking-[0.12em] text-white/34">
                    {item.sourceLabel}
                  </span>
                  <span className="shrink-0 text-[0.7rem] font-semibold text-white/62">{item.reference}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-[0.82rem] font-medium leading-4.5 text-primary">{item.title}</p>
              </div>

              {!item.isPlaceholder ? (
                <span
                  className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[0.55rem] font-medium uppercase tracking-[0.1em] ${statusToneClass}`}
                >
                  {item.statusLabel}
                </span>
              ) : null}
            </div>

            {item.isPlaceholder ? (
              <p className="mt-1 text-[0.68rem] text-amber-100/72">Parent created from linked PR</p>
            ) : null}

            {item.children.length > 0 ? (
              <div className="relative mt-2 space-y-1.5 pl-4 before:absolute before:bottom-1 before:left-[0.35rem] before:top-1 before:w-px before:bg-white/10">
                {item.children.map((child) => (
                  <FocusPullRequestCard key={child.id} item={child} onRemove={() => onRemove(child.id)} isNested />
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function FocusPullRequestCard({
  item,
  onRemove,
  isNested
}: {
  item: FocusPullRequestItem;
  onRemove: () => void;
  isNested: boolean;
}) {
  const statusToneClass = getStatusToneClass(item.statusTone);

  return (
    <div
      className={`group relative grid grid-cols-[auto_minmax(0,1fr)] items-start gap-2 rounded-[14px] pr-8 ${
        isNested ? 'bg-white/[0.03] px-2.5 py-2' : 'bg-[var(--card-bg-soft)] px-3 py-2.5 shadow-[var(--shadow-card-soft)]'
      }`}
    >
      <button
        type="button"
        onClick={onRemove}
        className="absolute right-2 top-2 z-10 inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-black/20 text-white/70 shadow-[0_1px_8px_rgba(0,0,0,0.22)] transition hover:border-white/20 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/50"
        aria-label={`Remove ${item.sourceLabel} ${item.reference} from Today focus`}
      >
        <CloseIcon />
      </button>

      <span className={`mt-0.5 flex shrink-0 items-center justify-center ${isNested ? 'h-6 w-6' : 'h-7 w-7'}`} aria-hidden="true">
        <GitHubItemIcon />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-start gap-2 pr-1">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="shrink-0 text-[0.62rem] font-medium uppercase tracking-[0.12em] text-white/34">
                {item.sourceLabel}
              </span>
              <span className="shrink-0 text-[0.68rem] font-semibold text-white/58">{item.reference}</span>
            </div>
            <p className="mt-1 line-clamp-2 text-[0.79rem] font-medium leading-4.5 text-primary">{item.title}</p>
          </div>

          <span
            className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[0.55rem] font-medium uppercase tracking-[0.1em] ${statusToneClass}`}
          >
            {item.statusLabel}
          </span>
        </div>

        {!item.jiraKey && !isNested ? (
          <div className="mt-1.5 flex items-center gap-1 text-[0.68rem] text-amber-100/72">
            <span className="shrink-0 text-amber-300/80" aria-hidden="true">
              <WarningIcon />
            </span>
            <span>No Jira ticket linked</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function getStatusToneClass(statusTone: FocusItem['statusTone']) {
  return statusTone === 'violet'
    ? 'bg-violet-500/16 text-violet-100'
    : statusTone === 'emerald'
      ? 'bg-emerald-500/16 text-emerald-100'
      : 'bg-amber-500/16 text-amber-100';
}

function FocusTargetIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9">
      <circle cx="12" cy="12" r="6.6" />
      <circle cx="12" cy="12" r="1.8" />
      <path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2" strokeLinecap="round" />
    </svg>
  );
}

function FocusDropZoneIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="currentColor">
      <circle cx="7" cy="7" r="1.7" />
      <circle cx="12" cy="7" r="1.7" />
      <circle cx="17" cy="7" r="1.7" />
      <circle cx="7" cy="12" r="1.7" />
      <circle cx="12" cy="12" r="1.7" />
      <circle cx="17" cy="12" r="1.7" />
      <circle cx="7" cy="17" r="1.7" />
      <circle cx="12" cy="17" r="1.7" />
      <circle cx="17" cy="17" r="1.7" />
    </svg>
  );
}

function JiraItemIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 text-sky-500" fill="currentColor">
      <path d="M12 3 21 12l-9 9-9-9 9-9Zm0 4.2L7.2 12 12 16.8 16.8 12 12 7.2Zm0 2.8 2 2-2 2-2-2 2-2Z" />
    </svg>
  );
}

function GitHubItemIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 text-white" fill="currentColor">
      <path d="M12 .7a11.3 11.3 0 0 0-3.57 22.03c.57.1.78-.25.78-.55v-2.15c-3.18.69-3.85-1.35-3.85-1.35-.52-1.3-1.28-1.65-1.28-1.65-1.04-.7.08-.68.08-.68 1.15.08 1.75 1.17 1.75 1.17 1.02 1.76 2.69 1.25 3.35.95.1-.74.4-1.25.72-1.53-2.54-.29-5.22-1.28-5.22-5.68 0-1.26.45-2.3 1.17-3.1-.12-.29-.5-1.47.11-3.06 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.62 1.59.24 2.77.12 3.06.73.8 1.17 1.84 1.17 3.1 0 4.41-2.69 5.39-5.25 5.67.42.36.78 1.06.78 2.15v3.18c0 .3.2.66.79.55A11.3 11.3 0 0 0 12 .7Z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="m6.5 6.5 11 11m0-11-11 11" strokeLinecap="round" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 4.5 20 19H4l8-14.5Z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 9.2v4.2" strokeLinecap="round" />
      <circle cx="12" cy="16.4" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 10v5" strokeLinecap="round" />
      <circle cx="12" cy="7.2" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  );
}
