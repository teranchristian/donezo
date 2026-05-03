import { FocusEvent, useState } from 'react';
import { CardShell } from './CardShell';
import { type FocusItem } from '../lib/storage';

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
    <CardShell className="overflow-hidden">
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
          <FocusItemCard key={item.id} item={item} onRemove={() => onRemoveItem(item.id)} />
        ))}

        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onBlur={handleBlur}
          className={`rounded-[16px] border px-3.5 py-3 shadow-[inset_0_0_0_1px_rgba(139,92,246,0.08)] transition ${
            isDropTargetActive
              ? 'border-violet-400/40 bg-violet-500/[0.09]'
              : 'border-violet-500/18 bg-violet-500/[0.05]'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-violet-500/14 text-violet-200"
              aria-hidden="true"
            >
              <FocusDropZoneIcon />
            </span>
            <div className="min-w-0">
              <p className="text-[0.9rem] font-medium text-violet-100/92">Drag Jira tickets or PRs here</p>
              <p className="text-[0.78rem] leading-4.5 text-violet-200/50">to focus on them today</p>
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
  onRemove: () => void;
}) {
  const statusToneClass =
    item.statusTone === 'violet'
      ? 'bg-violet-500/16 text-violet-100'
      : item.statusTone === 'emerald'
        ? 'bg-emerald-500/16 text-emerald-100'
        : 'bg-amber-500/16 text-amber-100';

  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2.5 rounded-[16px] bg-[var(--card-bg-soft)] px-3.5 py-2.5 shadow-[var(--shadow-card-soft)]">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center" aria-hidden="true">
        {item.source === 'jira' ? <JiraItemIcon /> : <GitHubItemIcon />}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="shrink-0 text-[0.74rem] font-medium uppercase tracking-[0.12em] text-white/44">
            {item.sourceLabel}
          </span>
          <span className="shrink-0 text-[0.78rem] font-semibold text-primary">{item.reference}</span>
        </div>
        <p className="mt-1 line-clamp-2 text-[0.8rem] leading-5 text-white/72">{item.title}</p>
      </div>

      <div className="flex items-start gap-2">
        <span
          className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[0.62rem] font-semibold uppercase tracking-[0.12em] ${statusToneClass}`}
        >
          {item.statusLabel}
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 rounded-full p-1 text-white/34 transition hover:bg-white/[0.05] hover:text-white/62"
          aria-label={`Remove ${item.sourceLabel} ${item.reference} from Today focus`}
        >
          <CloseIcon />
        </button>
      </div>
    </div>
  );
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
    <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="m6.5 6.5 11 11m0-11-11 11" strokeLinecap="round" />
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
