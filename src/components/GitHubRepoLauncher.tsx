import { useEffect, useRef } from 'react';
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
  onHideRepository: (repository: GitHubRepository) => void;
};

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
                results.map((repository, index) => (
                  <div
                    key={repository.id}
                    onClick={() => onOpenResult(index)}
                    onMouseEnter={() => onSelectIndex(index)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onOpenResult(index);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    className={`repo-launcher-result ${
                      index === selectedIndex ? 'repo-launcher-result--active' : ''
                    }`}
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
                            onHideRepository(repository);
                          }}
                          className="repo-launcher-hide"
                        >
                          Hide
                        </button>
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
