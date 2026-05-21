import {
  getStoredAreaJsonValue,
  setStoredAreaJsonValue,
  subscribeStoredValues,
} from './backend';
import { TODAY_FOCUS_ITEMS_STORAGE_KEY } from './keys';
import type {
  FocusItem,
  FocusJiraItem,
  FocusPullRequestItem,
  ManualFocusTaskItem,
} from './types';

export const MANUAL_FOCUS_TASK_TITLE_MAX_LENGTH = 140;
export const MANUAL_FOCUS_TASK_NOTE_MAX_LENGTH = 3000;

type StoredTodayFocusItemsSnapshot = {
  items: FocusItem[];
  version: number;
};

type LegacyFocusItem = {
  id: string;
  source: 'jira' | 'github';
  sourceLabel: string;
  reference: string;
  url?: string;
  title: string;
  statusLabel: string;
  statusTone: 'violet' | 'emerald' | 'amber';
};

type StoredTodayFocusItemsValue =
  | FocusItem[]
  | {
      version?: unknown;
      items?: unknown;
    };

const TODAY_FOCUS_EXTENSION_STORAGE_AREA = 'sync';

export async function getStoredTodayFocusItems() {
  const snapshot = await getStoredTodayFocusItemsSnapshot();
  return snapshot?.items ?? null;
}

export async function getStoredTodayFocusItemsSnapshot() {
  const syncedItems = await getStoredAreaJsonValue<StoredTodayFocusItemsValue>(
    TODAY_FOCUS_ITEMS_STORAGE_KEY,
    { area: TODAY_FOCUS_EXTENSION_STORAGE_AREA },
  );

  if (syncedItems === null) {
    return null;
  }

  return normalizeStoredTodayFocusItemsSnapshot(syncedItems);
}

export async function saveStoredTodayFocusItems(items: FocusItem[]) {
  await saveStoredTodayFocusItemsSnapshot({
    items,
    version: Date.now(),
  });
}

export async function saveStoredTodayFocusItemsSnapshot(
  snapshot: StoredTodayFocusItemsSnapshot,
) {
  const normalizedItems = mergeFocusItems(snapshot.items) ?? [];
  const normalizedSnapshot = {
    version: normalizeStoredTodayFocusVersion(snapshot.version),
    items: normalizedItems,
  };

  await setStoredAreaJsonValue(
    TODAY_FOCUS_ITEMS_STORAGE_KEY,
    normalizedSnapshot,
    { area: TODAY_FOCUS_EXTENSION_STORAGE_AREA },
  );
}

export function subscribeStoredTodayFocusItems(callback: () => void) {
  return subscribeStoredValues(
    [TODAY_FOCUS_ITEMS_STORAGE_KEY],
    callback,
    { area: TODAY_FOCUS_EXTENSION_STORAGE_AREA },
  );
}

function mergeFocusItems(items?: FocusItem[] | LegacyFocusItem[] | null) {
  if (!Array.isArray(items)) {
    return null;
  }

  return items.map((item) => normalizeFocusItem(item)).filter((item): item is FocusItem => item !== null);
}

function normalizeFocusItem(item: FocusItem | LegacyFocusItem | null | undefined): FocusItem | null {
  if (
    !item ||
    typeof item.id !== 'string' ||
    (item.source !== 'jira' && item.source !== 'github' && item.source !== 'manual') ||
    typeof item.title !== 'string'
  ) {
    return null;
  }

  if (item.source === 'manual') {
    return normalizeManualFocusTaskItem(item);
  }

  if (
    typeof item.sourceLabel !== 'string' ||
    typeof item.reference !== 'string' ||
    typeof item.statusLabel !== 'string' ||
    (item.statusTone !== 'violet' && item.statusTone !== 'emerald' && item.statusTone !== 'amber')
  ) {
    return null;
  }

  const normalizedBase = {
    id: item.id,
    sourceLabel: item.sourceLabel.trim(),
    reference: item.reference.trim(),
    url: typeof item.url === 'string' && item.url.trim() ? item.url.trim() : undefined,
    title: item.title.trim(),
    statusLabel: item.statusLabel.trim(),
    statusTone: item.statusTone
  };

  if (item.source === 'github') {
    return {
      ...normalizedBase,
      source: 'github',
      jiraKey: normalizeJiraKey('jiraKey' in item ? item.jiraKey : null),
      repositoryName: normalizeRepositoryName(
        'repositoryName' in item ? item.repositoryName : item.id,
      ),
    };
  }

  const rawChildren = 'children' in item && Array.isArray(item.children) ? item.children : [];
  const children = rawChildren
    .map((child) => normalizeFocusItem(child))
    .filter((child): child is FocusPullRequestItem => child?.source === 'github');
  const normalizedJiraKey =
    normalizeJiraKey('jiraKey' in item ? item.jiraKey : item.reference) ?? item.reference.trim();

  return {
    ...normalizedBase,
    source: 'jira',
    jiraKey: normalizedJiraKey,
    jiraStatusCategoryKey:
      typeof item === 'object' && item !== null && 'jiraStatusCategoryKey' in item
        ? normalizeJiraStatusCategoryKey(item.jiraStatusCategoryKey)
        : undefined,
    children,
    isPlaceholder: 'isPlaceholder' in item ? Boolean(item.isPlaceholder) : false
  } satisfies FocusJiraItem;
}

function normalizeStoredTodayFocusItemsSnapshot(
  value: StoredTodayFocusItemsValue,
): StoredTodayFocusItemsSnapshot {
  if (Array.isArray(value)) {
    return {
      items: mergeFocusItems(value) ?? [],
      version: 0,
    };
  }

  const items =
    value && typeof value === 'object' && 'items' in value
      ? mergeFocusItems(value.items as FocusItem[] | LegacyFocusItem[] | null)
      : null;

  return {
    items: items ?? [],
    version:
      value && typeof value === 'object' && 'version' in value
        ? normalizeStoredTodayFocusVersion(value.version)
        : 0,
  };
}

function normalizeStoredTodayFocusVersion(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function normalizeManualFocusTaskItem(
  item: Extract<FocusItem, { source: 'manual' }>,
): ManualFocusTaskItem | null {
  const title = item.title.trim().slice(0, MANUAL_FOCUS_TASK_TITLE_MAX_LENGTH);
  if (!title) {
    return null;
  }

  const note = normalizeManualFocusTaskNote(item.note);
  const createdAt = normalizeTimestamp(item.createdAt) ?? Date.now();
  const updatedAt = normalizeTimestamp(item.updatedAt) ?? createdAt;
  const completedAt = normalizeTimestamp(item.completedAt);
  const isCompleted = completedAt !== null;

  return {
    id: item.id,
    source: 'manual',
    sourceLabel: 'Task',
    reference: 'Manual',
    title,
    note,
    completedAt,
    createdAt,
    updatedAt: Math.max(updatedAt, createdAt),
    statusLabel: isCompleted ? 'Done' : 'Task',
    statusTone: isCompleted ? 'emerald' : 'violet',
  };
}

function normalizeManualFocusTaskNote(value: unknown) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().slice(0, MANUAL_FOCUS_TASK_NOTE_MAX_LENGTH);
}

function normalizeTimestamp(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function normalizeJiraKey(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim().toUpperCase() : null;
}

function normalizeJiraStatusCategoryKey(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim().toLowerCase() : undefined;
}

function normalizeRepositoryName(value: unknown) {
  if (typeof value === 'string' && value.trim()) {
    const trimmedValue = value.trim();
    if (trimmedValue.startsWith('github:')) {
      const match = trimmedValue.match(/^github:([^#]+)#\d+$/);
      return match?.[1] ?? 'Unknown repository';
    }

    return trimmedValue;
  }

  return 'Unknown repository';
}
