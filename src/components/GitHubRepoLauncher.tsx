import { useEffect, useRef, useState } from 'react';
import type { GitHubRepository } from '../lib/githubApi';

type GitHubRepoLauncherProps = {
  isOpen: boolean;
  isLoading: boolean;
  ownerFilter: string;
  query: string;
  results: GitHubRepository[];
  selectedIndex: number;
  totalRepositoryCount: number;
  totalVisibleRepositoryCount: number;
  onOpen: () => void;
  onClose: () => void;
  onQueryChange: (value: string) => void;
  onSelectIndex: (index: number) => void;
  onSelectNext: () => void;
  onSelectPrevious: () => void;
  onOpenSelected: () => void;
  onOpenResult: (index: number) => void;
  onHideRepository: (repository: GitHubRepository) => Promise<void>;
};

const HIDE_ANIMATION_DURATION_MS = 180;

export function GitHubRepoLauncher({
  isOpen,
  isLoading,
  ownerFilter,
  query,
  results,
  selectedIndex,
  totalRepositoryCount,
  totalVisibleRepositoryCount,
  onOpen,
  onClose,
  onQueryChange,
  onSelectIndex,
  onSelectNext,
  onSelectPrevious,
  onOpenSelected,
  onOpenResult,
  onHideRepository
}: GitHubRepoLauncherProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [hidingRepositoryIds, setHidingRepositoryIds] = useState<number[]>([]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      return;
    }

    setHidingRepositoryIds([]);
  }, [isOpen]);

  async function handleHideRepository(repository: GitHubRepository) {
    if (hidingRepositoryIds.includes(repository.id)) {
      return;
    }

    setHidingRepositoryIds((current) => [...current, repository.id]);

    await new Promise((resolve) => {
      window.setTimeout(resolve, HIDE_ANIMATION_DURATION_MS);
    });

    try {
      await onHideRepository(repository);
    } catch {
      setHidingRepositoryIds((current) => current.filter((id) => id !== repository.id));
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={onOpen}
        className="repo-launcher-trigger"
        aria-label="Open repository launcher"
      >
        <span className="repo-launcher-trigger__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="11" cy="11" r="6.5" />
            <path d="M16 16l4 4" strokeLinecap="round" />
          </svg>
        </span>
        <span className="repo-launcher-trigger__label">Repos</span>
        <span className="repo-launcher-trigger__hint">⌘K</span>
      </button>

      {isOpen ? (
        <div className="repo-launcher-overlay" role="dialog" aria-modal="true">
          <button
            type="button"
            className="repo-launcher-backdrop"
            aria-label="Close repository launcher"
            onClick={onClose}
          />
          <div className="repo-launcher-panel">
            <div className="repo-launcher-search">
              <span className="repo-launcher-search__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <circle cx="11" cy="11" r="6.5" />
                  <path d="M16 16l4 4" strokeLinecap="round" />
                </svg>
              </span>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowDown') {
                    event.preventDefault();
                    onSelectNext();
                    return;
                  }

                  if (event.key === 'ArrowUp') {
                    event.preventDefault();
                    onSelectPrevious();
                    return;
                  }

                  if (event.key === 'Enter') {
                    event.preventDefault();
                    onOpenSelected();
                  }
                }}
                placeholder="Search repositories"
                className="repo-launcher-input"
              />
              <button
                type="button"
                onClick={onClose}
                className="repo-launcher-close"
                aria-label="Close repository launcher"
              >
                Esc
              </button>
            </div>

            <div className="repo-launcher-meta">
              <span>{ownerFilter.trim() ? `Owner: ${ownerFilter.trim()}` : 'Owner: all'}</span>
              <span>
                {totalVisibleRepositoryCount === totalRepositoryCount
                  ? `${totalRepositoryCount} repos indexed`
                  : `${totalVisibleRepositoryCount} visible of ${totalRepositoryCount}`}
              </span>
            </div>

            <div className="repo-launcher-results">
              {isLoading ? (
                <div className="repo-launcher-empty">Loading repositories…</div>
              ) : results.length === 0 ? (
                <div className="repo-launcher-empty">
                  {query.trim()
                    ? 'No repositories matched that search.'
                    : 'Start typing to search repositories.'}
                </div>
              ) : (
                results.map((repository, index) => {
                  const isHiding = hidingRepositoryIds.includes(repository.id);

                  return (
                  <div
                    key={repository.id}
                    onClick={() => {
                      if (!isHiding) {
                        onOpenResult(index);
                      }
                    }}
                    onMouseEnter={() => {
                      if (!isHiding) {
                        onSelectIndex(index);
                      }
                    }}
                    onKeyDown={(event) => {
                      if (isHiding) {
                        return;
                      }

                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onOpenResult(index);
                      }
                    }}
                    role="button"
                    tabIndex={isHiding ? -1 : 0}
                    className={`repo-launcher-result ${
                      index === selectedIndex ? 'repo-launcher-result--active' : ''
                    } ${isHiding ? 'repo-launcher-result--hiding' : ''}`}
                  >
                    <div className="repo-launcher-result__titleRow">
                      <span className="repo-launcher-result__title">{repository.name}</span>
                      {index === 0 ? (
                        <span className="repo-launcher-result__badge">Best match</span>
                      ) : null}
                    </div>
                    <div className="repo-launcher-result__meta">
                      <span>{repository.fullName}</span>
                      <span className="repo-launcher-result__actions">
                        <span>{repository.isPrivate ? 'Private' : 'Public'}</span>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            void handleHideRepository(repository);
                          }}
                          className="repo-launcher-hide"
                          aria-label={`Hide ${repository.fullName}`}
                          title="Hide from search results"
                          disabled={isHiding}
                        >
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            aria-hidden="true"
                            className="repo-launcher-hide__icon"
                          >
                            <path
                              fillRule="evenodd"
                              clipRule="evenodd"
                              d="M3.61399 4.21063C3.17804 3.87156 2.54976 3.9501 2.21069 4.38604C1.87162 4.82199 1.95016 5.45027 2.38611 5.78934L4.66386 7.56093C3.78436 8.54531 3.03065 9.68043 2.41854 10.896L2.39686 10.9389C2.30554 11.1189 2.18764 11.3514 2.1349 11.6381C2.09295 11.8661 2.09295 12.1339 2.1349 12.3618C2.18764 12.6485 2.30554 12.881 2.39686 13.0611L2.41854 13.104C4.35823 16.956 7.71985 20 12.0001 20C14.2313 20 16.2129 19.1728 17.8736 17.8352L20.3861 19.7893C20.8221 20.1284 21.4503 20.0499 21.7894 19.6139C22.1285 19.178 22.0499 18.5497 21.614 18.2106L3.61399 4.21063ZM16.2411 16.5654L14.4434 15.1672C13.7676 15.6894 12.9201 16 12.0001 16C9.79092 16 8.00006 14.2091 8.00006 12C8.00006 11.4353 8.11706 10.898 8.32814 10.4109L6.24467 8.79044C5.46659 9.63971 4.77931 10.6547 4.20485 11.7955C4.17614 11.8525 4.15487 11.8948 4.13694 11.9316C4.12114 11.964 4.11132 11.9853 4.10491 12C4.11132 12.0147 4.12114 12.036 4.13694 12.0684C4.15487 12.1052 4.17614 12.1474 4.20485 12.2045C5.9597 15.6894 8.76726 18 12.0001 18C13.5314 18 14.9673 17.4815 16.2411 16.5654ZM10.0187 11.7258C10.0064 11.8154 10.0001 11.907 10.0001 12C10.0001 13.1046 10.8955 14 12.0001 14C12.2667 14 12.5212 13.9478 12.7538 13.8531L10.0187 11.7258Z"
                              fill="currentColor"
                            />
                            <path
                              d="M10.9506 8.13908L15.9995 12.0661C15.9999 12.0441 16.0001 12.022 16.0001 12C16.0001 9.79085 14.2092 7.99999 12.0001 7.99999C11.6369 7.99999 11.285 8.04838 10.9506 8.13908Z"
                              fill="currentColor"
                            />
                            <path
                              d="M19.7953 12.2045C19.4494 12.8913 19.0626 13.5326 18.6397 14.1195L20.2175 15.3467C20.7288 14.6456 21.1849 13.8917 21.5816 13.104L21.6033 13.0611C21.6946 12.881 21.8125 12.6485 21.8652 12.3618C21.9072 12.1339 21.9072 11.8661 21.8652 11.6381C21.8125 11.3514 21.6946 11.1189 21.6033 10.9389L21.5816 10.896C19.6419 7.04402 16.2803 3.99998 12.0001 3.99998C10.2848 3.99998 8.71714 4.48881 7.32934 5.32257L9.05854 6.66751C9.98229 6.23476 10.9696 5.99998 12.0001 5.99998C15.2329 5.99998 18.0404 8.31058 19.7953 11.7955C19.824 11.8525 19.8453 11.8948 19.8632 11.9316C19.879 11.964 19.8888 11.9853 19.8952 12C19.8888 12.0147 19.879 12.036 19.8632 12.0684C19.8453 12.1052 19.824 12.1474 19.7953 12.2045Z"
                              fill="currentColor"
                            />
                          </svg>
                        </button>
                      </span>
                    </div>
                  </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
