import { FocusEvent, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CardShell } from './CardShell';
import {
  MANUAL_FOCUS_TASK_NOTE_MAX_LENGTH,
  MANUAL_FOCUS_TASK_TITLE_MAX_LENGTH,
  type FocusItem,
  type FocusJiraItem,
  type FocusPullRequestItem,
  type ManualFocusTaskItem,
} from '../lib/storage';
import { FocusTargetIcon } from './TodayFocusIndicator';
import { getRepositoryLabel } from '../lib/githubCardDomain';
import { getJiraBrowseUrl, normalizeJiraBaseUrl } from '../lib/jiraApi';

export const TODAY_FOCUS_MAX_ITEMS = 3;
export const TODAY_FOCUS_DRAG_MIME = 'application/x-dashboard-today-focus-item';
export const TODAY_FOCUS_INTERNAL_DRAG_MIME = 'application/x-dashboard-today-focus-move';
const MANUAL_TASK_ROUTE_PARAM = 'manualTask';

type FocusInternalDragPayload = {
  itemId: string;
  parentId?: string;
  source: 'top-level' | 'child';
  itemSource: FocusItem['source'];
};

type TopLevelDropIndicator = {
  targetId: string;
  position: 'before' | 'after';
};

type ManualTaskEditorState =
  | {
      mode: 'create';
      title: string;
      note: string;
    }
  | {
      mode: 'preview';
      itemId: string;
      title: string;
      note: string;
    }
  | {
      mode: 'edit';
      itemId: string;
      title: string;
      note: string;
    };

type SummaryCardProps = {
  items: FocusItem[];
  jiraBaseUrl?: string;
  limit?: number;
  warning?: string | null;
  onRemoveItem: (itemId: string) => void;
  onAddItem: (item: FocusItem) => void;
  onCreateManualTask: (title: string, note: string) => boolean;
  onUpdateManualTask: (itemId: string, title: string, note: string) => boolean;
  onToggleManualTask: (itemId: string) => void;
  onNestNewPullRequest: (parentId: string, item: FocusPullRequestItem) => void;
  onNestExistingPullRequest: (parentId: string, itemId: string) => void;
  onReorderTopLevelItem: (itemId: string, targetId: string) => void;
  onMoveTopLevelItemToEnd: (itemId: string) => void;
  onReorderNestedPullRequest: (parentId: string, itemId: string, targetId: string) => void;
};

export function SummaryCard({
  items,
  jiraBaseUrl,
  limit = TODAY_FOCUS_MAX_ITEMS,
  warning,
  onRemoveItem,
  onAddItem,
  onCreateManualTask,
  onUpdateManualTask,
  onToggleManualTask,
  onNestNewPullRequest,
  onNestExistingPullRequest,
  onReorderTopLevelItem,
  onMoveTopLevelItemToEnd,
  onReorderNestedPullRequest
}: SummaryCardProps) {
  const [isDropTargetActive, setIsDropTargetActive] = useState(false);
  const [activeInternalDrag, setActiveInternalDrag] = useState<FocusInternalDragPayload | null>(null);
  const [activeTopLevelDropIndicator, setActiveTopLevelDropIndicator] = useState<TopLevelDropIndicator | null>(null);
  const [manualTaskEditorState, setManualTaskEditorState] = useState<ManualTaskEditorState | null>(null);
  const visibleItems = items.slice(0, limit);
  const manualTasks = items.filter(
    (item): item is ManualFocusTaskItem => item.source === 'manual',
  );

  useEffect(() => {
    function syncManualTaskEditorFromRoute() {
      const manualTaskId = getManualTaskRouteId();
      if (!manualTaskId) {
        setManualTaskEditorState((current) =>
          current && current.mode !== 'create' ? null : current,
        );
        return;
      }

      const task = manualTasks.find((item) => item.id === manualTaskId);
      if (!task) {
        clearManualTaskRoute();
        setManualTaskEditorState((current) =>
          current && current.mode !== 'create' ? null : current,
        );
        return;
      }

      setManualTaskEditorState((current) => {
        if (
          current &&
          current.mode !== 'create' &&
          current.itemId === task.id
        ) {
          return current;
        }

        return {
          mode: 'preview',
          itemId: task.id,
          title: task.title,
          note: task.note,
        };
      });
    }

    syncManualTaskEditorFromRoute();
    window.addEventListener('hashchange', syncManualTaskEditorFromRoute);
    return () => {
      window.removeEventListener('hashchange', syncManualTaskEditorFromRoute);
    };
  }, [manualTasks]);

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDropTargetActive(false);

    const internalDrag = activeInternalDrag ?? readInternalDragPayload(event.dataTransfer);
    if (internalDrag?.source === 'top-level') {
      setActiveInternalDrag(null);
      setActiveTopLevelDropIndicator(null);
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
    setActiveTopLevelDropIndicator(null);
  }

  function handleTopLevelCardDragOver(
    event: React.DragEvent<HTMLDivElement>,
    targetId: string,
  ) {
    const dragPayload = activeInternalDrag ?? readInternalDragPayload(event.dataTransfer);
    if (!dragPayload || dragPayload.source !== 'top-level' || dragPayload.itemId === targetId) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';

    const bounds = event.currentTarget.getBoundingClientRect();
    const position = event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after';
    setActiveTopLevelDropIndicator((current) =>
      current?.targetId === targetId && current.position === position
        ? current
        : { targetId, position },
    );
  }

  function handleTopLevelCardDragLeave(event: React.DragEvent<HTMLDivElement>, targetId: string) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setActiveTopLevelDropIndicator((current) =>
        current?.targetId === targetId ? null : current,
      );
    }
  }

  function handleTopLevelCardDrop(event: React.DragEvent<HTMLDivElement>, targetId: string) {
    event.preventDefault();

    const dragPayload = activeInternalDrag ?? readInternalDragPayload(event.dataTransfer);
    if (!dragPayload || dragPayload.source !== 'top-level' || dragPayload.itemId === targetId) {
      setActiveTopLevelDropIndicator(null);
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const position = event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after';
    applyTopLevelDrop({
      dragItemId: dragPayload.itemId,
      targetId,
      position,
      visibleItems,
      onReorderTopLevelItem,
      onMoveTopLevelItemToEnd
    });
    setActiveTopLevelDropIndicator(null);
    setActiveInternalDrag(null);
  }

  function handleToggleManualTaskNoteCheckbox(itemId: string, lineIndex: number) {
    const task = manualTasks.find((item) => item.id === itemId);
    if (!task) {
      return;
    }

    const nextNote = toggleMarkdownTaskListLine(task.note, lineIndex);
    if (nextNote === null || nextNote === task.note) {
      return;
    }

    onUpdateManualTask(itemId, task.title, nextNote);
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
          <div
            key={item.id}
            onDragOver={(event) => handleTopLevelCardDragOver(event, item.id)}
            onDragLeave={(event) => handleTopLevelCardDragLeave(event, item.id)}
            onDrop={(event) => handleTopLevelCardDrop(event, item.id)}
            className={`relative transition-[padding] duration-150 ${
              activeTopLevelDropIndicator?.targetId === item.id &&
              activeTopLevelDropIndicator.position === 'before'
                ? 'pt-3'
                : ''
            } ${
              activeTopLevelDropIndicator?.targetId === item.id &&
              activeTopLevelDropIndicator.position === 'after'
                ? 'pb-3'
                : ''
            }`}
          >
            <TopLevelInsertionIndicator
              isVisible={
                activeTopLevelDropIndicator?.targetId === item.id &&
                activeTopLevelDropIndicator.position === 'before'
              }
              position="top"
            />
            <FocusItemCard
              item={item}
              jiraBaseUrl={jiraBaseUrl}
              onRemove={onRemoveItem}
              onEditManualTask={(task) => {
                setManualTaskRoute(task.id);
              }}
              onToggleManualTask={onToggleManualTask}
              onToggleManualTaskNoteCheckbox={handleToggleManualTaskNoteCheckbox}
              activeManualTaskEditorId={
                manualTaskEditorState?.mode === 'edit'
                  ? manualTaskEditorState.itemId
                  : null
              }
              activeInternalDrag={activeInternalDrag}
              onInternalDragEnd={handleInternalDragEnd}
              onInternalDragStart={setActiveInternalDrag}
              onNestNewPullRequest={onNestNewPullRequest}
              onNestExistingPullRequest={onNestExistingPullRequest}
              onReorderNestedPullRequest={onReorderNestedPullRequest}
            />
            <TopLevelInsertionIndicator
              isVisible={
                activeTopLevelDropIndicator?.targetId === item.id &&
                activeTopLevelDropIndicator.position === 'after'
              }
              position="bottom"
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
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
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
            <button
              type="button"
              onClick={() =>
                setManualTaskEditorState({
                  mode: 'create',
                  title: '',
                  note: '',
                })
              }
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-violet-300/20 bg-violet-400/[0.08] px-3 py-1.5 text-[0.74rem] font-semibold text-violet-100 transition hover:border-violet-300/35 hover:bg-violet-400/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/50"
            >
              <PlusIcon />
              <span>Add task</span>
            </button>
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 text-[0.82rem] text-white/40">
          <span>Focus on up to {limit} items. Drag cards to reorder.</span>
          <span className="text-[var(--text-tertiary)]" aria-hidden="true">
            <InfoIcon />
          </span>
        </div>
        {warning ? <p className="text-right text-xs font-medium text-amber-200">{warning}</p> : null}
      </div>

      <ManualTaskEditorModal
        state={manualTaskEditorState}
        onClose={() => {
          if (
            manualTaskEditorState &&
            manualTaskEditorState.mode !== 'create'
          ) {
            clearManualTaskRoute();
            return;
          }

          setManualTaskEditorState(null);
        }}
        onStartEdit={(itemId, title, note) => {
          setManualTaskEditorState({
            mode: 'edit',
            itemId,
            title,
            note,
          });
        }}
        onBackToPreview={(itemId, title, note) => {
          setManualTaskEditorState({
            mode: 'preview',
            itemId,
            title,
            note,
          });
        }}
        onCreate={(title, note) => {
          if (onCreateManualTask(title, note)) {
            setManualTaskEditorState(null);
          }
        }}
        onToggleChecklist={(itemId, lineIndex) => {
          const task = manualTasks.find((item) => item.id === itemId);
          if (!task) {
            return;
          }

          const nextNote = toggleMarkdownTaskListLine(task.note, lineIndex);
          if (nextNote === null || nextNote === task.note) {
            return;
          }

          if (onUpdateManualTask(itemId, task.title, nextNote)) {
            setManualTaskEditorState((current) =>
              current &&
              current.mode === 'preview' &&
              current.itemId === itemId
                ? {
                    ...current,
                    note: nextNote,
                  }
                : current,
            );
          }
        }}
        onUpdate={(itemId, title, note) => {
          if (onUpdateManualTask(itemId, title, note)) {
            clearManualTaskRoute();
          }
        }}
      />
    </CardShell>
  );
}

function FocusItemCard({
  item,
  jiraBaseUrl,
  onRemove,
  onEditManualTask,
  onToggleManualTask,
  onToggleManualTaskNoteCheckbox,
  activeManualTaskEditorId,
  activeInternalDrag,
  onInternalDragEnd,
  onInternalDragStart,
  onNestNewPullRequest,
  onNestExistingPullRequest,
  onReorderNestedPullRequest
}: {
  item: FocusItem;
  jiraBaseUrl?: string;
  onRemove: (itemId: string) => void;
  onEditManualTask: (task: ManualFocusTaskItem) => void;
  onToggleManualTask: (itemId: string) => void;
  onToggleManualTaskNoteCheckbox: (itemId: string, lineIndex: number) => void;
  activeManualTaskEditorId: string | null;
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
        jiraBaseUrl={jiraBaseUrl}
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

  if (item.source === 'manual') {
    return (
      <ManualFocusTaskCard
        item={item}
        onEdit={() => onEditManualTask(item)}
        onRemove={() => onRemove(item.id)}
        onToggleComplete={() => onToggleManualTask(item.id)}
        onToggleNoteCheckbox={(lineIndex) =>
          onToggleManualTaskNoteCheckbox(item.id, lineIndex)
        }
        isNoteChecklistDisabled={activeManualTaskEditorId === item.id}
        onInternalDragEnd={onInternalDragEnd}
        onInternalDragStart={onInternalDragStart}
      />
    );
  }

  return (
    <FocusPullRequestCard
      item={item}
      jiraBaseUrl={jiraBaseUrl}
      onRemove={() => onRemove(item.id)}
      isNested={false}
      onInternalDragEnd={onInternalDragEnd}
      onInternalDragStart={onInternalDragStart}
    />
  );
}

function ManualFocusTaskCard({
  item,
  onEdit,
  onRemove,
  onToggleComplete,
  onToggleNoteCheckbox,
  isNoteChecklistDisabled,
  onInternalDragEnd,
  onInternalDragStart,
}: {
  item: ManualFocusTaskItem;
  onEdit: () => void;
  onRemove: () => void;
  onToggleComplete: () => void;
  onToggleNoteCheckbox: (lineIndex: number) => void;
  isNoteChecklistDisabled: boolean;
  onInternalDragEnd: () => void;
  onInternalDragStart: (payload: FocusInternalDragPayload) => void;
}) {
  const isCompleted = item.completedAt !== null;
  const notePreview = getManualTaskPreview(item.note);
  const previewBlocks = parseMarkdownBlocks(item.note);
  const checklistItems = previewBlocks
    .flatMap((block) => (block.type === 'task-list' ? block.items : []))
    .slice(0, 4);

  function handleDragStart(event: React.DragEvent<HTMLDivElement>) {
    const payload = {
      itemId: item.id,
      source: 'top-level',
      itemSource: item.source,
    } satisfies FocusInternalDragPayload;
    onInternalDragStart(payload);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData(
      TODAY_FOCUS_INTERNAL_DRAG_MIME,
      JSON.stringify(payload),
    );
    event.dataTransfer.setData('text/plain', item.title);
    setCustomDragImage(event.dataTransfer, event.currentTarget);
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={onInternalDragEnd}
      title="Drag to reorder"
      className={`cursor-grab rounded-[16px] border px-3 py-2.5 shadow-[var(--shadow-card-soft)] transition duration-200 active:cursor-grabbing ${
        isCompleted
          ? 'border-emerald-300/10 bg-emerald-500/[0.05]'
          : 'border-white/[0.05] bg-[var(--card-bg-soft)] hover:border-white/10'
      }`}
    >
      <div className="relative">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
          className="absolute right-0 top-0 z-10 inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-black/20 text-white/70 shadow-[0_1px_8px_rgba(0,0,0,0.22)] transition hover:border-white/20 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/50"
          aria-label={`Remove task ${item.title} from Today focus`}
        >
          <CloseIcon />
        </button>

        <div
          role="button"
          tabIndex={0}
          onClick={onEdit}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onEdit();
            }
          }}
          className="flex w-full items-start gap-2.5 pr-8 text-left"
        >
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onToggleComplete();
              }}
              className={`inline-flex h-6 w-6 items-center justify-center rounded-[8px] border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/50 ${
                isCompleted
                  ? 'border-emerald-300/30 bg-emerald-400/[0.18] text-emerald-50'
                  : 'border-white/14 bg-white/[0.04] text-white/42 hover:border-violet-300/35 hover:bg-violet-400/[0.08] hover:text-violet-100'
              }`}
              aria-label={`${isCompleted ? 'Mark task as incomplete' : 'Mark task as complete'}: ${item.title}`}
            >
              <TaskCheckboxIcon checked={isCompleted} />
            </button>
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-start gap-2 pr-1">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="shrink-0 text-white/28" aria-hidden="true">
                    <DragHandleIcon />
                  </span>
                  <span className="shrink-0 text-[0.63rem] font-medium uppercase tracking-[0.12em] text-white/34">
                    Manual task
                  </span>
                  {isCompleted ? (
                    <span className="inline-flex shrink-0 items-center rounded-full bg-emerald-500/14 px-2 py-0.5 text-[0.55rem] font-medium uppercase tracking-[0.1em] text-emerald-100">
                      Done
                    </span>
                  ) : null}
                </div>
                <p
                  className={`mt-1 line-clamp-2 text-[0.82rem] font-medium leading-4.5 ${
                    isCompleted ? 'text-white/52 line-through' : 'text-primary'
                  }`}
                >
                  {item.title}
                </p>
                {checklistItems.length > 0 ? (
                  <div className="mt-1.5 space-y-1">
                    {checklistItems.map((checklistItem, index) => (
                      <button
                        key={`${checklistItem.lineIndex}-${index}`}
                        type="button"
                        disabled={isNoteChecklistDisabled}
                        onClick={(event) => {
                          event.stopPropagation();
                          onToggleNoteCheckbox(checklistItem.lineIndex);
                        }}
                        className={`flex w-full items-start gap-2 text-left text-[0.72rem] leading-4 transition ${
                          isNoteChecklistDisabled
                            ? 'cursor-not-allowed text-white/32'
                            : 'text-secondary hover:text-white/84'
                        }`}
                      >
                        <span
                          className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border ${
                            checklistItem.checked
                              ? 'border-emerald-300/30 bg-emerald-400/[0.16] text-emerald-100'
                              : 'border-white/14 bg-white/[0.04] text-white/34'
                          }`}
                          aria-hidden="true"
                        >
                          <TaskCheckboxIcon checked={checklistItem.checked} />
                        </span>
                        <span
                          className={
                            checklistItem.checked ? 'text-white/52 line-through' : ''
                          }
                        >
                          {checklistItem.text}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
                {notePreview ? (
                  <p className="mt-1 line-clamp-2 text-[0.72rem] leading-4 text-secondary">
                    {notePreview}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FocusJiraCard({
  item,
  jiraBaseUrl,
  onRemove,
  activeInternalDrag,
  onInternalDragEnd,
  onInternalDragStart,
  onNestNewPullRequest,
  onNestExistingPullRequest,
  onReorderNestedPullRequest
}: {
  item: FocusJiraItem;
  jiraBaseUrl?: string;
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
  const hasLinkedPrs = item.children.length > 0;
  const jiraPrWarning = getJiraPrAlignmentWarning(item);
  const shouldExpandList = hasLinkedPrs && (isExpanded || isNestTargetActive);
  const issueUrl = getFocusItemUrl(item, jiraBaseUrl);

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
    setCustomDragImage(event.dataTransfer, event.currentTarget);
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
      onDrop={handleNestDrop}
      onDragOver={handleNestDragOver}
      onDragEnter={handleNestDragEnter}
      onDragLeave={handleNestDragLeave}
      onBlur={handleNestBlur}
      title="Drag to reorder"
      className={`cursor-grab rounded-[16px] border px-3 py-2.5 shadow-[var(--shadow-card-soft)] transition duration-200 active:cursor-grabbing ${
        isNestTargetActive
          ? 'border-dashed border-violet-400/45 bg-violet-500/[0.08] shadow-[0_0_0_1px_rgba(167,139,250,0.16),0_14px_30px_rgba(76,29,149,0.22)]'
          : 'border-white/[0.05] bg-[var(--card-bg-soft)] hover:border-white/10'
      }`}
    >
      <div className="relative">
        <button
          type="button"
          onClick={() => onRemove(item.id)}
          className="absolute right-0 top-0 z-10 inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-black/20 text-white/70 shadow-[0_1px_8px_rgba(0,0,0,0.22)] transition hover:border-white/20 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/50"
          aria-label={`Remove ${item.sourceLabel} ${item.reference} from Today focus`}
        >
          <CloseIcon />
        </button>

        <div className="flex items-start gap-2.5 pr-8">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center" aria-hidden="true">
            <JiraItemIcon />
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-start gap-2 pr-1">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="shrink-0 text-white/28" aria-hidden="true">
                    <DragHandleIcon />
                  </span>
                  <span className="shrink-0 text-[0.63rem] font-medium uppercase tracking-[0.12em] text-white/34">
                    {item.sourceLabel}
                  </span>
                  <FocusReferenceLink href={issueUrl} className="shrink-0 text-[0.7rem] font-semibold text-white/62">
                    {item.reference}
                  </FocusReferenceLink>
                </div>
                <p className="mt-1 line-clamp-2 text-[0.82rem] font-medium leading-4.5 text-primary">{item.title}</p>
              </div>

              <div className="flex shrink-0 flex-col items-end gap-1">
                <span
                  className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[0.55rem] font-medium uppercase tracking-[0.1em] ${statusToneClass}`}
                >
                  {item.statusLabel}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-2">
          {jiraPrWarning ? (
            <div className="mb-2 flex items-start gap-1.5 rounded-[12px] border border-amber-300/18 bg-amber-400/[0.08] px-2.5 py-2 text-[0.69rem] leading-4 text-amber-50/88">
              <span className="mt-0.25 shrink-0 text-amber-300/85" aria-hidden="true">
                <WarningIcon />
              </span>
              <span>{jiraPrWarning}</span>
            </div>
          ) : null}

          <div className="mb-2 flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                if (hasLinkedPrs) {
                  setIsExpanded((value) => !value);
                }
              }}
              className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-left text-[0.68rem] font-semibold transition ${
                hasLinkedPrs
                  ? 'border-white/10 bg-white/[0.04] text-white/88 hover:border-violet-300/35 hover:bg-violet-400/[0.08] hover:text-violet-100'
                  : 'cursor-default border-white/[0.06] bg-white/[0.02] text-white/45'
              }`}
              aria-expanded={hasLinkedPrs ? shouldExpandList : false}
              aria-label={
                hasLinkedPrs
                  ? `${shouldExpandList ? 'Collapse' : 'Expand'} linked pull requests for ${item.reference}`
                  : `No linked pull requests for ${item.reference}`
              }
            >
              {hasLinkedPrs ? <ChevronIcon isExpanded={shouldExpandList} /> : <span className="w-4" aria-hidden="true" />}
              <span>{`Linked PRs (${item.children.length})`}</span>
            </button>
            <span className="h-px min-w-0 flex-1 border-t border-dashed border-white/20" aria-hidden="true" />
          </div>

          {item.children.length > 0 ? (
            <div
              className={`grid transition-[grid-template-rows,opacity,margin] duration-200 ease-out ${
                shouldExpandList ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
              }`}
            >
              <div className="overflow-hidden">
                <div>
                  <div className="max-h-40 overflow-y-auto">
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
                          jiraBaseUrl={jiraBaseUrl}
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
  );
}

function FocusPullRequestCard({
  item,
  jiraBaseUrl,
  onRemove,
  isNested,
  parentId,
  onInternalDragEnd,
  onInternalDragStart
}: {
  item: FocusPullRequestItem;
  jiraBaseUrl?: string;
  onRemove: () => void;
  isNested: boolean;
  parentId?: string;
  onInternalDragEnd: () => void;
  onInternalDragStart: (payload: FocusInternalDragPayload) => void;
}) {
  const statusToneClass = getStatusToneClass(item.statusTone);
  const pullRequestUrl = getFocusItemUrl(item, jiraBaseUrl);
  const repositoryLabel = getRepositoryLabel(item.repositoryName);

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
    if (!isNested) {
      setCustomDragImage(event.dataTransfer, event.currentTarget);
    }
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={onInternalDragEnd}
      title={isNested ? undefined : 'Drag to reorder'}
      className={`relative grid grid-cols-[auto_minmax(0,1fr)] items-start gap-2 ${
        isNested ? 'pr-8' : 'cursor-grab pr-8 active:cursor-grabbing'
      } ${
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
                  <FocusReferenceLink href={pullRequestUrl} className="shrink-0 text-[0.69rem] font-semibold text-white/74">
                    {item.reference}
                  </FocusReferenceLink>
                  <span className={`inline-flex h-2 w-2 shrink-0 rounded-full ${getStatusDotClass(item.statusTone)}`} aria-hidden="true" />
                  <span className="truncate text-[0.61rem] font-medium uppercase tracking-[0.1em] text-white/42">
                    {item.statusLabel}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-[0.75rem] font-medium leading-4" title={item.title}>
                  <span className="mr-1 text-[0.66rem] font-normal text-secondary">
                    {repositoryLabel}
                  </span>
                  <span className="text-primary">{item.title}</span>
                </p>
              </>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="shrink-0 text-white/28" aria-hidden="true">
                    <DragHandleIcon />
                  </span>
                  <span className="shrink-0 text-[0.62rem] font-medium uppercase tracking-[0.12em] text-white/34">
                    {item.sourceLabel}
                  </span>
                  <FocusReferenceLink href={pullRequestUrl} className="shrink-0 text-[0.68rem] font-semibold text-white/58">
                    {item.reference}
                  </FocusReferenceLink>
                </div>
                <p className="mt-1 line-clamp-2 text-[0.79rem] font-medium leading-4.5" title={item.title}>
                  <span className="mr-1 text-[0.66rem] font-normal text-secondary">
                    {repositoryLabel}
                  </span>
                  <span className="text-primary">{item.title}</span>
                </p>
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

function applyTopLevelDrop({
  dragItemId,
  targetId,
  position,
  visibleItems,
  onReorderTopLevelItem,
  onMoveTopLevelItemToEnd
}: {
  dragItemId: string;
  targetId: string;
  position: 'before' | 'after';
  visibleItems: FocusItem[];
  onReorderTopLevelItem: (itemId: string, targetId: string) => void;
  onMoveTopLevelItemToEnd: (itemId: string) => void;
}) {
  if (dragItemId === targetId) {
    return;
  }

  if (position === 'before') {
    onReorderTopLevelItem(dragItemId, targetId);
    return;
  }

  const targetIndex = visibleItems.findIndex((item) => item.id === targetId);
  if (targetIndex < 0) {
    return;
  }

  const nextItem = visibleItems[targetIndex + 1];
  if (!nextItem) {
    onMoveTopLevelItemToEnd(dragItemId);
    return;
  }

  onReorderTopLevelItem(dragItemId, nextItem.id);
}

function TopLevelInsertionIndicator({
  isVisible,
  position
}: {
  isVisible: boolean;
  position: 'top' | 'bottom';
}) {
  return (
    <div
      className={`pointer-events-none absolute left-2 right-2 z-20 transition-opacity duration-150 ${
        position === 'top' ? 'top-0 -translate-y-1/2' : 'bottom-0 translate-y-1/2'
      } ${isVisible ? 'opacity-100' : 'opacity-0'}`}
      aria-hidden="true"
    >
      <div className="h-1 rounded-full bg-violet-400/80 shadow-[0_0_0_1px_rgba(167,139,250,0.2),0_0_18px_rgba(139,92,246,0.3)]" />
    </div>
  );
}

function ManualTaskEditorModal({
  state,
  onClose,
  onStartEdit,
  onBackToPreview,
  onCreate,
  onToggleChecklist,
  onUpdate,
}: {
  state: ManualTaskEditorState | null;
  onClose: () => void;
  onStartEdit: (itemId: string, title: string, note: string) => void;
  onBackToPreview: (itemId: string, title: string, note: string) => void;
  onCreate: (title: string, note: string) => void;
  onToggleChecklist: (itemId: string, lineIndex: number) => void;
  onUpdate: (itemId: string, title: string, note: string) => void;
}) {
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [isCompactLayout, setIsCompactLayout] = useState(
    typeof window !== 'undefined' ? window.innerWidth < 1025 : false,
  );
  const [compactMode, setCompactMode] = useState<'edit' | 'preview'>('edit');
  const isPreviewMode = state?.mode === 'preview';
  const isCreateMode = state?.mode === 'create';
  const isEditableMode = state?.mode === 'create' || state?.mode === 'edit';

  useEffect(() => {
    if (!state) {
      return;
    }

    setTitle(state.title);
    setNote(state.note);
    setCompactMode(state.mode === 'preview' ? 'preview' : 'edit');
  }, [state]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    function updateLayoutMode() {
      setIsCompactLayout(window.innerWidth < 1025);
    }

    updateLayoutMode();
    window.addEventListener('resize', updateLayoutMode);
    return () => window.removeEventListener('resize', updateLayoutMode);
  }, []);

  useEffect(() => {
    if (!state) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state, onClose]);

  useEffect(() => {
    if (!state) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [state]);

  if (!state) {
    return null;
  }

  const normalizedTitle = title.trim().slice(0, MANUAL_FOCUS_TASK_TITLE_MAX_LENGTH);
  const normalizedNote = note.slice(0, MANUAL_FOCUS_TASK_NOTE_MAX_LENGTH);
  const canSubmit = normalizedTitle.length > 0;
  const previewBlocks = parseMarkdownBlocks(normalizedNote.trim());
  const showSplitEditor = isEditableMode;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 lg:p-6" role="dialog" aria-modal="true">
      <button
        type="button"
        className="absolute inset-0 bg-[#06080d]/78 backdrop-blur-[2px]"
        aria-label="Close task editor"
        onClick={onClose}
      />
      <div className="relative z-10 flex h-[min(88vh,860px)] w-full max-w-5xl flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[#10151d] shadow-[0_32px_90px_rgba(0,0,0,0.5)] sm:h-[min(86vh,880px)]">
        <div className="flex items-start justify-between gap-4 border-b border-white/8 px-5 py-4 sm:px-6">
          <div>
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-violet-200/68">
              {isCreateMode ? 'New manual task' : 'Manual task'}
            </p>
            <h3 className="mt-1 text-[1.05rem] font-semibold text-primary">
              {isCreateMode
                ? 'Add focus task'
                : isPreviewMode
                  ? 'Task preview'
                  : 'Task details'}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/70 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
              aria-label="Close task editor"
            >
              <CloseIcon />
            </button>
          </div>
        </div>

        <div
          className={`min-h-0 flex-1 ${
            showSplitEditor
              ? 'grid gap-0 lg:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.9fr)]'
              : 'flex flex-col'
          }`}
        >
          <div
            className={`min-h-0 px-5 py-5 sm:px-6 ${
              showSplitEditor && isCompactLayout
                ? compactMode === 'edit'
                  ? 'flex flex-col'
                  : 'hidden'
                : 'flex flex-col'
            }`}
          >
            {isEditableMode ? (
              <>
                <label className="block">
                  <span className="mb-2 block text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-white/42">
                    Title
                  </span>
                  <input
                    type="text"
                    value={title}
                    onChange={(event) =>
                      setTitle(event.target.value.slice(0, MANUAL_FOCUS_TASK_TITLE_MAX_LENGTH))
                    }
                    placeholder="Check how xyz works"
                    className="w-full rounded-[14px] border border-white/10 bg-white/[0.04] px-3.5 py-3 text-[0.92rem] text-primary outline-none transition placeholder:text-white/25 focus:border-violet-300/35 focus:bg-violet-500/[0.05]"
                  />
                  <span className="mt-1.5 block text-right text-[0.69rem] text-white/34">
                    {title.length} / {MANUAL_FOCUS_TASK_TITLE_MAX_LENGTH}
                  </span>
                </label>

                <label className="mt-5 flex min-h-0 flex-1 flex-col">
                  <span className="mb-2 block text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-white/42">
                    Note
                  </span>
                  <textarea
                    value={note}
                    onChange={(event) =>
                      setNote(event.target.value.slice(0, MANUAL_FOCUS_TASK_NOTE_MAX_LENGTH))
                    }
                    placeholder={'## Context\n- Investigate how this works\n- Capture links or next steps'}
                    rows={10}
                    className="min-h-[180px] flex-1 resize-none rounded-[16px] border border-white/10 bg-white/[0.04] px-3.5 py-3 text-[0.86rem] leading-6 text-primary outline-none transition placeholder:text-white/25 focus:border-violet-300/35 focus:bg-violet-500/[0.05] lg:min-h-0"
                  />
                  <span className="mt-1.5 block text-right text-[0.69rem] text-white/34">
                    {note.length} / {MANUAL_FOCUS_TASK_NOTE_MAX_LENGTH}
                  </span>
                </label>
              </>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="px-1 py-1">
                  <p className="text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-white/42">
                    Title
                  </p>
                  <p className="mt-2 text-[0.98rem] font-semibold text-primary">
                    {normalizedTitle || 'Untitled task'}
                  </p>
                </div>
                <div className="mt-5 px-1 py-1">
                  <p className="text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-white/42">
                    Note
                  </p>
                  <div className="mt-3 min-h-[220px] overflow-y-auto rounded-[18px] border border-white/8 bg-[#10151d] px-5 py-4">
                    {previewBlocks.length === 0 ? (
                      <p className="text-[0.8rem] leading-6 text-white/28">
                        No notes yet.
                      </p>
                    ) : (
                      <MarkdownPreview
                        blocks={previewBlocks}
                        onToggleTaskItem={
                          state.mode === 'preview'
                            ? (lineIndex) =>
                                onToggleChecklist(state.itemId, lineIndex)
                            : undefined
                        }
                      />
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {showSplitEditor ? (
            <div
              className={`min-h-0 border-t border-white/8 bg-black/10 px-5 py-5 sm:px-6 ${
                isCompactLayout
                  ? compactMode === 'preview'
                    ? 'flex flex-col'
                    : 'hidden'
                  : 'flex flex-col lg:border-l lg:border-t-0'
              }`}
            >
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-white/42">
                    Preview
                  </span>
                  <span className="text-[0.68rem] text-white/30">Markdown</span>
                </div>
                <div className="min-h-[180px] flex-1 overflow-y-auto rounded-[16px] border border-white/8 bg-white/[0.03] px-4 py-3 lg:min-h-0">
                  {previewBlocks.length === 0 ? (
                    <p className="text-[0.8rem] leading-6 text-white/28">
                      Add notes to preview headings, lists, code, and links.
                    </p>
                  ) : (
                    <MarkdownPreview blocks={previewBlocks} />
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col items-start justify-between gap-3 border-t border-white/8 px-5 py-4 sm:flex-row sm:items-center sm:px-6">
          <p className="max-w-[34rem] text-[0.74rem] text-white/34">
            Notes support basic Markdown like headings, bullets, checkboxes, links, and inline code.
          </p>
          <div className="flex items-center gap-2">
            {isCompactLayout ? (
              <button
                type="button"
                onClick={() =>
                  setCompactMode((current) =>
                    current === 'edit' ? 'preview' : 'edit',
                  )
                }
                className="inline-flex items-center rounded-full border border-violet-300/20 bg-violet-400/[0.08] px-4 py-2 text-[0.8rem] font-semibold text-violet-100 transition hover:border-violet-300/35 hover:bg-violet-400/[0.12]"
              >
                {compactMode === 'edit'
                  ? 'Preview'
                  : isPreviewMode
                    ? 'Details'
                    : 'Edit'}
              </button>
            ) : null}
            {state.mode === 'edit' ? (
              <button
                type="button"
                onClick={() =>
                  onBackToPreview(state.itemId, normalizedTitle, normalizedNote)
                }
                className="inline-flex items-center rounded-full border border-white/12 bg-white/[0.03] px-4 py-2 text-[0.8rem] font-semibold text-white/70 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
              >
                Back
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center rounded-full border border-white/12 bg-white/[0.03] px-4 py-2 text-[0.8rem] font-semibold text-white/70 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
            >
              {isCreateMode ? 'Cancel' : isPreviewMode ? 'OK' : 'Close'}
            </button>
            {isPreviewMode ? (
              <button
                type="button"
                onClick={() => onStartEdit(state.itemId, state.title, state.note)}
                className="inline-flex items-center rounded-full border border-violet-300/20 bg-violet-400/[0.12] px-4 py-2 text-[0.8rem] font-semibold text-violet-50 transition hover:border-violet-300/35 hover:bg-violet-400/[0.18]"
              >
                Edit
              </button>
            ) : state.mode === 'create' ? (
              <button
                type="button"
                disabled={!canSubmit}
                onClick={() => {
                  if (!canSubmit) {
                    return;
                  }

                  onCreate(normalizedTitle, normalizedNote);
                }}
                className="inline-flex items-center rounded-full border border-violet-300/20 bg-violet-400/[0.12] px-4 py-2 text-[0.8rem] font-semibold text-violet-50 transition hover:border-violet-300/35 hover:bg-violet-400/[0.18] disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.04] disabled:text-white/30"
              >
                Add task
              </button>
            ) : null}
            {state.mode === 'edit' ? (
              <button
                type="button"
                disabled={!canSubmit}
                onClick={() => onUpdate(state.itemId, normalizedTitle, normalizedNote)}
                className="inline-flex items-center rounded-full border border-violet-300/20 bg-violet-400/[0.12] px-4 py-2 text-[0.8rem] font-semibold text-violet-50 transition hover:border-violet-300/35 hover:bg-violet-400/[0.18] disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.04] disabled:text-white/30"
              >
                Save
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function setCustomDragImage(dataTransfer: DataTransfer, sourceElement: HTMLDivElement) {
  const dragPreview = sourceElement.cloneNode(true);
  if (!(dragPreview instanceof HTMLDivElement)) {
    return;
  }

  const sourceRect = sourceElement.getBoundingClientRect();
  dragPreview.style.width = `${sourceRect.width}px`;
  dragPreview.style.maxWidth = `${sourceRect.width}px`;
  dragPreview.style.position = 'fixed';
  dragPreview.style.top = '-10000px';
  dragPreview.style.left = '-10000px';
  dragPreview.style.pointerEvents = 'none';
  dragPreview.style.margin = '0';
  dragPreview.style.transform = 'none';
  dragPreview.style.opacity = '0.96';
  dragPreview.style.zIndex = '9999';
  document.body.appendChild(dragPreview);

  dataTransfer.setDragImage(dragPreview, 24, 24);

  requestAnimationFrame(() => {
    dragPreview.remove();
  });
}

type MarkdownBlock =
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'list'; items: string[] }
  | {
      type: 'task-list';
      items: Array<{ text: string; checked: boolean; lineIndex: number }>;
    }
  | { type: 'paragraph'; lines: string[] }
  | { type: 'code'; text: string };

type InlineToken =
  | { type: 'text'; value: string }
  | { type: 'code'; value: string }
  | { type: 'strong'; value: string }
  | { type: 'em'; value: string }
  | { type: 'link'; value: string; href: string };

function MarkdownPreview({
  blocks,
  onToggleTaskItem,
}: {
  blocks: MarkdownBlock[];
  onToggleTaskItem?: (lineIndex: number) => void;
}) {
  return (
    <div className="space-y-3 text-[0.82rem] leading-6 text-secondary">
      {blocks.map((block, index) => {
        if (block.type === 'heading') {
          const headingClassName =
            block.level === 1
              ? 'text-[1.02rem] font-semibold text-primary'
              : block.level === 2
                ? 'text-[0.92rem] font-semibold text-primary'
                : 'text-[0.84rem] font-semibold uppercase tracking-[0.08em] text-white/78';
          return (
            <p key={`${block.type}-${index}`} className={headingClassName}>
              {renderInlineMarkdown(block.text)}
            </p>
          );
        }

        if (block.type === 'list') {
          return (
            <ul key={`${block.type}-${index}`} className="space-y-1.5 pl-4 text-secondary">
              {block.items.map((item, itemIndex) => (
                <li key={`${item}-${itemIndex}`} className="list-disc">
                  {renderInlineMarkdown(item)}
                </li>
              ))}
            </ul>
          );
        }

        if (block.type === 'task-list') {
          return (
            <div key={`${block.type}-${index}`} className="space-y-1.5">
              {block.items.map((item, itemIndex) => (
                <div key={`${item.text}-${itemIndex}`} className="flex items-start gap-2 text-secondary">
                  {onToggleTaskItem ? (
                    <button
                      type="button"
                      onClick={() => onToggleTaskItem(item.lineIndex)}
                      className="flex items-start gap-2 text-left transition hover:text-white/84"
                    >
                      <span
                        className={`mt-1 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border ${
                          item.checked
                            ? 'border-emerald-300/30 bg-emerald-400/[0.16] text-emerald-100'
                            : 'border-white/14 bg-white/[0.04] text-white/34'
                        }`}
                        aria-hidden="true"
                      >
                        <TaskCheckboxIcon checked={item.checked} />
                      </span>
                      <span className={item.checked ? 'text-white/52 line-through' : ''}>
                        {renderInlineMarkdown(item.text)}
                      </span>
                    </button>
                  ) : (
                    <>
                      <span
                        className={`mt-1 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border ${
                          item.checked
                            ? 'border-emerald-300/30 bg-emerald-400/[0.16] text-emerald-100'
                            : 'border-white/14 bg-white/[0.04] text-white/34'
                        }`}
                        aria-hidden="true"
                      >
                        <TaskCheckboxIcon checked={item.checked} />
                      </span>
                      <span className={item.checked ? 'text-white/52 line-through' : ''}>
                        {renderInlineMarkdown(item.text)}
                      </span>
                    </>
                  )}
                </div>
              ))}
            </div>
          );
        }

        if (block.type === 'code') {
          return (
            <pre
              key={`${block.type}-${index}`}
              className="overflow-x-auto rounded-[12px] border border-white/8 bg-black/20 px-3 py-2 text-[0.75rem] leading-5 text-white/80"
            >
              <code>{block.text}</code>
            </pre>
          );
        }

        return (
          <p key={`${block.type}-${index}`} className="text-secondary">
            {renderInlineMarkdownLines(block.lines)}
          </p>
        );
      })}
    </div>
  );
}

function parseMarkdownBlocks(markdown: string): MarkdownBlock[] {
  if (!markdown) {
    return [];
  }

  const lines = markdown.split(/\r?\n/);
  const blocks: MarkdownBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const rawLine = lines[index];
    const line = rawLine.trim();
    if (!line) {
      index += 1;
      continue;
    }

    if (line.startsWith('```')) {
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith('```')) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) {
        index += 1;
      }
      blocks.push({ type: 'code', text: codeLines.join('\n') });
      continue;
    }

    const headingMatch = line.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      blocks.push({
        type: 'heading',
        level: headingMatch[1].length as 1 | 2 | 3,
        text: headingMatch[2].trim(),
      });
      index += 1;
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const taskItems: Array<{ text: string; checked: boolean; lineIndex: number }> = [];
      const listItems: string[] = [];
      while (index < lines.length) {
        const currentLineIndex = index;
        const listLine = lines[index].trim();
        if (!/^[-*]\s+/.test(listLine)) {
          break;
        }
        const content = listLine.replace(/^[-*]\s+/, '').trim();
        const taskMatch = content.match(/^\[([ xX])\]\s+(.*)$/);
        if (taskMatch) {
          taskItems.push({
            checked: taskMatch[1].toLowerCase() === 'x',
            lineIndex: currentLineIndex,
            text: taskMatch[2].trim(),
          });
        } else {
          listItems.push(content);
        }
        index += 1;
      }
      if (taskItems.length > 0 && listItems.length === 0) {
        blocks.push({ type: 'task-list', items: taskItems });
      } else if (listItems.length > 0 && taskItems.length === 0) {
        blocks.push({ type: 'list', items: listItems });
      } else {
        if (taskItems.length > 0) {
          blocks.push({
            type: 'task-list',
            items: taskItems,
          });
        }
        if (listItems.length > 0) {
          blocks.push({ type: 'list', items: listItems });
        }
      }
      continue;
    }

    const paragraphLines = [line];
    index += 1;
    while (index < lines.length) {
      const nextLine = lines[index].trim();
      if (
        !nextLine ||
        nextLine.startsWith('```') ||
        /^#{1,3}\s+/.test(nextLine) ||
        /^[-*]\s+/.test(nextLine)
      ) {
        break;
      }
      paragraphLines.push(nextLine);
      index += 1;
    }
    blocks.push({ type: 'paragraph', lines: paragraphLines });
  }

  return blocks;
}

function renderInlineMarkdown(text: string) {
  return parseInlineMarkdown(text).map((token, index) => {
    if (token.type === 'code') {
      return (
        <code
          key={`${token.type}-${index}`}
          className="rounded bg-white/[0.08] px-1.5 py-0.5 text-[0.74rem] text-white/86"
        >
          {token.value}
        </code>
      );
    }

    if (token.type === 'strong') {
      return (
        <strong key={`${token.type}-${index}`} className="font-semibold text-primary">
          {token.value}
        </strong>
      );
    }

    if (token.type === 'em') {
      return (
        <em key={`${token.type}-${index}`} className="italic text-white/84">
          {token.value}
        </em>
      );
    }

    if (token.type === 'link') {
      return (
        <a
          key={`${token.type}-${index}`}
          href={token.href}
          target="_blank"
          rel="noreferrer"
          className="text-violet-100 underline decoration-violet-300/30 underline-offset-4 transition hover:decoration-violet-200/60"
        >
          {token.value}
        </a>
      );
    }

    return <span key={`${token.type}-${index}`}>{token.value}</span>;
  });
}

function renderInlineMarkdownLines(lines: string[]) {
  return lines.flatMap((line, index) => {
    const parts = renderInlineMarkdown(line);
    if (index === 0) {
      return parts;
    }

    return [<br key={`br-${index}`} />, ...parts];
  });
}

function parseInlineMarkdown(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|\[[^\]]+\]\([^)]+\)|\*[^*]+\*|_[^_]+_)/g;
  let lastIndex = 0;

  for (const match of text.matchAll(pattern)) {
    const value = match[0];
    const matchIndex = match.index ?? 0;

    if (matchIndex > lastIndex) {
      tokens.push({ type: 'text', value: text.slice(lastIndex, matchIndex) });
    }

    if (value.startsWith('`') && value.endsWith('`')) {
      tokens.push({ type: 'code', value: value.slice(1, -1) });
    } else if (
      (value.startsWith('**') && value.endsWith('**')) ||
      (value.startsWith('__') && value.endsWith('__'))
    ) {
      tokens.push({ type: 'strong', value: value.slice(2, -2) });
    } else if (value.startsWith('[')) {
      const linkMatch = value.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        tokens.push({
          type: 'link',
          value: linkMatch[1],
          href: linkMatch[2],
        });
      } else {
        tokens.push({ type: 'text', value });
      }
    } else if (
      (value.startsWith('*') && value.endsWith('*')) ||
      (value.startsWith('_') && value.endsWith('_'))
    ) {
      tokens.push({ type: 'em', value: value.slice(1, -1) });
    } else {
      tokens.push({ type: 'text', value });
    }

    lastIndex = matchIndex + value.length;
  }

  if (lastIndex < text.length) {
    tokens.push({ type: 'text', value: text.slice(lastIndex) });
  }

  return tokens.length > 0 ? tokens : [{ type: 'text', value: text }];
}

function getManualTaskPreview(note: string) {
  return note
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^[-*]\s+\[[ xX]\]\s+/gm, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[-*]\s+/gm, '')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/[*_`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function toggleMarkdownTaskListLine(note: string, lineIndex: number) {
  const lines = note.split(/\r?\n/);
  if (lineIndex < 0 || lineIndex >= lines.length) {
    return null;
  }

  const line = lines[lineIndex];
  if (/^(\s*[-*]\s+)\[\s\](\s+)/.test(line)) {
    lines[lineIndex] = line.replace(/^(\s*[-*]\s+)\[\s\](\s+)/, '$1[x]$2');
    return lines.join('\n');
  }

  if (/^(\s*[-*]\s+)\[[xX]\](\s+)/.test(line)) {
    lines[lineIndex] = line.replace(/^(\s*[-*]\s+)\[[xX]\](\s+)/, '$1[ ]$2');
    return lines.join('\n');
  }

  return null;
}

function getJiraPrAlignmentWarning(item: FocusJiraItem) {
  if (item.children.length === 0) {
    return null;
  }

  const isDone = isDoneJiraFocusItem(item);
  const hasOpenPullRequests = item.children.some((child) => !isCompletedPullRequestFocusItem(child));

  if (isDone && hasOpenPullRequests) {
    return 'Some linked PRs are still open.';
  }

  if (!isDone && !hasOpenPullRequests) {
    return 'All linked PRs are finished. You may be able to close this ticket.';
  }

  return null;
}

function isDoneJiraFocusItem(item: FocusJiraItem) {
  if (item.jiraStatusCategoryKey) {
    return item.jiraStatusCategoryKey === 'done';
  }

  const normalizedStatusLabel = item.statusLabel.trim().toLowerCase();
  return normalizedStatusLabel.includes('done') || normalizedStatusLabel.includes('closed');
}

function isCompletedPullRequestFocusItem(item: FocusPullRequestItem) {
  const normalizedStatusLabel = item.statusLabel.trim().toLowerCase();
  return normalizedStatusLabel === 'merged' || normalizedStatusLabel === 'closed';
}

function isValidRootDrop(dataTransfer: DataTransfer, activeInternalDrag: FocusInternalDragPayload | null) {
  if (dataTransfer.types.includes(TODAY_FOCUS_DRAG_MIME)) {
    return true;
  }

  const internalDrag = activeInternalDrag ?? readInternalDragPayload(dataTransfer);
  if (internalDrag) {
    return false;
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

function getManualTaskRouteId() {
  return getHashSearchParams().get(MANUAL_TASK_ROUTE_PARAM);
}

function setManualTaskRoute(taskId: string) {
  const searchParams = getHashSearchParams();
  searchParams.set(MANUAL_TASK_ROUTE_PARAM, taskId);
  updateHashSearchParams(searchParams);
}

function clearManualTaskRoute() {
  const searchParams = getHashSearchParams();
  if (!searchParams.has(MANUAL_TASK_ROUTE_PARAM)) {
    return;
  }

  searchParams.delete(MANUAL_TASK_ROUTE_PARAM);
  updateHashSearchParams(searchParams);
}

function getHashSearchParams() {
  const hash = window.location.hash.replace(/^#/, '');
  const [, rawSearch = ''] = hash.split('?');
  return new URLSearchParams(rawSearch);
}

function updateHashSearchParams(searchParams: URLSearchParams) {
  const hash = window.location.hash.replace(/^#/, '');
  const [rawPath = '/'] = hash.split('?');
  const nextSearch = searchParams.toString();
  const nextHash = nextSearch ? `#${rawPath}?${nextSearch}` : `#${rawPath}`;
  if (window.location.hash === nextHash) {
    return;
  }

  window.location.hash = nextHash;
}

function normalizeDroppedItem(item: FocusItem): FocusItem {
  return item.source === 'jira'
    ? {
        ...item,
        children: item.children ?? []
      }
    : item;
}

function getFocusItemUrl(item: FocusItem, jiraBaseUrl?: string) {
  if (item.url) {
    if (item.source === 'github' && isNotFoundPullRequestFocusItem(item)) {
      return undefined;
    }
    return item.url;
  }

  if (item.source === 'jira') {
    const normalizedBaseUrl = normalizeJiraBaseUrl(jiraBaseUrl ?? '');
    return normalizedBaseUrl ? getJiraBrowseUrl(normalizedBaseUrl, item.jiraKey) : undefined;
  }

  const match = item.id.match(/^github:([^#]+)#(\d+)$/);
  if (!match) {
    return undefined;
  }

  const [, repositoryName, pullNumber] = match;
  return `https://github.com/${repositoryName}/pull/${pullNumber}`;
}

function isNotFoundPullRequestFocusItem(item: FocusPullRequestItem) {
  return item.statusLabel.trim().toLowerCase() === 'not found';
}

function FocusReferenceLink({
  href,
  className,
  children
}: {
  href?: string;
  className: string;
  children: string;
}) {
  if (!href) {
    return <span className={className}>{children}</span>;
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      draggable={false}
      className={`${className} underline decoration-white/20 underline-offset-4 transition hover:text-white hover:decoration-white/45`}
      onClick={(event) => event.stopPropagation()}
    >
      {children}
    </a>
  );
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

function DragHandleIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor">
      <circle cx="5" cy="4" r="1" />
      <circle cx="11" cy="4" r="1" />
      <circle cx="5" cy="8" r="1" />
      <circle cx="11" cy="8" r="1" />
      <circle cx="5" cy="12" r="1" />
      <circle cx="11" cy="12" r="1" />
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

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  );
}

function TaskCheckboxIcon({ checked }: { checked: boolean }) {
  return checked ? (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="m6.5 12.5 3.4 3.4 7.6-8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="5" y="5" width="14" height="14" rx="3" />
    </svg>
  );
}
