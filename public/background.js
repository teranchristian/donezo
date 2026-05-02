const JIRA_ISSUES_CACHE_KEY = 'jira-issues-cache-v2';
const JIRA_CACHE_TTL_MS = 5 * 60 * 1000;
const JIRA_ACTIVE_ISSUES_JQL =
  'assignee = currentUser() AND statusCategory != Done ORDER BY priority DESC, updated DESC';

function normalizeJiraBaseUrl(baseUrl) {
  return String(baseUrl ?? '').trim().replace(/\/+$/, '');
}

function encodeBasicAuth(email, apiToken) {
  return btoa(`${email}:${apiToken}`);
}

function createJiraCredentialsKey(jiraBaseUrl, jiraEmail, jiraApiToken) {
  return JSON.stringify({
    jiraBaseUrl,
    jiraEmail,
    jiraApiToken
  });
}

async function getCachedJiraIssues(credentialsKey) {
  const result = await chrome.storage.local.get(JIRA_ISSUES_CACHE_KEY);
  const cached = result[JIRA_ISSUES_CACHE_KEY];

  if (!cached || cached.credentialsKey !== credentialsKey) {
    return null;
  }

  if (Date.now() - cached.fetchedAt > JIRA_CACHE_TTL_MS) {
    return null;
  }

  return cached.issues;
}

async function saveCachedJiraIssues(credentialsKey, issues) {
  await chrome.storage.local.set({
    [JIRA_ISSUES_CACHE_KEY]: {
      credentialsKey,
      fetchedAt: Date.now(),
      issues
    }
  });
}

function normalizeJiraIssue(issue) {
  const issueLinks = Array.isArray(issue?.fields?.issuelinks) ? issue.fields.issuelinks : [];
  const blockingCount = issueLinks.filter(
    (link) => link?.type?.name === 'Blocks' && Boolean(link?.outwardIssue)
  ).length;

  return {
    id: String(issue?.id ?? ''),
    key: String(issue?.key ?? ''),
    summary: String(issue?.fields?.summary ?? ''),
    updated: String(issue?.fields?.updated ?? ''),
    blockingCount,
    status: {
      name: String(issue?.fields?.status?.name ?? 'Unknown'),
      statusCategory: issue?.fields?.status?.statusCategory
        ? {
            key: issue.fields.status.statusCategory.key,
            name: issue.fields.status.statusCategory.name
          }
        : undefined
    },
    priority: issue?.fields?.priority
      ? {
          name: issue.fields.priority.name
        }
      : undefined,
    issuelinks: issueLinks
  };
}

async function fetchJira(endpoint, options) {
  const response = await fetch(endpoint, options);

  if (response.status === 401) {
    return { success: false, status: 401, error: 'Invalid credentials' };
  }

  if (!response.ok) {
    return {
      success: false,
      status: response.status,
      error: `Jira request failed with status ${response.status}`
    };
  }

  return { success: true, response };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== 'TEST_JIRA_CONNECTION' && message?.type !== 'FETCH_JIRA_ISSUES') {
    return false;
  }

  void (async () => {
    const payload = message?.payload ?? {};
    const jiraBaseUrl = normalizeJiraBaseUrl(payload.jiraBaseUrl);
    const jiraEmail = String(payload.jiraEmail ?? '').trim();
    const jiraApiToken = String(payload.jiraApiToken ?? '').trim();

    if (!jiraBaseUrl || !jiraEmail || !jiraApiToken) {
      sendResponse({ success: false, error: 'Missing Jira credentials' });
      return;
    }

    const auth = encodeBasicAuth(jiraEmail, jiraApiToken);

    if (message.type === 'TEST_JIRA_CONNECTION') {
      try {
        const result = await fetchJira(`${jiraBaseUrl}/rest/api/3/myself`, {
          method: 'GET',
          headers: {
            Authorization: `Basic ${auth}`,
            Accept: 'application/json'
          }
        });

        if (!result.success) {
          sendResponse(result);
          return;
        }

        const data = await result.response.json();
        sendResponse({ success: true, user: data });
      } catch (error) {
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to reach Jira'
        });
      }

      return;
    }

    const forceRefresh = Boolean(payload.forceRefresh);
    const credentialsKey = createJiraCredentialsKey(jiraBaseUrl, jiraEmail, jiraApiToken);

    try {
      if (!forceRefresh) {
        const cachedIssues = await getCachedJiraIssues(credentialsKey);
        if (cachedIssues) {
          sendResponse({ success: true, issues: cachedIssues });
          return;
        }
      }

      const result = await fetchJira(`${jiraBaseUrl}/rest/api/3/search/jql`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          Accept: 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          jql: JIRA_ACTIVE_ISSUES_JQL,
          fields: ['summary', 'status', 'priority', 'updated', 'issuelinks'],
          maxResults: 50
        })
      });

      if (!result.success) {
        sendResponse(result);
        return;
      }

      const data = await result.response.json();
      const issues = Array.isArray(data.issues) ? data.issues.map(normalizeJiraIssue) : [];

      await saveCachedJiraIssues(credentialsKey, issues);
      sendResponse({ success: true, issues });
    } catch (error) {
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load Jira issues'
      });
    }
  })();

  return true;
});
