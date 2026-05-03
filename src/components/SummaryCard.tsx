import { FocusEvent, useEffect, useState } from 'react';
import { CardShell } from './CardShell';
import { type FocusItem, type FocusJiraItem, type FocusPullRequestItem } from '../lib/storage';

export const TODAY_FOCUS_MAX_ITEMS = 3;
export const TODAY_FOCUS_DRAG_MIME = 'application/x-dashboard-today-focus-item';
export const TODAY_FOCUS_INTERNAL_DRAG_MIME = 'application/x-dashboard-today-focus-move';

type FocusInternalDragPayload = {
  itemId: string;
  parentId?: string;
  source: 'top-level' | 'child';
  itemSource: FocusItem['source'];
};

type SummaryCardProps = {
  items: FocusItem[];
  limit?: number;
  warning?: string | null;
  onRemoveItem: (itemId: string) => void;
  onAddItem: (item: FocusItem) => void;
  onNestNewPullRequest: (parentId: string, item: FocusPullRequestItem) => void;
  onNestExistingPullRequest: (parentId: string, itemId: string) => void;
  onReorderTopLevelItem: (itemId: string, targetId: string) => void;
  onMoveTopLevelItemToEnd: (itemId: string) => void;
  onReorderNestedPullRequest: (parentId: string, itemId: string, targetId: string) => void;
};

export function SummaryCard({
  items,
  limit = TODAY_FOCUS_MAX_ITEMS,
  warning,
  onRemoveItem,
  onAddItem,
  onNestNewPullRequest,
  onNestExistingPullRequest,
  onReorderTopLevelItem,
  onMoveTopLevelItemToEnd,
  onReorderNestedPullRequest
}: SummaryCardProps) {
  const [isDropTargetActive, setIsDropTargetActive] = useState(false);
  const [activeInternalDrag, setActiveInternalDrag] = useState<FocusInternalDragPayload | null>(null);
  const visibleItems = items.slice(0, limit);

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDropTargetActive(false);

    const internalDrag = activeInternalDrag ?? readInternalDragPayload(event.dataTransfer);
    if (internalDrag?.source === 'top-level') {
      onMoveTopLevelItemToEnd(internalDrag.itemId);
      setActiveInternalDrag(null);
      return;
    }

    const externalDrag = readExternalFocusItem(event.dataTransfer);
    if (!externalDrag) {
      return;
    }

    onAddItem(normalizeDroppedItem(externalDrag));
    setActiveInternalDrag(null);
  }

  function handleDragOver(event: React.DragEvent<HTMLDivElement>) {
    if (!isValidRootDrop(event.dataTransfer, activeInternalDrag)) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = activeInternalDrag ? 'move' : 'copy';
  }

  function handleDragEnter(event: React.DragEvent<HTMLDivElement>) {
    if (!isValidRootDrop(event.dataTransfer, activeInternalDrag)) {
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

  function handleInternalDragEnd() {
    setActiveInternalDrag(null);
    setIsDropTargetActive(false);
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

      <div className="mt-3.5 space-y-1.5">
        {visibleItems.map((item) => (
          <div key={item.id} className="space-y-1.5">
            <TopLevelReorderSlot
              activeInternalDrag={activeInternalDrag}
              targetId={item.id}
              onReorder={onReorderTopLevelItem}
            />
            <FocusItemCard
              item={item}
              onRemove={onRemoveItem}
              activeInternalDrag={activeInternalDrag}
              onInternalDragEnd={handleInternalDragEnd}
              onInternalDragStart={setActiveInternalDrag}
              onNestNewPullRequest={onNestNewPullRequest}
              onNestExistingPullRequest={onNestExistingPullRequest}
              onReorderNestedPullRequest={onReorderNestedPullRequest}
            />
          </div>
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
  onRemove,
  activeInternalDrag,
  onInternalDragEnd,
  onInternalDragStart,
  onNestNewPullRequest,
  onNestExistingPullRequest,
  onReorderNestedPullRequest
}: {
  item: FocusItem;
  onRemove: (itemId: string) => void;
  activeInternalDrag: FocusInternalDragPayload | null;
  onInternalDragEnd: () => void;
  onInternalDragStart: (payload: FocusInternalDragPayload) => void;
  onNestNewPullRequest: (parentId: string, item: FocusPullRequestItem) => void;
  onNestExistingPullRequest: (parentId: string, itemId: string) => void;
  onReorderNestedPullRequest: (parentId: string, itemId: string, targetId: string) => void;
}) {
  if (item.source === 'jira') {
    return (
      <FocusJiraCard
        item={item}
        onRemove={onRemove}
        activeInternalDrag={activeInternalDrag}
        onInternalDragEnd={onInternalDragEnd}
        onInternalDragStart={onInternalDragStart}
        onNestNewPullRequest={onNestNewPullRequest}
        onNestExistingPullRequest={onNestExistingPullRequest}
        onReorderNestedPullRequest={onReorderNestedPullRequest}
      />
    );
  }

  return (
    <FocusPullRequestCard
      item={item}
      onRemove={() => onRemove(item.id)}
      isNested={false}
      onInternalDragEnd={onInternalDragEnd}
      onInternalDragStart={onInternalDragStart}
    />
  );
}

function FocusJiraCard({
  item,
  onRemove,
  activeInternalDrag,
  onInternalDragEnd,
  onInternalDragStart,
  onNestNewPullRequest,
  onNestExistingPullRequest,
  onReorderNestedPullRequest
}: {
  item: FocusJiraItem;
  onRemove: (itemId: string) => void;
  activeInternalDrag: FocusInternalDragPayload | null;
  onInternalDragEnd: () => void;
  onInternalDragStart: (payload: FocusInternalDragPayload) => void;
  onNestNewPullRequest: (parentId: string, item: FocusPullRequestItem) => void;
  onNestExistingPullRequest: (parentId: string, itemId: string) => void;
  onReorderNestedPullRequest: (parentId: string, itemId: string, targetId: string) => void;
}) {
  const statusToneClass = getStatusToneClass(item.statusTone);
  const [isNestTargetActive, setIsNestTargetActive] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const hasLinkedPrs = item.children.length > 0;
  const shouldShowDropHint = isNestTargetActive || isHovered;
  const shouldExpandList = hasLinkedPrs && (isExpanded || isNestTargetActive);

  useEffect(() => {
    if (!hasLinkedPrs) {
      setIsExpanded(false);
    }
  }, [hasLinkedPrs]);

  function handleDragStart(event: React.DragEvent<HTMLDivElement>) {
    const payload = {
      itemId: item.id,
      source: 'top-level',
      itemSource: item.source
    } satisfies FocusInternalDragPayload;
    onInternalDragStart(payload);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData(
      TODAY_FOCUS_INTERNAL_DRAG_MIME,
      JSON.stringify(payload)
    );
    event.dataTransfer.setData('text/plain', item.reference);
  }

  function handleNestDragOver(event: React.DragEvent<HTMLDivElement>) {
    if (!isValidJiraNestTarget(event.dataTransfer, activeInternalDrag)) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = activeInternalDrag ? 'move' : 'copy';
  }

  function handleNestDragEnter(event: React.DragEvent<HTMLDivElement>) {
    if (!isValidJiraNestTarget(event.dataTransfer, activeInternalDrag)) {
      return;
    }

    event.preventDefault();
    setIsNestTargetActive(true);
    if (item.children.length > 0) {
      setIsExpanded(true);
    }
  }

  function handleNestDragLeave(event: React.DragEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setIsNestTargetActive(false);
    }
  }

  function handleNestDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsNestTargetActive(false);

    const internalDrag = activeInternalDrag ?? readInternalDragPayload(event.dataTransfer);
    if (internalDrag && internalDrag.source === 'top-level' && internalDrag.itemSource === 'github') {
      onNestExistingPullRequest(item.id, internalDrag.itemId);
      setIsExpanded(true);
      onInternalDragEnd();
      return;
    }

    const externalDrag = readExternalFocusItem(event.dataTransfer);
    if (externalDrag?.source === 'github') {
      onNestNewPullRequest(item.id, externalDrag);
      setIsExpanded(true);
    }
  }

  function handleNestBlur(event: FocusEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setIsNestTargetActive(false);
    }
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={onInternalDragEnd}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`rounded-[16px] border px-3 py-2.5 shadow-[var(--shadow-card-soft)] transition duration-200 ${
        isNestTargetActive
          ? 'border-violet-400/45 bg-violet-500/[0.08] shadow-[0_0_0_1px_rgba(167,139,250,0.16),0_14px_30px_rgba(76,29,149,0.22)]'
          : 'border-white/[0.05] bg-[var(--card-bg-soft)] hover:border-white/10'
      }`}
    >
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

              <div className="flex shrink-0 flex-col items-end gap-1">
                <span
                  className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[0.55rem] font-medium uppercase tracking-[0.1em] ${statusToneClass}`}
                >
                  {item.statusLabel}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (hasLinkedPrs) {
                      setIsExpanded((value) => !value);
                    }
                  }}
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[0.68rem] font-semibold transition ${
                    hasLinkedPrs
                      ? 'border-white/10 bg-white/[0.04] text-white/72 hover:border-violet-300/35 hover:bg-violet-400/[0.08] hover:text-violet-100'
                      : 'cursor-default border-white/[0.06] bg-white/[0.02] text-white/45'
                  }`}
                  aria-expanded={hasLinkedPrs ? shouldExpandList : false}
                  aria-label={
                    hasLinkedPrs
                      ? `${shouldExpandList ? 'Collapse' : 'Expand'} linked pull requests for ${item.reference}`
                      : `No linked pull requests for ${item.reference}`
                  }
                >
                  <span>{getPullRequestCountLabel(item.children.length)}</span>
                  {hasLinkedPrs ? <ChevronIcon isExpanded={shouldExpandList} /> : null}
                </button>
              </div>
            </div>

            <div className="mt-2">
              <div className="mb-2 flex items-center gap-3 text-[0.72rem]">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="shrink-0 font-medium text-white/52">{`Linked PRs (${item.children.length})`}</span>
                  <span className="h-px flex-1 bg-white/[0.08]" aria-hidden="true" />
                </div>
                <span className="shrink-0 font-semibold text-violet-200/88">+ Drop PR here</span>
              </div>

              <div
                className={`flex min-h-[3.9rem] items-center justify-between gap-2 rounded-[12px] border border-dashed px-2.5 py-2 transition duration-200 ${
                  isNestTargetActive
                    ? 'border-violet-300/55 bg-violet-400/[0.09] text-violet-100'
                    : shouldShowDropHint
                      ? 'border-violet-400/30 bg-violet-500/[0.04] text-violet-100/88'
                      : 'border-violet-400/20 bg-violet-500/[0.03] text-white/38'
                }`}
                onDrop={handleNestDrop}
                onDragOver={handleNestDragOver}
                onDragEnter={handleNestDragEnter}
                onDragLeave={handleNestDragLeave}
                onBlur={handleNestBlur}
              >
                <div className="min-w-0">
                  <p className={`text-[0.64rem] ${isNestTargetActive ? 'text-violet-100/72' : shouldShowDropHint ? 'text-violet-100/60' : 'text-white/28'}`}>
                    {isNestTargetActive ? `Drop PR into ${item.reference}` : 'Hover or drag a PR onto this ticket'}
                  </p>
                </div>
                <span className="shrink-0 text-violet-200/85" aria-hidden="true">
                  <DropArrowIcon />
                </span>
              </div>
            </div>

            {item.children.length > 0 ? (
              <div
                className={`grid transition-[grid-template-rows,opacity,margin] duration-200 ease-out ${
                  shouldExpandList ? 'mt-2 grid-rows-[1fr] opacity-100' : 'mt-0 grid-rows-[0fr] opacity-0'
                }`}
              >
                <div className="overflow-hidden">
                  <div className="rounded-[13px] border border-white/[0.06] bg-black/12 p-1.5">
                    <div
                      className="max-h-40 overflow-y-auto pr-1"
                      onDrop={handleNestDrop}
                      onDragOver={handleNestDragOver}
                      onDragEnter={handleNestDragEnter}
                      onDragLeave={handleNestDragLeave}
                      onBlur={handleNestBlur}
                    >
                      {item.children.map((child) => (
                        <div key={child.id} className="space-y-1">
                          <NestedPullRequestReorderSlot
                            activeInternalDrag={activeInternalDrag}
                            parentId={item.id}
                            targetId={child.id}
                            onReorder={onReorderNestedPullRequest}
                          />
                          <FocusPullRequestCard
                            item={child}
                            onRemove={() => onRemove(child.id)}
                            isNested
                            parentId={item.id}
                            onInternalDragEnd={onInternalDragEnd}
                            onInternalDragStart={onInternalDragStart}
                          />
                        </div>
                      ))}
                      <NestedPullRequestReorderSlot
                        activeInternalDrag={activeInternalDrag}
                        parentId={item.id}
                        targetId={getNestedEndTargetId(item.id)}
                        onReorder={onReorderNestedPullRequest}
                      />
                    </div>
                  </div>
                </div>
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
  isNested,
  parentId,
  onInternalDragEnd,
  onInternalDragStart
}: {
  item: FocusPullRequestItem;
  onRemove: () => void;
  isNested: boolean;
  parentId?: string;
  onInternalDragEnd: () => void;
  onInternalDragStart: (payload: FocusInternalDragPayload) => void;
}) {
  const statusToneClass = getStatusToneClass(item.statusTone);

  function handleDragStart(event: React.DragEvent<HTMLDivElement>) {
    const payload = {
      itemId: item.id,
      source: isNested ? 'child' : 'top-level',
      parentId,
      itemSource: item.source
    } satisfies FocusInternalDragPayload;
    onInternalDragStart(payload);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData(
      TODAY_FOCUS_INTERNAL_DRAG_MIME,
      JSON.stringify(payload)
    );
    event.dataTransfer.setData('text/plain', item.reference);
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={onInternalDragEnd}
      className={`relative grid grid-cols-[auto_minmax(0,1fr)] items-start gap-2 pr-8 ${
        isNested ? 'rounded-[10px] border border-white/[0.04] bg-white/[0.03] px-2 py-1.5 transition hover:border-white/10 hover:bg-white/[0.05]' : 'rounded-[14px] bg-[var(--card-bg-soft)] px-3 py-2.5 shadow-[var(--shadow-card-soft)]'
      }`}
    >
      <button
        type="button"
        onClick={onRemove}
        className={`absolute z-10 inline-flex items-center justify-center rounded-full border border-white/10 bg-black/20 text-white/70 shadow-[0_1px_8px_rgba(0,0,0,0.22)] transition hover:border-white/20 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/50 ${
          isNested ? 'right-1.5 top-1.5 h-5 w-5' : 'right-2 top-2 h-6 w-6'
        }`}
        aria-label={`Remove ${item.sourceLabel} ${item.reference} from Today focus`}
      >
        <CloseIcon />
      </button>

      <span className={`mt-0.5 flex shrink-0 items-center justify-center ${isNested ? 'h-5 w-5' : 'h-7 w-7'}`} aria-hidden="true">
        <GitHubItemIcon />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-start gap-2 pr-1">
          <div className="min-w-0 flex-1">
            {isNested ? (
              <>
                <div className="flex min-w-0 items-center gap-2">
                  <span className="shrink-0 text-[0.69rem] font-semibold text-white/74">{item.reference}</span>
                  <span className={`inline-flex h-2 w-2 shrink-0 rounded-full ${getStatusDotClass(item.statusTone)}`} aria-hidden="true" />
                  <span className="truncate text-[0.61rem] font-medium uppercase tracking-[0.1em] text-white/42">
                    {item.statusLabel}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-[0.75rem] font-medium leading-4 text-primary">{item.title}</p>
              </>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="shrink-0 text-[0.62rem] font-medium uppercase tracking-[0.12em] text-white/34">
                    {item.sourceLabel}
                  </span>
                  <span className="shrink-0 text-[0.68rem] font-semibold text-white/58">{item.reference}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-[0.79rem] font-medium leading-4.5 text-primary">{item.title}</p>
              </>
            )}
          </div>

          {!isNested ? (
            <span
              className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[0.55rem] font-medium uppercase tracking-[0.1em] ${statusToneClass}`}
            >
              {item.statusLabel}
            </span>
          ) : null}
        </div>

        {!isNested ? (
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

function TopLevelReorderSlot({
  activeInternalDrag,
  targetId,
  onReorder
}: {
  activeInternalDrag: FocusInternalDragPayload | null;
  targetId: string;
  onReorder: (itemId: string, targetId: string) => void;
}) {
  const [isActive, setIsActive] = useState(false);

  function handleDragOver(event: React.DragEvent<HTMLDivElement>) {
    const dragPayload = activeInternalDrag ?? readInternalDragPayload(event.dataTransfer);
    if (!dragPayload || dragPayload.source !== 'top-level' || dragPayload.itemId === targetId) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }

  function handleDragEnter(event: React.DragEvent<HTMLDivElement>) {
    const dragPayload = activeInternalDrag ?? readInternalDragPayload(event.dataTransfer);
    if (!dragPayload || dragPayload.source !== 'top-level' || dragPayload.itemId === targetId) {
      return;
    }

    event.preventDefault();
    setIsActive(true);
  }

  function handleDragLeave(event: React.DragEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setIsActive(false);
    }
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsActive(false);

    const dragPayload = activeInternalDrag ?? readInternalDragPayload(event.dataTransfer);
    if (!dragPayload || dragPayload.source !== 'top-level' || dragPayload.itemId === targetId) {
      return;
    }

    onReorder(dragPayload.itemId, targetId);
  }

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      className={`h-2 rounded-full transition ${isActive ? 'bg-violet-400/40' : 'bg-transparent'}`}
      aria-hidden="true"
    />
  );
}

function NestedPullRequestReorderSlot({
  activeInternalDrag,
  parentId,
  targetId,
  onReorder
}: {
  activeInternalDrag: FocusInternalDragPayload | null;
  parentId: string;
  targetId: string;
  onReorder: (parentId: string, itemId: string, targetId: string) => void;
}) {
  const [isActive, setIsActive] = useState(false);

  function handleDragOver(event: React.DragEvent<HTMLDivElement>) {
    const dragPayload = activeInternalDrag ?? readInternalDragPayload(event.dataTransfer);
    if (
      !dragPayload ||
      dragPayload.source !== 'child' ||
      dragPayload.parentId !== parentId ||
      dragPayload.itemId === targetId
    ) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }

  function handleDragEnter(event: React.DragEvent<HTMLDivElement>) {
    const dragPayload = activeInternalDrag ?? readInternalDragPayload(event.dataTransfer);
    if (
      !dragPayload ||
      dragPayload.source !== 'child' ||
      dragPayload.parentId !== parentId ||
      dragPayload.itemId === targetId
    ) {
      return;
    }

    event.preventDefault();
    setIsActive(true);
  }

  function handleDragLeave(event: React.DragEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setIsActive(false);
    }
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsActive(false);

    const dragPayload = activeInternalDrag ?? readInternalDragPayload(event.dataTransfer);
    if (
      !dragPayload ||
      dragPayload.source !== 'child' ||
      dragPayload.parentId !== parentId ||
      dragPayload.itemId === targetId
    ) {
      return;
    }

    onReorder(parentId, dragPayload.itemId, targetId);
  }

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      className={`h-1.5 rounded-full transition ${isActive ? 'bg-violet-400/35' : 'bg-transparent'}`}
      aria-hidden="true"
    />
  );
}

function getNestedEndTargetId(parentId: string) {
  return `__end__:${parentId}`;
}

function isValidRootDrop(dataTransfer: DataTransfer, activeInternalDrag: FocusInternalDragPayload | null) {
  if (dataTransfer.types.includes(TODAY_FOCUS_DRAG_MIME)) {
    return true;
  }

  const internalDrag = activeInternalDrag ?? readInternalDragPayload(dataTransfer);
  if (internalDrag) {
    return internalDrag.source === 'top-level';
  }

  return false;
}

function isValidJiraNestTarget(dataTransfer: DataTransfer, activeInternalDrag: FocusInternalDragPayload | null) {
  const internalDrag = activeInternalDrag ?? readInternalDragPayload(dataTransfer);
  if (internalDrag) {
    return internalDrag.source === 'top-level' && internalDrag.itemSource === 'github';
  }

  return dataTransfer.types.includes(TODAY_FOCUS_DRAG_MIME);
}

function readExternalFocusItem(dataTransfer: DataTransfer): FocusItem | null {
  const payload = dataTransfer.getData(TODAY_FOCUS_DRAG_MIME);
  if (!payload) {
    return null;
  }

  try {
    return JSON.parse(payload) as FocusItem;
  } catch {
    return null;
  }
}

function readInternalDragPayload(dataTransfer: DataTransfer): FocusInternalDragPayload | null {
  const payload = dataTransfer.getData(TODAY_FOCUS_INTERNAL_DRAG_MIME);
  if (!payload) {
    return null;
  }

  try {
    return JSON.parse(payload) as FocusInternalDragPayload;
  } catch {
    return null;
  }
}

function normalizeDroppedItem(item: FocusItem): FocusItem {
  return item.source === 'jira'
    ? {
        ...item,
        children: item.children ?? []
      }
    : item;
}

function getStatusToneClass(statusTone: FocusItem['statusTone']) {
  return statusTone === 'violet'
    ? 'bg-violet-500/16 text-violet-100'
    : statusTone === 'emerald'
      ? 'bg-emerald-500/16 text-emerald-100'
      : 'bg-amber-500/16 text-amber-100';
}

function getStatusDotClass(statusTone: FocusItem['statusTone']) {
  return statusTone === 'violet'
    ? 'bg-violet-300'
    : statusTone === 'emerald'
      ? 'bg-emerald-300'
      : 'bg-amber-300';
}

function getPullRequestCountLabel(count: number) {
  return `${count} PR${count === 1 ? '' : 's'}`;
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
    <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="m6.5 6.5 11 11m0-11-11 11" strokeLinecap="round" />
    </svg>
  );
}

function ChevronIcon({ isExpanded }: { isExpanded: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-3.5 w-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="m7 10 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DropArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path d="M12 5.5v9.5" strokeLinecap="round" />
      <path d="m7.5 11.5 4.5 4.5 4.5-4.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 19h14" strokeLinecap="round" />
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
