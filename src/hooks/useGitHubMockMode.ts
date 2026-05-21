import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  clearStoredGitHubMockScenarioKey,
  getStoredGitHubDevMode,
  getStoredGitHubMockScenarioKey,
  saveStoredGitHubDevMode,
  saveStoredGitHubMockScenarioKey
} from '../lib/storage';
import {
  DEFAULT_GITHUB_MOCK_SCENARIO_KEY,
  getGitHubMockScenarioByKey,
  type GitHubMockScenario
} from '../mocks/github/scenarios';

const IS_GITHUB_MOCK_MODE_AVAILABLE = Boolean(
  (import.meta as { env?: { DEV?: boolean } }).env?.DEV,
);

export function useGitHubMockMode() {
  const [isLoading, setIsLoading] = useState(true);
  const [isGitHubMockMode, setIsGitHubMockMode] = useState(false);
  const [gitHubMockScenarioKey, setGitHubMockScenarioKey] = useState<string | null>(null);

  const gitHubMockScenario = useMemo<GitHubMockScenario | null>(
    () =>
      isGitHubMockMode
        ? getGitHubMockScenarioByKey(gitHubMockScenarioKey ?? DEFAULT_GITHUB_MOCK_SCENARIO_KEY)
        : null,
    [gitHubMockScenarioKey, isGitHubMockMode]
  );

  useEffect(() => {
    let isActive = true;

    void (async () => {
      if (!IS_GITHUB_MOCK_MODE_AVAILABLE) {
        if (!isActive) {
          return;
        }

        setIsGitHubMockMode(false);
        setGitHubMockScenarioKey(null);
        setIsLoading(false);
        return;
      }

      const storedGitHubDevMode = await getStoredGitHubDevMode();
      const storedMockScenarioKey = await getStoredGitHubMockScenarioKey();

      if (!isActive) {
        return;
      }

      setIsGitHubMockMode(storedGitHubDevMode);
      setGitHubMockScenarioKey(
        storedGitHubDevMode ? storedMockScenarioKey ?? DEFAULT_GITHUB_MOCK_SCENARIO_KEY : null
      );
      setIsLoading(false);
    })();

    return () => {
      isActive = false;
    };
  }, []);

  const applyMockScenario = useCallback(async (nextMockScenarioKey: string) => {
    if (!IS_GITHUB_MOCK_MODE_AVAILABLE) {
      setIsGitHubMockMode(false);
      setGitHubMockScenarioKey(null);
      return;
    }

    await saveStoredGitHubDevMode(true);
    await saveStoredGitHubMockScenarioKey(nextMockScenarioKey);

    setIsGitHubMockMode(true);
    setGitHubMockScenarioKey(nextMockScenarioKey);
  }, []);

  const clearMockScenario = useCallback(async () => {
    if (!IS_GITHUB_MOCK_MODE_AVAILABLE) {
      setIsGitHubMockMode(false);
      setGitHubMockScenarioKey(null);
      return;
    }

    await saveStoredGitHubDevMode(false);
    await clearStoredGitHubMockScenarioKey();

    setIsGitHubMockMode(false);
    setGitHubMockScenarioKey(null);
  }, []);

  const setGitHubDevMode = useCallback(
    async (isEnabled: boolean) => {
      if (!IS_GITHUB_MOCK_MODE_AVAILABLE) {
        setIsGitHubMockMode(false);
        setGitHubMockScenarioKey(null);
        return;
      }

      if (isEnabled) {
        await applyMockScenario(gitHubMockScenarioKey ?? DEFAULT_GITHUB_MOCK_SCENARIO_KEY);
        return;
      }

      await clearMockScenario();
    },
    [applyMockScenario, clearMockScenario, gitHubMockScenarioKey]
  );

  return {
    isLoading,
    isGitHubMockModeAvailable: IS_GITHUB_MOCK_MODE_AVAILABLE,
    isGitHubMockMode,
    gitHubMockScenarioKey,
    gitHubMockScenario,
    applyMockScenario,
    clearMockScenario,
    setGitHubDevMode
  };
}
