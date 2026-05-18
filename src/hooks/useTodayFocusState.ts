import { useEffect, useRef, useState } from 'react';
import { TODAY_FOCUS_MAX_ITEMS } from '../components/SummaryCard';
import type { GitHubPullRequestItem } from '../lib/githubApi';
import {
  getMatchingGitHubFocusPullRequests as getMatchingFocusPullRequestsForJiraKey,
  mapGitHubPullRequestToFocusItem,
} from '../lib/focusMapping';
import type { JiraIssue } from '../lib/jiraApi';
import {
  getStoredTodayFocusItems,
  getStoredTodayFocusItemsSnapshot,
  MANUAL_FOCUS_TASK_NOTE_MAX_LENGTH,
  MANUAL_FOCUS_TASK_TITLE_MAX_LENGTH,
  saveStoredTodayFocusItems,
  saveStoredTodayFocusItemsSnapshot,
  type FocusItem,
  type FocusPullRequestItem,
  type ManualFocusTaskItem,
} from '../lib/storage';
import {
  reconcileTodayFocusGitHubItems,
  reconcileTodayFocusJiraItems,
} from '../lib/todayFocusSync';

const TODAY_FOCUS_DEBUG = false;

type UseTodayFocusStateOptions = {
  jiraIssues: JiraIssue[];
  gitHubPullRequests: GitHubPullRequestItem[];
};

export function useTodayFocusState({
  jiraIssues,
  gitHubPullRequests,
}: UseTodayFocusStateOptions) {
  const [todayFocusItems, setTodayFocusItems] = useState<FocusItem[]>([]);
  const [isSavingTodayFocusItems, setIsSavingTodayFocusItems] = useState(false);
  const [hasLoadedTodayFocusItems, setHasLoadedTodayFocusItems] =
    useState(false);
  const [todayFocusWarning, setTodayFocusWarning] = useState<string | null>(
    null,
  );
  const hasLoadedTodayFocusItemsRef = useRef(false);
  const pendingTodayFocusSaveCountRef = useRef(0);
  const todayFocusItemsRef = useRef<FocusItem[]>([]);
  const todayFocusStorageVersionRef = useRef(0);
  const todayFocusItemIds = collectTodayFocusItemIds(todayFocusItems);

  useEffect(() => {
    todayFocusItemsRef.current = todayFocusItems;
  }, [todayFocusItems]);

  useEffect(() => {
    let isMounted = true;

    getStoredTodayFocusItemsSnapshot().then((storedSnapshot) => {
      if (!isMounted) {
        return;
      }

      const nextItems = storedSnapshot?.items ?? [];
      logTodayFocusDebug('load-stored-items', {
        storedCount: storedSnapshot?.items.length ?? null,
        storedVersion: storedSnapshot?.version ?? null,
        nextCount: nextItems.length,
        nextItems,
      });
      todayFocusItemsRef.current = nextItems;
      todayFocusStorageVersionRef.current = storedSnapshot?.version ?? 0;
      setTodayFocusItems(nextItems);
      hasLoadedTodayFocusItemsRef.current = true;
      setHasLoadedTodayFocusItems(true);
      if (storedSnapshot === null) {
        void saveStoredTodayFocusItems(nextItems);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!hasLoadedTodayFocusItemsRef.current) {
      return;
    }

    const syncResult = reconcileTodayFocusJiraItems(
      todayFocusItemsRef.current,
      jiraIssues,
    );
    logTodayFocusDebug('jira-sync-result', {
      currentCount: todayFocusItemsRef.current.length,
      nextCount: syncResult.items.length,
      missingKeys: syncResult.missingKeys,
      changed: syncResult.items !== todayFocusItemsRef.current,
      currentItems: todayFocusItemsRef.current,
      nextItems: syncResult.items,
    });
    if (syncResult.items === todayFocusItemsRef.current) {
      return;
    }

    void commitTodayFocusItems(syncResult.items, 'sync');
  }, [hasLoadedTodayFocusItems, jiraIssues]);

  useEffect(() => {
    if (!hasLoadedTodayFocusItemsRef.current) {
      return;
    }

    const groupedItems = syncTodayFocusJiraLinkedPullRequests(
      todayFocusItemsRef.current,
      gitHubPullRequests,
    );
    const syncResult = reconcileTodayFocusGitHubItems(
      groupedItems,
      gitHubPullRequests,
    );
    logTodayFocusDebug('github-sync-result', {
      currentCount: todayFocusItemsRef.current.length,
      groupedCount: groupedItems.length,
      nextCount: syncResult.items.length,
      missingPullRequests: syncResult.missingPullRequests,
      changed: syncResult.items !== todayFocusItemsRef.current,
      currentItems: todayFocusItemsRef.current,
      groupedItems,
      nextItems: syncResult.items,
    });
    if (syncResult.items !== todayFocusItemsRef.current) {
      void commitTodayFocusItems(syncResult.items, 'sync');
    }
  }, [gitHubPullRequests, hasLoadedTodayFocusItems]);

  useEffect(() => {
    if (!isSavingTodayFocusItems) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isSavingTodayFocusItems]);

  async function commitTodayFocusItems(
    nextItems: FocusItem[],
    reason: 'user' | 'sync' = 'user',
  ) {
    logTodayFocusDebug('commit-items', {
      reason,
      previousVersion: todayFocusStorageVersionRef.current,
      previousCount: todayFocusItemsRef.current.length,
      nextCount: nextItems.length,
      previousItems: todayFocusItemsRef.current,
      nextItems,
    });
    if (reason === 'sync') {
      const latestSnapshot = await getStoredTodayFocusItemsSnapshot();
      const latestVersion = latestSnapshot?.version ?? 0;
      if (latestVersion !== todayFocusStorageVersionRef.current) {
        logTodayFocusDebug('skip-sync-save-version-mismatch', {
          expectedVersion: todayFocusStorageVersionRef.current,
          latestVersion,
          nextItems,
        });
        return;
      }
    }

    todayFocusItemsRef.current = nextItems;
    setTodayFocusItems(nextItems);

    if (reason === 'sync') {
      return;
    }

    const nextVersion = Date.now();
    pendingTodayFocusSaveCountRef.current += 1;
    setIsSavingTodayFocusItems(true);

    try {
      await saveStoredTodayFocusItemsSnapshot({
        items: nextItems,
        version: nextVersion,
      });
      todayFocusStorageVersionRef.current = nextVersion;
    } finally {
      pendingTodayFocusSaveCountRef.current = Math.max(
        0,
        pendingTodayFocusSaveCountRef.current - 1,
      );
      setIsSavingTodayFocusItems(pendingTodayFocusSaveCountRef.current > 0);
    }
  }

  function handleAddTodayFocusItem(item: FocusItem) {
    setTodayFocusWarning(null);

    const addResult = addTodayFocusItem(
      todayFocusItemsRef.current,
      item,
      gitHubPullRequests,
    );
    if (addResult.warning) {
      setTodayFocusWarning(addResult.warning);
      return;
    }

    void commitTodayFocusItems(addResult.items, 'user');
  }

  function handleRemoveTodayFocusItem(itemId: string) {
    setTodayFocusWarning(null);
    void commitTodayFocusItems(
      removeTodayFocusItem(todayFocusItemsRef.current, itemId),
      'user',
    );
  }

  function handleCreateManualTodayFocusTask(title: string, note: string) {
    setTodayFocusWarning(null);

    const task = createManualTodayFocusTask(title, note);
    if (!task) {
      setTodayFocusWarning('Manual tasks need a title.');
      return false;
    }

    const addResult = addTodayFocusItem(
      todayFocusItemsRef.current,
      task,
      gitHubPullRequests,
    );
    if (addResult.warning) {
      setTodayFocusWarning(addResult.warning);
      return false;
    }

    void commitTodayFocusItems(addResult.items, 'user');
    return true;
  }

  function handleUpdateManualTodayFocusTask(
    itemId: string,
    title: string,
    note: string,
  ) {
    setTodayFocusWarning(null);
    const nextItems = updateManualTodayFocusTask(
      todayFocusItemsRef.current,
      itemId,
      title,
      note,
    );
    if (nextItems === todayFocusItemsRef.current) {
      return true;
    }

    void commitTodayFocusItems(nextItems, 'user');
    return true;
  }

  function handleToggleManualTodayFocusTask(itemId: string) {
    setTodayFocusWarning(null);
    void commitTodayFocusItems(
      toggleManualTodayFocusTask(todayFocusItemsRef.current, itemId),
      'user',
    );
  }

  function handleNestNewTodayFocusPullRequest(
    parentId: string,
    item: FocusPullRequestItem,
  ) {
    setTodayFocusWarning(null);

    const nextState = nestNewPullRequestUnderJira(
      todayFocusItemsRef.current,
      parentId,
      item,
    );
    if (nextState.warning) {
      setTodayFocusWarning(nextState.warning);
      return;
    }

    void commitTodayFocusItems(nextState.items, 'user');
  }

  function handleNestExistingTodayFocusPullRequest(
    parentId: string,
    itemId: string,
  ) {
    setTodayFocusWarning(null);
    void commitTodayFocusItems(
      moveStandalonePullRequestUnderJira(
        todayFocusItemsRef.current,
        parentId,
        itemId,
      ),
      'user',
    );
  }

  function handleReorderTopLevelTodayFocusItem(itemId: string, targetId: string) {
    setTodayFocusWarning(null);
    void commitTodayFocusItems(
      reorderTopLevelTodayFocusItems(todayFocusItemsRef.current, itemId, targetId),
      'user',
    );
  }

  function handleMoveTopLevelTodayFocusItemToEnd(itemId: string) {
    setTodayFocusWarning(null);
    void commitTodayFocusItems(
      moveTopLevelTodayFocusItemToEnd(todayFocusItemsRef.current, itemId),
      'user',
    );
  }

  function handleReorderNestedTodayFocusPullRequest(
    parentId: string,
    itemId: string,
    targetId: string,
  ) {
    setTodayFocusWarning(null);
    void commitTodayFocusItems(
      reorderNestedPullRequests(
        todayFocusItemsRef.current,
        parentId,
        itemId,
        targetId,
      ),
      'user',
    );
  }

  return {
    todayFocusItems,
    todayFocusItemsRef,
    todayFocusItemIds,
    todayFocusWarning,
    hasLoadedTodayFocusItems,
    commitTodayFocusItems,
    handleAddTodayFocusItem,
    handleCreateManualTodayFocusTask,
    handleUpdateManualTodayFocusTask,
    handleToggleManualTodayFocusTask,
    handleRemoveTodayFocusItem,
    handleNestNewTodayFocusPullRequest,
    handleNestExistingTodayFocusPullRequest,
    handleReorderTopLevelTodayFocusItem,
    handleMoveTopLevelTodayFocusItemToEnd,
    handleReorderNestedTodayFocusPullRequest,
  };
}

function collectTodayFocusItemIds(items: FocusItem[]) {
  const itemIds = new Set<string>();

  for (const item of items) {
    itemIds.add(item.id);

    if (item.source === 'jira') {
      for (const child of item.children) {
        itemIds.add(child.id);
      }
    }
  }

  return itemIds;
}

function addTodayFocusItem(
  items: FocusItem[],
  item: FocusItem,
  pullRequests: GitHubPullRequestItem[],
) {
  if (hasTodayFocusItem(items, item.id)) {
    return { items, warning: 'That item is already in Today focus.' };
  }

  if (items.length >= TODAY_FOCUS_MAX_ITEMS) {
    return { items, warning: 'Today focus already has 3 items.' };
  }

  if (item.source === 'jira') {
    const normalizedItem: FocusItem = normalizeTopLevelTodayFocusItem(item);
    if (normalizedItem.source !== 'jira') {
      return { items, warning: null };
    }

    const matchingPullRequests = getMatchingGitHubFocusPullRequests(
      pullRequests,
      normalizedItem.jiraKey,
    );
    const existingMatchingStandalonePullRequests = items.filter(
      (focusItem): focusItem is FocusPullRequestItem =>
        focusItem.source === 'github' &&
        focusItem.jiraKey === normalizedItem.jiraKey,
    );
    const nextChildrenById = new Map<string, FocusPullRequestItem>();

    for (const child of normalizedItem.children) {
      nextChildrenById.set(child.id, child);
    }

    for (const pullRequest of matchingPullRequests) {
      nextChildrenById.set(pullRequest.id, pullRequest);
    }

    for (const pullRequest of existingMatchingStandalonePullRequests) {
      nextChildrenById.set(pullRequest.id, pullRequest);
    }

    return {
      items: [
        ...items.filter(
          (focusItem) =>
            !(
              focusItem.source === 'github' &&
              focusItem.jiraKey === normalizedItem.jiraKey
            ),
        ),
        {
          ...normalizedItem,
          children: Array.from(nextChildrenById.values()),
        },
      ],
      warning: null,
    };
  }

  return {
    items: [...items, normalizeTopLevelTodayFocusItem(item)],
    warning: null,
  };
}

function createManualTodayFocusTask(
  title: string,
  note: string,
): ManualFocusTaskItem | null {
  const normalized = normalizeManualTaskInput(title, note);
  if (!normalized) {
    return null;
  }

  const timestamp = Date.now();
  return {
    id: `manual:${crypto.randomUUID()}`,
    source: 'manual',
    sourceLabel: 'Task',
    reference: 'Manual',
    title: normalized.title,
    note: normalized.note,
    completedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    statusLabel: 'Task',
    statusTone: 'violet',
  };
}

function syncTodayFocusJiraLinkedPullRequests(
  items: FocusItem[],
  pullRequests: GitHubPullRequestItem[],
) {
  const jiraKeys = new Set(
    items
      .filter(
        (item): item is Extract<FocusItem, { source: 'jira' }> =>
          item.source === 'jira',
      )
      .map((item) => item.jiraKey),
  );
  if (jiraKeys.size === 0) {
    return items;
  }

  const matchingPullRequestsByJiraKey = new Map<string, FocusPullRequestItem[]>();
  for (const pullRequest of pullRequests) {
    const jiraKey = mapGitHubPullRequestToFocusItem(pullRequest).jiraKey;
    if (!jiraKey || !jiraKeys.has(jiraKey)) {
      continue;
    }

    const nextItem = mapGitHubPullRequestToFocusItem(pullRequest);
    const currentItems = matchingPullRequestsByJiraKey.get(jiraKey) ?? [];
    currentItems.push(nextItem);
    matchingPullRequestsByJiraKey.set(jiraKey, currentItems);
  }

  let hasChanges = false;
  const nextItems: FocusItem[] = [];

  for (const item of items) {
    if (item.source === 'jira') {
      const nextChildrenById = new Map<string, FocusPullRequestItem>();

      for (const child of item.children) {
        nextChildrenById.set(child.id, child);
      }

      for (const pullRequest of matchingPullRequestsByJiraKey.get(item.jiraKey) ?? []) {
        const previousChild = nextChildrenById.get(pullRequest.id);
        if (
          !previousChild ||
          previousChild.title !== pullRequest.title ||
          previousChild.statusLabel !== pullRequest.statusLabel ||
          previousChild.statusTone !== pullRequest.statusTone ||
          previousChild.url !== pullRequest.url
        ) {
          hasChanges = true;
        }
        nextChildrenById.set(pullRequest.id, pullRequest);
      }

      const nextChildren = Array.from(nextChildrenById.values());
      if (
        nextChildren.length !== item.children.length ||
        nextChildren.some((child, index) => child !== item.children[index])
      ) {
        hasChanges = true;
        nextItems.push({
          ...item,
          children: nextChildren,
        });
        continue;
      }

      nextItems.push(item);
      continue;
    }

    if (item.source === 'github' && item.jiraKey && jiraKeys.has(item.jiraKey)) {
      hasChanges = true;
      continue;
    }

    nextItems.push(item);
  }

  return hasChanges ? nextItems : items;
}

function removeTodayFocusItem(items: FocusItem[], itemId: string) {
  const nextItems: FocusItem[] = [];

  for (const item of items) {
    if (item.id === itemId) {
      continue;
    }

    if (item.source === 'jira') {
      const nextChildren = item.children.filter((child) => child.id !== itemId);
      nextItems.push(
        nextChildren.length === item.children.length
          ? item
          : {
              ...item,
              children: nextChildren,
            },
      );
      continue;
    }

    nextItems.push(item);
  }

  return nextItems;
}

function updateManualTodayFocusTask(
  items: FocusItem[],
  itemId: string,
  title: string,
  note: string,
) {
  const normalized = normalizeManualTaskInput(title, note);
  if (!normalized) {
    return items;
  }

  let hasChanges = false;
  const nextItems = items.map((item) => {
    if (item.id !== itemId || item.source !== 'manual') {
      return item;
    }

    if (item.title === normalized.title && item.note === normalized.note) {
      return item;
    }

    hasChanges = true;
    return {
      ...item,
      title: normalized.title,
      note: normalized.note,
      updatedAt: Date.now(),
    };
  });

  return hasChanges ? nextItems : items;
}

function toggleManualTodayFocusTask(items: FocusItem[], itemId: string) {
  let hasChanges = false;
  const nextItems = items.map((item) => {
    if (item.id !== itemId || item.source !== 'manual') {
      return item;
    }

    hasChanges = true;
    const nextCompletedAt = item.completedAt === null ? Date.now() : null;
    const nextStatusTone: ManualFocusTaskItem['statusTone'] =
      nextCompletedAt === null ? 'violet' : 'emerald';
    return {
      ...item,
      completedAt: nextCompletedAt,
      updatedAt: Date.now(),
      statusLabel: nextCompletedAt === null ? 'Task' : 'Done',
      statusTone: nextStatusTone,
    };
  });

  return hasChanges ? nextItems : items;
}

function hasTodayFocusItem(items: FocusItem[], itemId: string) {
  return items.some(
    (item) =>
      item.id === itemId ||
      (item.source === 'jira' &&
        item.children.some((child) => child.id === itemId)),
  );
}

function nestNewPullRequestUnderJira(
  items: FocusItem[],
  parentId: string,
  pullRequest: FocusPullRequestItem,
) {
  if (hasTodayFocusItem(items, pullRequest.id)) {
    return { items, warning: 'That item is already in Today focus.' };
  }

  if (!items.some((item) => item.id === parentId && item.source === 'jira')) {
    return { items, warning: null };
  }

  return {
    items: items.map((item) =>
      item.id === parentId && item.source === 'jira'
        ? {
            ...item,
            children: [...item.children, pullRequest],
          }
        : item,
    ),
    warning: null,
  };
}

function moveStandalonePullRequestUnderJira(
  items: FocusItem[],
  parentId: string,
  itemId: string,
) {
  const standalonePullRequest = items.find(
    (item): item is FocusPullRequestItem =>
      item.id === itemId && item.source === 'github',
  );

  if (
    !standalonePullRequest ||
    !items.some((item) => item.id === parentId && item.source === 'jira')
  ) {
    return items;
  }

  return items.reduce<FocusItem[]>((nextItems, item) => {
    if (item.id === itemId) {
      return nextItems;
    }

    if (item.id === parentId && item.source === 'jira') {
      nextItems.push({
        ...item,
        children: [...item.children, standalonePullRequest],
      });
      return nextItems;
    }

    nextItems.push(item);
    return nextItems;
  }, []);
}

function reorderTopLevelTodayFocusItems(
  items: FocusItem[],
  itemId: string,
  targetId: string,
) {
  if (itemId === targetId) {
    return items;
  }

  const sourceIndex = items.findIndex((item) => item.id === itemId);
  const targetIndex = items.findIndex((item) => item.id === targetId);
  if (sourceIndex < 0 || targetIndex < 0) {
    return items;
  }

  const nextItems = [...items];
  const [movedItem] = nextItems.splice(sourceIndex, 1);
  const insertIndex = nextItems.findIndex((item) => item.id === targetId);
  nextItems.splice(insertIndex, 0, movedItem);
  return nextItems;
}

function moveTopLevelTodayFocusItemToEnd(items: FocusItem[], itemId: string) {
  const sourceIndex = items.findIndex((item) => item.id === itemId);
  if (sourceIndex < 0 || sourceIndex === items.length - 1) {
    return items;
  }

  const nextItems = [...items];
  const [movedItem] = nextItems.splice(sourceIndex, 1);
  nextItems.push(movedItem);
  return nextItems;
}

function reorderNestedPullRequests(
  items: FocusItem[],
  parentId: string,
  itemId: string,
  targetId: string,
) {
  if (itemId === targetId) {
    return items;
  }

  return items.map((item) => {
    if (item.id !== parentId || item.source !== 'jira') {
      return item;
    }

    const sourceIndex = item.children.findIndex((child) => child.id === itemId);
    if (sourceIndex < 0) {
      return item;
    }

    const nextChildren = [...item.children];
    const [movedChild] = nextChildren.splice(sourceIndex, 1);
    const insertIndex =
      targetId === getNestedPullRequestEndTargetId(parentId)
        ? nextChildren.length
        : nextChildren.findIndex((child) => child.id === targetId);
    if (insertIndex < 0) {
      return item;
    }
    nextChildren.splice(insertIndex, 0, movedChild);

    return {
      ...item,
      children: nextChildren,
    };
  });
}

function normalizeTopLevelTodayFocusItem(item: FocusItem): FocusItem {
  return item.source === 'jira'
    ? {
        ...item,
        jiraStatusCategoryKey:
          item.jiraStatusCategoryKey?.trim().toLowerCase() ?? undefined,
        children: item.children ?? [],
      }
    : item;
}

function normalizeManualTaskInput(title: string, note: string) {
  const normalizedTitle = title
    .trim()
    .slice(0, MANUAL_FOCUS_TASK_TITLE_MAX_LENGTH);
  if (!normalizedTitle) {
    return null;
  }

  return {
    title: normalizedTitle,
    note: note.trim().slice(0, MANUAL_FOCUS_TASK_NOTE_MAX_LENGTH),
  };
}

function logTodayFocusDebug(event: string, details: Record<string, unknown>) {
  if (!TODAY_FOCUS_DEBUG) {
    return;
  }

  console.debug(`[TodayFocus] ${event}`, details);
}

function getNestedPullRequestEndTargetId(parentId: string) {
  return `__end__:${parentId}`;
}

function getMatchingGitHubFocusPullRequests(
  pullRequests: GitHubPullRequestItem[],
  jiraKey: string,
) {
  return getMatchingFocusPullRequestsForJiraKey(pullRequests, jiraKey);
}
