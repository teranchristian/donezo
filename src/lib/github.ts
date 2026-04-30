export type GitHubConnectionStatus = 'not-connected' | 'testing' | 'connected' | 'invalid' | 'error';

export async function testGitHubConnection(token: string): Promise<GitHubConnectionStatus> {
  const trimmedToken = token.trim();
  if (!trimmedToken) {
    return 'not-connected';
  }

  try {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${trimmedToken}`
      }
    });

    if (response.ok) {
      return 'connected';
    }

    if (response.status === 401) {
      return 'invalid';
    }

    return 'error';
  } catch {
    return 'error';
  }
}
