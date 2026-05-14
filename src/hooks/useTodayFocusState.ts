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
  saveStoredTodayFocusItems,
  type FocusItem,
  type FocusPullRequestItem,
} from '../lib/storage';
import {
  reconcileTodayFocusGitHubItems,
  reconcileTodayFocusJiraItems,
} from '../lib/todayFocusSync';

type UseTodayFocusStateOptions = {
  jiraIssues: JiraIssue[];
  gitHubPullRequests: GitHubPullRequestItem[];
};

export function useTodayFocusState({
  jiraIssues,
  gitHubPullRequests,
}: UseTodayFocusStateOptions) {
  const [todayFocusItems, setTodayFocusItems] = useState<FocusItem[]>([]);
  const [hasLoadedTodayFocusItems, setHasLoadedTodayFocusItems] =
    useState(false);
  const [todayFocusWarning, setTodayFocusWarning] = useState<string | null>(
    null,
  );
  const hasLoadedTodayFocusItemsRef = useRef(false);
  const todayFocusItemsRef = useRef<FocusItem[]>([]);
  const todayFocusItemIds = collectTodayFocusItemIds(todayFocusItems);

  useEffect(() => {
    todayFocusItemsRef.current = todayFocusItems;
  }, [todayFocusItems]);

  useEffect(() => {
    let isMounted = true;

    getStoredTodayFocusItems().then((storedItems) => {
      if (!isMounted) {
        return;
      }

      const nextItems = storedItems ?? getDefaultTodayFocusItems();
      todayFocusItemsRef.current = nextItems;
      setTodayFocusItems(nextItems);
      hasLoadedTodayFocusItemsRef.current = true;
      setHasLoadedTodayFocusItems(true);
      if (storedItems === null) {
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
    if (syncResult.items === todayFocusItemsRef.current) {
      return;
    }

    commitTodayFocusItems(syncResult.items);
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
    if (syncResult.items !== todayFocusItemsRef.current) {
      commitTodayFocusItems(syncResult.items);
    }
  }, [gitHubPullRequests, hasLoadedTodayFocusItems]);

  function commitTodayFocusItems(nextItems: FocusItem[]) {
    todayFocusItemsRef.current = nextItems;
    setTodayFocusItems(nextItems);
    void saveStoredTodayFocusItems(nextItems);
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

    commitTodayFocusItems(addResult.items);
  }

  function handleRemoveTodayFocusItem(itemId: string) {
    setTodayFocusWarning(null);
    commitTodayFocusItems(
      removeTodayFocusItem(todayFocusItemsRef.current, itemId),
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

    commitTodayFocusItems(nextState.items);
  }

  function handleNestExistingTodayFocusPullRequest(
    parentId: string,
    itemId: string,
  ) {
    setTodayFocusWarning(null);
    commitTodayFocusItems(
      moveStandalonePullRequestUnderJira(
        todayFocusItemsRef.current,
        parentId,
        itemId,
      ),
    );
  }

  function handleReorderTopLevelTodayFocusItem(itemId: string, targetId: string) {
    setTodayFocusWarning(null);
    commitTodayFocusItems(
      reorderTopLevelTodayFocusItems(todayFocusItemsRef.current, itemId, targetId),
    );
  }

  function handleMoveTopLevelTodayFocusItemToEnd(itemId: string) {
    setTodayFocusWarning(null);
    commitTodayFocusItems(
      moveTopLevelTodayFocusItemToEnd(todayFocusItemsRef.current, itemId),
    );
  }

  function handleReorderNestedTodayFocusPullRequest(
    parentId: string,
    itemId: string,
    targetId: string,
  ) {
    setTodayFocusWarning(null);
    commitTodayFocusItems(
      reorderNestedPullRequests(
        todayFocusItemsRef.current,
        parentId,
        itemId,
        targetId,
      ),
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

function getDefaultTodayFocusItems(): FocusItem[] {
  return [
    {
      id: 'jira:CLK-112',
      source: 'jira',
      sourceLabel: 'Jira',
      reference: 'CLK-112',
      jiraKey: 'CLK-112',
      title: 'Fix lead status bug in dashboard',
      statusLabel: 'In Progress',
      statusTone: 'violet',
      children: [
        {
          id: 'github:dashboard#142',
          source: 'github',
          sourceLabel: 'GitHub',
          reference: '#142',
          title: 'CLK-112 Fix venue provision defaults',
          statusLabel: 'Approved',
          statusTone: 'emerald',
          jiraKey: 'CLK-112',
        },
      ],
    },
  ];
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

    if (item.jiraKey && jiraKeys.has(item.jiraKey)) {
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

function getNestedPullRequestEndTargetId(parentId: string) {
  return `__end__:${parentId}`;
}

function getMatchingGitHubFocusPullRequests(
  pullRequests: GitHubPullRequestItem[],
  jiraKey: string,
) {
  return getMatchingFocusPullRequestsForJiraKey(pullRequests, jiraKey);
}
