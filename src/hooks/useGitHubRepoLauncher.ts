import { useEffect, useState } from 'react';
import {
  getLatestGitHubRepoIndex,
  loadGitHubRepoIndex,
  type GitHubConnectionStatus,
  type GitHubRepository
} from '../lib/githubApi';
import { getRankedGitHubRepositories } from '../lib/githubRepoSearchDomain';
import type { GitHubHiddenRepository } from '../lib/storage';

type UseGitHubRepoLauncherOptions = {
  username: string;
  token: string;
  ownerFilter: string;
  hiddenRepositories: GitHubHiddenRepository[];
  connectionStatus: GitHubConnectionStatus;
  isLoadingSettings: boolean;
};

const RESULT_LIMIT = 8;

export function useGitHubRepoLauncher({
  username,
  token,
  ownerFilter,
  hiddenRepositories,
  connectionStatus,
  isLoadingSettings
}: UseGitHubRepoLauncherOptions) {
  const [repositories, setRepositories] = useState<GitHubRepository[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    if (isLoadingSettings) {
      return;
    }

    const trimmedToken = token.trim();
    if (!trimmedToken || connectionStatus !== 'connected') {
      setRepositories([]);
      setIsLoading(false);
      return;
    }

    let isCancelled = false;

    void (async () => {
      const cachedRepositories = await getLatestGitHubRepoIndex({
        username,
        token: trimmedToken,
        ownerFilter
      });

      if (isCancelled) {
        return;
      }

      if (cachedRepositories.length > 0) {
        setRepositories(cachedRepositories);
      }

      setIsLoading(cachedRepositories.length === 0);

      const nextRepositories = await loadGitHubRepoIndex({
        username,
        token: trimmedToken,
        ownerFilter,
        forceRefresh: cachedRepositories.length > 0
      });

      if (isCancelled) {
        return;
      }

      setRepositories(nextRepositories);
      setIsLoading(false);
    })();

    return () => {
      isCancelled = true;
    };
  }, [connectionStatus, isLoadingSettings, ownerFilter, token, username]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setIsOpen(true);
        return;
      }

      if (!isOpen) {
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        setIsOpen(false);
      }
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const hiddenRepositoryFullNames = new Set(
    hiddenRepositories.map((repository) => repository.fullName)
  );
  const visibleRepositories = repositories.filter(
    (repository) => !hiddenRepositoryFullNames.has(repository.fullName)
  );
  const results = getRankedGitHubRepositories(visibleRepositories, query, RESULT_LIMIT);
  const selectedRepository = results[selectedIndex] ?? null;

  useEffect(() => {
    if (selectedIndex >= results.length) {
      setSelectedIndex(0);
    }
  }, [results.length, selectedIndex]);

  function openLauncher() {
    setQuery('');
    setSelectedIndex(0);
    setIsOpen(true);
  }

  function closeLauncher() {
    setQuery('');
    setSelectedIndex(0);
    setIsOpen(false);
  }

  function updateQuery(value: string) {
    setQuery(value);
    setSelectedIndex(0);
  }

  function selectNextResult() {
    setSelectedIndex((current) => {
      if (results.length === 0) {
        return 0;
      }

      return (current + 1) % results.length;
    });
  }

  function selectPreviousResult() {
    setSelectedIndex((current) => {
      if (results.length === 0) {
        return 0;
      }

      return current === 0 ? results.length - 1 : current - 1;
    });
  }

  function openSelectedRepository() {
    if (!selectedRepository) {
      return;
    }

    window.open(selectedRepository.url, '_blank', 'noopener,noreferrer');
    closeLauncher();
  }

  function openRepositoryAtIndex(index: number) {
    const repository = results[index];
    if (!repository) {
      return;
    }

    window.open(repository.url, '_blank', 'noopener,noreferrer');
    setSelectedIndex(index);
    closeLauncher();
  }

  return {
    repositories,
    visibleRepositories,
    isLoading,
    isOpen,
    query,
    results,
    selectedIndex,
    selectedRepository,
    openLauncher,
    closeLauncher,
    updateQuery,
    setSelectedIndex,
    selectNextResult,
    selectPreviousResult,
    openSelectedRepository,
    openRepositoryAtIndex
  };
}
