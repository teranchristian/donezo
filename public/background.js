const JIRA_ISSUES_CACHE_KEY = 'jira-issues-cache-v3';
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
  const blockingIssues = getBlockingIssues(issue);
  const blockedByIssues = getBlockedByIssues(issue);

  console.log('Normalized Jira issue:', {
    key: issue?.key,
    issueLinks,
    blockingIssues,
    blockedByIssues
  });

  return {
    id: String(issue?.id ?? ''),
    key: String(issue?.key ?? ''),
    summary: String(issue?.fields?.summary ?? ''),
    updated: String(issue?.fields?.updated ?? ''),
    blockingCount: blockingIssues.length,
    blockingIssues,
    blockedByIssues,
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

function getBlockingIssues(issue) {
  return getIssueLinks(issue)
    .filter((link) => getIssueRelationshipType(link) === 'blocks')
    .map((link) => getRelatedIssue(link))
    .filter((linkedIssue) => Boolean(linkedIssue.key));
}

function getBlockedByIssues(issue) {
  return getIssueLinks(issue)
    .filter((link) => getIssueRelationshipType(link) === 'blocked-by')
    .map((link) => getRelatedIssue(link))
    .filter((linkedIssue) => Boolean(linkedIssue.key));
}

function getIssueLinks(issue) {
  return Array.isArray(issue?.fields?.issuelinks) ? issue.fields.issuelinks : [];
}

function getIssueRelationshipType(link) {
  if (link?.type?.name !== 'Blocks') {
    return null;
  }

  const inwardLabel = String(link?.type?.inward ?? '').trim().toLowerCase();
  const outwardLabel = String(link?.type?.outward ?? '').trim().toLowerCase();

  if (outwardLabel === 'blocks') {
    if (link?.inwardIssue) {
      return 'blocks';
    }

    if (link?.outwardIssue) {
      return 'blocked-by';
    }
  }

  if (inwardLabel === 'is blocked by') {
    if (link?.inwardIssue) {
      return 'blocked-by';
    }

    if (link?.outwardIssue) {
      return 'blocks';
    }
  }

  if (link?.outwardIssue) {
    return 'blocks';
  }

  if (link?.inwardIssue) {
    return 'blocked-by';
  }

  return null;
}

function getRelatedIssue(link) {
  const relationshipType = getIssueRelationshipType(link);
  const linkedIssue =
    relationshipType === 'blocks'
      ? (link?.inwardIssue ?? link?.outwardIssue)
      : (link?.outwardIssue ?? link?.inwardIssue);

  return {
    key: String(linkedIssue?.key ?? ''),
    summary: linkedIssue?.fields?.summary,
    status: linkedIssue?.fields?.status?.name,
    assignee: linkedIssue?.fields?.assignee?.displayName
  };
}

function getMissingBlockingIssueKeys(issues) {
  const missingKeys = new Set();

  issues.forEach((issue) => {
    [...getBlockingIssues(issue), ...getBlockedByIssues(issue)].forEach((linkedIssue) => {
      if (!linkedIssue.summary || !linkedIssue.status || !linkedIssue.assignee) {
        missingKeys.add(linkedIssue.key);
      }
    });
  });

  return Array.from(missingKeys);
}

function escapeJqlValue(value) {
  return String(value ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function mergeBlockingIssueDetails(issues, issueDetailsByKey) {
  return issues.map((issue) => {
    const issueLinks = Array.isArray(issue?.fields?.issuelinks) ? issue.fields.issuelinks : [];

    return {
      ...issue,
      fields: {
        ...issue.fields,
        issuelinks: issueLinks.map((link) => {
          const linkedIssue = getRelatedIssue(link);
          if (!linkedIssue.key || !issueDetailsByKey[linkedIssue.key]) {
            return link;
          }

          const linkedIssueKey = linkedIssue.key;
          const relationshipType = getIssueRelationshipType(link);
          const targetField =
            relationshipType === 'blocks'
              ? (link?.inwardIssue ? 'inwardIssue' : 'outwardIssue')
              : (link?.outwardIssue ? 'outwardIssue' : 'inwardIssue');

          return {
            ...link,
            [targetField]: {
              ...link[targetField],
              fields: {
                ...link[targetField]?.fields,
                ...issueDetailsByKey[linkedIssueKey]
              }
            }
          };
        })
      }
    };
  });
}

async function fetchBlockingIssueDetails(jiraBaseUrl, auth, issueKeys) {
  if (issueKeys.length === 0) {
    return {};
  }

  const result = await fetchJira(`${jiraBaseUrl}/rest/api/3/search/jql`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      jql: `issuekey in (${issueKeys.map((issueKey) => `"${escapeJqlValue(issueKey)}"`).join(', ')})`,
      fields: ['summary', 'status', 'assignee'],
      maxResults: issueKeys.length
    })
  });

  if (!result.success) {
    return {};
  }

  const data = await result.response.json();
  const issues = Array.isArray(data.issues) ? data.issues : [];

  return issues.reduce((accumulator, issue) => {
    const issueKey = String(issue?.key ?? '');
    if (!issueKey) {
      return accumulator;
    }

    accumulator[issueKey] = {
      summary: issue?.fields?.summary,
      status: issue?.fields?.status
        ? {
            name: issue.fields.status.name
          }
        : undefined,
      assignee: issue?.fields?.assignee
        ? {
            displayName: issue.fields.assignee.displayName
          }
        : undefined
    };

    return accumulator;
  }, {});
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
      console.log('Jira search response:', data);
      const fetchedIssues = Array.isArray(data.issues) ? data.issues : [];

      fetchedIssues.forEach((issue) => {
        console.log('Issue links:', {
          key: issue?.key,
          issuelinks: issue?.fields?.issuelinks
        });
      });

      const missingBlockingIssueKeys = getMissingBlockingIssueKeys(fetchedIssues);
      console.log('Missing blocking issue keys:', missingBlockingIssueKeys);
      const blockingIssueDetailsByKey = await fetchBlockingIssueDetails(
        jiraBaseUrl,
        auth,
        missingBlockingIssueKeys
      );
      console.log('Blocking issue details response:', blockingIssueDetailsByKey);
      const issues = mergeBlockingIssueDetails(fetchedIssues, blockingIssueDetailsByKey).map(normalizeJiraIssue);

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
