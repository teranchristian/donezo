import { useEffect, useState } from 'react';
import type {
  GitHubConnectionStatus,
  GitHubPullRequestItem,
} from '../lib/githubApi';
import {
  areGitHubPrNotificationSeenAtStatesEqual,
  areGitHubPrReadyStatesEqual,
  areGitHubPrReadyStatesExactlyEqual,
  areGitHubPrWarningStatesEqual,
  areGitHubPrWarningStatesExactlyEqual,
  areGitHubTeamPrTrackerStatesEqual,
  getNextGitHubTeamPrTrackerState,
} from '../lib/githubCardDomain';
import {
  buildGitHubPrReadyState,
  buildGitHubPrWarningState,
  getGitHubPullRequestAttentionStateKey,
  getGitHubPullRequestWarningStateKey,
} from '../lib/githubDomain';
import {
  getStoredGitHubPrNotificationSeenAtState,
  getStoredGitHubPrReadyState,
  getStoredGitHubTeamPrTrackerState,
  getStoredGitHubPrWarningState,
  getStoredGitHubSortOrder,
  saveStoredGitHubPrNotificationSeenAtState,
  saveStoredGitHubPrReadyState,
  saveStoredGitHubTeamPrTrackerState,
  saveStoredGitHubPrWarningState,
  saveStoredGitHubSortOrder,
  type GitHubListSort,
  type GitHubPrNotificationSeenAtState,
  type GitHubPrReadyState,
  type GitHubPrWarningState,
  type GitHubTeamPrTrackerState,
} from '../lib/storage';
import { subscribeStoredValues } from '../lib/storage/backend';
import {
  GITHUB_PR_NOTIFICATION_SEEN_AT_STORAGE_KEY,
  GITHUB_PR_READY_STATE_STORAGE_KEY,
  GITHUB_PR_WARNING_STATE_STORAGE_KEY,
  GITHUB_TEAM_PR_TRACKER_STORAGE_KEY,
} from '../lib/storage/keys';

type UseGitHubCardStateOptions = {
  connectionStatus: GitHubConnectionStatus;
  isLoading: boolean;
  lastUpdatedAt: number | null;
  resolvedPullRequests: GitHubPullRequestItem[];
  visibleRecentOpenPullRequests: GitHubPullRequestItem[];
};

export function useGitHubCardState({
  connectionStatus,
  isLoading,
  lastUpdatedAt,
  resolvedPullRequests,
  visibleRecentOpenPullRequests,
}: UseGitHubCardStateOptions) {
  const [sortOrder, setSortOrder] =
    useState<GitHubListSort>('recently-updated');
  const [hasLoadedSortOrder, setHasLoadedSortOrder] = useState(false);
  const [gitHubPrReadyState, setGitHubPrReadyState] =
    useState<GitHubPrReadyState>({});
  const [hasLoadedGitHubPrReadyState, setHasLoadedGitHubPrReadyState] =
    useState(false);
  const [gitHubPrWarningState, setGitHubPrWarningState] =
    useState<GitHubPrWarningState>({});
  const [hasLoadedGitHubPrWarningState, setHasLoadedGitHubPrWarningState] =
    useState(false);
  const [gitHubPrNotificationSeenAtState, setGitHubPrNotificationSeenAtState] =
    useState<GitHubPrNotificationSeenAtState>({});
  const [
    hasLoadedGitHubPrNotificationSeenAtState,
    setHasLoadedGitHubPrNotificationSeenAtState,
  ] = useState(false);
  const [gitHubTeamPrTrackerState, setGitHubTeamPrTrackerState] =
    useState<GitHubTeamPrTrackerState>({
      snapshotKeys: [],
      pendingNewKeys: [],
      lastProcessedUpdatedAt: null,
    });
  const [
    hasLoadedGitHubTeamPrTrackerState,
    setHasLoadedGitHubTeamPrTrackerState,
  ] = useState(false);

  useEffect(() => {
    let isMounted = true;

    getStoredGitHubSortOrder().then((storedSortOrder) => {
      if (!isMounted) {
        return;
      }

      setSortOrder(storedSortOrder);
      setHasLoadedSortOrder(true);
    });

    getStoredGitHubPrReadyState().then((storedReadyState) => {
      if (!isMounted) {
        return;
      }

      setGitHubPrReadyState(storedReadyState);
      setHasLoadedGitHubPrReadyState(true);
    });

    getStoredGitHubPrWarningState().then((storedWarningState) => {
      if (!isMounted) {
        return;
      }

      setGitHubPrWarningState(storedWarningState);
      setHasLoadedGitHubPrWarningState(true);
    });

    getStoredGitHubPrNotificationSeenAtState().then((storedSeenAtState) => {
      if (!isMounted) {
        return;
      }

      setGitHubPrNotificationSeenAtState(storedSeenAtState);
      setHasLoadedGitHubPrNotificationSeenAtState(true);
    });

    getStoredGitHubTeamPrTrackerState().then((storedTrackerState) => {
      if (!isMounted) {
        return;
      }

      setGitHubTeamPrTrackerState(storedTrackerState);
      setHasLoadedGitHubTeamPrTrackerState(true);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const unsubscribe = subscribeStoredValues(
      [
        GITHUB_PR_READY_STATE_STORAGE_KEY,
        GITHUB_PR_WARNING_STATE_STORAGE_KEY,
        GITHUB_PR_NOTIFICATION_SEEN_AT_STORAGE_KEY,
        GITHUB_TEAM_PR_TRACKER_STORAGE_KEY,
      ],
      (changedKeys) => {
        void (async () => {
          if (changedKeys.has(GITHUB_PR_READY_STATE_STORAGE_KEY)) {
            const storedReadyState = await getStoredGitHubPrReadyState();
            if (!isMounted) {
              return;
            }

            setGitHubPrReadyState((currentState) =>
              areGitHubPrReadyStatesExactlyEqual(currentState, storedReadyState)
                ? currentState
                : storedReadyState,
            );
            setHasLoadedGitHubPrReadyState(true);
          }

          if (changedKeys.has(GITHUB_PR_WARNING_STATE_STORAGE_KEY)) {
            const storedWarningState = await getStoredGitHubPrWarningState();
            if (!isMounted) {
              return;
            }

            setGitHubPrWarningState((currentState) =>
              areGitHubPrWarningStatesExactlyEqual(
                currentState,
                storedWarningState,
              )
                ? currentState
                : storedWarningState,
            );
            setHasLoadedGitHubPrWarningState(true);
          }

          if (changedKeys.has(GITHUB_PR_NOTIFICATION_SEEN_AT_STORAGE_KEY)) {
            const storedSeenAtState =
              await getStoredGitHubPrNotificationSeenAtState();
            if (!isMounted) {
              return;
            }

            setGitHubPrNotificationSeenAtState((currentState) =>
              areGitHubPrNotificationSeenAtStatesEqual(
                currentState,
                storedSeenAtState,
              )
                ? currentState
                : storedSeenAtState,
            );
            setHasLoadedGitHubPrNotificationSeenAtState(true);
          }

          if (changedKeys.has(GITHUB_TEAM_PR_TRACKER_STORAGE_KEY)) {
            const storedTrackerState = await getStoredGitHubTeamPrTrackerState();
            if (!isMounted) {
              return;
            }

            setGitHubTeamPrTrackerState((currentState) =>
              areGitHubTeamPrTrackerStatesEqual(
                currentState,
                storedTrackerState,
              )
                ? currentState
                : storedTrackerState,
            );
            setHasLoadedGitHubTeamPrTrackerState(true);
          }
        })();
      },
    );

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!hasLoadedSortOrder) {
      return;
    }

    void saveStoredGitHubSortOrder(sortOrder);
  }, [hasLoadedSortOrder, sortOrder]);

  useEffect(() => {
    if (!hasLoadedGitHubPrReadyState) {
      return;
    }

    void saveStoredGitHubPrReadyState(gitHubPrReadyState);
  }, [gitHubPrReadyState, hasLoadedGitHubPrReadyState]);

  useEffect(() => {
    if (!hasLoadedGitHubPrWarningState) {
      return;
    }

    void saveStoredGitHubPrWarningState(gitHubPrWarningState);
  }, [gitHubPrWarningState, hasLoadedGitHubPrWarningState]);

  useEffect(() => {
    if (!hasLoadedGitHubPrNotificationSeenAtState) {
      return;
    }

    void saveStoredGitHubPrNotificationSeenAtState(
      gitHubPrNotificationSeenAtState,
    );
  }, [
    gitHubPrNotificationSeenAtState,
    hasLoadedGitHubPrNotificationSeenAtState,
  ]);

  useEffect(() => {
    if (!hasLoadedGitHubTeamPrTrackerState) {
      return;
    }

    void saveStoredGitHubTeamPrTrackerState(gitHubTeamPrTrackerState);
  }, [gitHubTeamPrTrackerState, hasLoadedGitHubTeamPrTrackerState]);

  useEffect(() => {
    if (!hasLoadedGitHubPrReadyState) {
      return;
    }

    setGitHubPrReadyState((currentState) => {
      const nextState = buildGitHubPrReadyState(
        currentState,
        resolvedPullRequests,
      );
      return areGitHubPrReadyStatesEqual(currentState, nextState)
        ? currentState
        : nextState;
    });
  }, [hasLoadedGitHubPrReadyState, resolvedPullRequests]);

  useEffect(() => {
    if (!hasLoadedGitHubPrWarningState) {
      return;
    }

    setGitHubPrWarningState((currentState) => {
      const nextState = buildGitHubPrWarningState(
        currentState,
        resolvedPullRequests,
      );
      return areGitHubPrWarningStatesEqual(currentState, nextState)
        ? currentState
        : nextState;
    });
  }, [hasLoadedGitHubPrWarningState, resolvedPullRequests]);

  useEffect(() => {
    if (
      !hasLoadedGitHubPrNotificationSeenAtState ||
      connectionStatus !== 'connected' ||
      isLoading
    ) {
      return;
    }

    const activePullRequestKeys = new Set(
      [...resolvedPullRequests, ...visibleRecentOpenPullRequests].map(
        (pullRequest) => getGitHubPullRequestAttentionStateKey(pullRequest),
      ),
    );

    setGitHubPrNotificationSeenAtState((currentState) => {
      const nextState = Object.fromEntries(
        Object.entries(currentState).filter(([key]) =>
          activePullRequestKeys.has(key),
        ),
      );

      return Object.keys(nextState).length === Object.keys(currentState).length
        ? currentState
        : nextState;
    });
  }, [
    connectionStatus,
    hasLoadedGitHubPrNotificationSeenAtState,
    isLoading,
    resolvedPullRequests,
    visibleRecentOpenPullRequests,
  ]);

  useEffect(() => {
    if (
      !hasLoadedGitHubTeamPrTrackerState ||
      connectionStatus !== 'connected' ||
      isLoading
    ) {
      return;
    }

    setGitHubTeamPrTrackerState((currentState) =>
      getNextGitHubTeamPrTrackerState({
        currentState,
        visibleRecentOpenPullRequests,
        lastUpdatedAt,
      }),
    );
  }, [
    connectionStatus,
    lastUpdatedAt,
    hasLoadedGitHubTeamPrTrackerState,
    isLoading,
    visibleRecentOpenPullRequests,
  ]);

  function handleMarkPullRequestNotificationsSeen(
    pullRequest: GitHubPullRequestItem,
  ) {
    const pullRequestKey = getGitHubPullRequestAttentionStateKey(pullRequest);
    const nextSeenAt = Date.now();

    setGitHubPrNotificationSeenAtState((currentState) => {
      if (currentState[pullRequestKey] === nextSeenAt) {
        return currentState;
      }

      return {
        ...currentState,
        [pullRequestKey]: nextSeenAt,
      };
    });
  }

  function handleMarkTeamPrSeen(pullRequest: GitHubPullRequestItem) {
    const pullRequestKey = getGitHubPullRequestAttentionStateKey(pullRequest);

    setGitHubTeamPrTrackerState((currentState) => {
      if (!currentState.pendingNewKeys.includes(pullRequestKey)) {
        return currentState;
      }

      return {
        ...currentState,
        pendingNewKeys: currentState.pendingNewKeys.filter(
          (key) => key !== pullRequestKey,
        ),
      };
    });
  }

  function handleClearWarningHighlight(pullRequest: GitHubPullRequestItem) {
    const readyStateKey = getGitHubPullRequestAttentionStateKey(pullRequest);
    const warningStateKey = getGitHubPullRequestWarningStateKey(pullRequest);

    setGitHubPrReadyState((currentState) => {
      const currentEntry = currentState[readyStateKey];
      if (!currentEntry?.highlighted) {
        return currentState;
      }

      return {
        ...currentState,
        [readyStateKey]: {
          ...currentEntry,
          highlighted: false,
        },
      };
    });

    setGitHubPrWarningState((currentState) => {
      const currentEntry = currentState[warningStateKey];
      if (!currentEntry?.highlighted) {
        return currentState;
      }

      return {
        ...currentState,
        [warningStateKey]: {
          ...currentEntry,
          highlighted: false,
        },
      };
    });
  }

  return {
    sortOrder,
    setSortOrder,
    gitHubPrReadyState,
    gitHubPrWarningState,
    gitHubPrNotificationSeenAtState,
    hasLoadedGitHubPrNotificationSeenAtState,
    gitHubTeamPrTrackerState,
    hasLoadedGitHubTeamPrTrackerState,
    handleMarkPullRequestNotificationsSeen,
    handleMarkTeamPrSeen,
    handleClearWarningHighlight,
  };
}
