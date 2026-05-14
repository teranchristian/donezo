import type { GitHubRepository } from './githubApi';

export function getRankedGitHubRepositories(
  repositories: GitHubRepository[],
  query: string,
  limit = 8
) {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return [];
  }

  const normalizedQuery = normalizeSearchValue(trimmedQuery);
  const queryTokens = normalizedQuery.split(' ').filter(Boolean);

  return repositories
    .map((repository) => ({
      repository,
      score: getRepositorySearchScore(repository, normalizedQuery, queryTokens)
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      const updatedDifference =
        new Date(right.repository.updatedAt).getTime() -
        new Date(left.repository.updatedAt).getTime();
      if (updatedDifference !== 0) {
        return updatedDifference;
      }

      return left.repository.fullName.localeCompare(right.repository.fullName);
    })
    .slice(0, limit)
    .map((entry) => entry.repository);
}

function getRepositorySearchScore(
  repository: GitHubRepository,
  normalizedQuery: string,
  queryTokens: string[]
) {
  const normalizedName = normalizeSearchValue(repository.name);
  const normalizedFullName = normalizeSearchValue(repository.fullName);
  const normalizedOwner = normalizeSearchValue(repository.owner);
  const searchable = `${normalizedFullName} ${normalizedOwner}`;

  if (queryTokens.some((token) => !searchable.includes(token))) {
    return 0;
  }

  if (normalizedName === normalizedQuery) {
    return 1200;
  }

  if (normalizedFullName === normalizedQuery) {
    return 1150;
  }

  if (normalizedName.startsWith(normalizedQuery)) {
    return 1000 - normalizedName.length;
  }

  if (normalizedFullName.startsWith(normalizedQuery)) {
    return 930 - normalizedFullName.length;
  }

  const segmentNameIndex = getSegmentMatchIndex(normalizedName, normalizedQuery);
  if (segmentNameIndex >= 0) {
    return 860 - segmentNameIndex * 5;
  }

  const segmentFullNameIndex = getSegmentMatchIndex(normalizedFullName, normalizedQuery);
  if (segmentFullNameIndex >= 0) {
    return 800 - segmentFullNameIndex * 4;
  }

  const nameMatchIndex = normalizedName.indexOf(normalizedQuery);
  if (nameMatchIndex >= 0) {
    return 720 - nameMatchIndex * 3;
  }

  const fullNameMatchIndex = normalizedFullName.indexOf(normalizedQuery);
  if (fullNameMatchIndex >= 0) {
    return 660 - fullNameMatchIndex * 2;
  }

  return 420 - normalizedFullName.length;
}

function getSegmentMatchIndex(value: string, query: string) {
  const segments = value.split(/[\s/_-]+/).filter(Boolean);
  let cursor = 0;

  for (const segment of segments) {
    const index = segment.indexOf(query);
    if (index === 0) {
      return cursor;
    }

    cursor += segment.length + 1;
  }

  return -1;
}

function normalizeSearchValue(value: string) {
  return value.trim().toLowerCase().replace(/[_/.-]+/g, ' ').replace(/\s+/g, ' ');
}
