export type GitHubRefreshStatus = {
  cacheToken: string;
  status: 'success' | 'error';
  updatedAt: number;
  failureCount: number;
};

export function formatGitHubRefreshWarningTime(value: number) {
  return new Date(value).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function createGitHubCacheToken(
  username: string,
  token: string,
  ownerFilter = '',
) {
  const input = `${username}:${token}:${ownerFilter}`;
  let hash = 5381;

  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 33) ^ input.charCodeAt(index);
  }

  return `${username}:${(hash >>> 0).toString(16)}`;
}
