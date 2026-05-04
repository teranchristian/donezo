export type Note = {
  id: string;
  text: string;
  createdAt: number;
};

export type FocusStatusTone = 'violet' | 'emerald' | 'amber';

type FocusItemBase = {
  id: string;
  sourceLabel: string;
  reference: string;
  title: string;
  statusLabel: string;
  statusTone: FocusStatusTone;
};

export type FocusPullRequestItem = FocusItemBase & {
  source: 'github';
  jiraKey: string | null;
};

export type FocusJiraItem = FocusItemBase & {
  source: 'jira';
  jiraKey: string;
  children: FocusPullRequestItem[];
  isPlaceholder?: boolean;
};

export type FocusItem = FocusJiraItem | FocusPullRequestItem;

type LegacyFocusItem = {
  id: string;
  source: 'jira' | 'github';
  sourceLabel: string;
  reference: string;
  title: string;
  statusLabel: string;
  statusTone: FocusStatusTone;
};

const NOTES_STORAGE_KEY = 'dashboard-notes';
const TODAY_FOCUS_ITEMS_STORAGE_KEY = 'today-focus-items';
const SETTINGS_STORAGE_KEY = 'dashboard-settings';
const GITHUB_OWNER_FILTER_STORAGE_KEY = 'githubOwnerFilter';
const GITHUB_SORT_ORDER_STORAGE_KEY = 'githubSortOrder';
const GITHUB_PR_STATUS_FILTER_STORAGE_KEY = 'githubPrStatusFilter';
const JIRA_BASE_URL_STORAGE_KEY = 'jiraBaseUrl';
const JIRA_EMAIL_STORAGE_KEY = 'jiraEmail';
const JIRA_API_TOKEN_STORAGE_KEY = 'jiraApiToken';
const ACTIVE_INTEGRATION_STORAGE_KEY = 'activeIntegration';
const ACTIVE_GITHUB_VIEW_STORAGE_KEY = 'activeGitHubView';
const ACTIVE_JIRA_VIEW_STORAGE_KEY = 'activeJiraView';

export type DashboardSettings = {
  name: string;
  integrations: {
    github: {
      username: string;
      token: string;
    };
    jira: {
      baseUrl: string;
      email: string;
      apiToken: string;
    };
  };
};

export type GitHubListOrganizationFilter = 'all' | string;
export type GitHubListSort =
  | 'recently-updated'
  | 'oldest-updated'
  | 'repository-asc'
  | 'title-asc';
export type GitHubPrStatusFilter = 'all' | 'approved' | 'waiting-review';
export type ActiveIntegration = 'github' | 'jira';
export type ActiveGitHubView = 'prs' | 'notifications' | 'review';
export type ActiveJiraView = 'active' | 'in-progress' | 'blocking' | 'high-priority';

const DEFAULT_SETTINGS: DashboardSettings = {
  name: '',
  integrations: {
    github: {
      username: '',
      token: ''
    },
    jira: {
      baseUrl: '',
      email: '',
      apiToken: ''
    }
  }
};

const DEFAULT_GITHUB_OWNER_FILTER: GitHubListOrganizationFilter = 'all';
const DEFAULT_GITHUB_SORT_ORDER: GitHubListSort = 'recently-updated';
const DEFAULT_GITHUB_PR_STATUS_FILTER: GitHubPrStatusFilter = 'all';
const DEFAULT_ACTIVE_INTEGRATION: ActiveIntegration = 'github';
const DEFAULT_ACTIVE_GITHUB_VIEW: ActiveGitHubView = 'prs';
const DEFAULT_ACTIVE_JIRA_VIEW: ActiveJiraView = 'active';

function hasChromeStorage() {
  return typeof chrome !== 'undefined' && Boolean(chrome.storage?.local);
}

async function saveStoredNotes(notes: Note[]) {
  if (hasChromeStorage()) {
    await chrome.storage.local.set({ [NOTES_STORAGE_KEY]: notes });
    return;
  }

  localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(notes));
}

export async function getStoredNotes() {
  if (hasChromeStorage()) {
    const result = await chrome.storage.local.get(NOTES_STORAGE_KEY);
    return (result[NOTES_STORAGE_KEY] as Note[] | undefined) ?? [];
  }

  const raw = localStorage.getItem(NOTES_STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    return JSON.parse(raw) as Note[];
  } catch {
    return [];
  }
}

export { saveStoredNotes };

export async function getStoredTodayFocusItems() {
  if (hasChromeStorage()) {
    const result = await chrome.storage.local.get(TODAY_FOCUS_ITEMS_STORAGE_KEY);
    return mergeFocusItems(result[TODAY_FOCUS_ITEMS_STORAGE_KEY] as FocusItem[] | undefined);
  }

  const raw = localStorage.getItem(TODAY_FOCUS_ITEMS_STORAGE_KEY);
  if (raw === null) {
    return null;
  }

  try {
    return mergeFocusItems(JSON.parse(raw) as FocusItem[]);
  } catch {
    return [];
  }
}

export async function saveStoredTodayFocusItems(items: FocusItem[]) {
  const normalizedItems = mergeFocusItems(items) ?? [];

  if (hasChromeStorage()) {
    await chrome.storage.local.set({ [TODAY_FOCUS_ITEMS_STORAGE_KEY]: normalizedItems });
    return;
  }

  localStorage.setItem(TODAY_FOCUS_ITEMS_STORAGE_KEY, JSON.stringify(normalizedItems));
}

export async function getStoredSettings() {
  if (hasChromeStorage()) {
    const result = await chrome.storage.local.get([
      SETTINGS_STORAGE_KEY,
      JIRA_BASE_URL_STORAGE_KEY,
      JIRA_EMAIL_STORAGE_KEY,
      JIRA_API_TOKEN_STORAGE_KEY
    ]);

    return mergeSettings(result[SETTINGS_STORAGE_KEY] as Partial<DashboardSettings> | undefined, {
      baseUrl: result[JIRA_BASE_URL_STORAGE_KEY] as string | undefined,
      email: result[JIRA_EMAIL_STORAGE_KEY] as string | undefined,
      apiToken: result[JIRA_API_TOKEN_STORAGE_KEY] as string | undefined
    });
  }

  const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
  const jiraBaseUrl = localStorage.getItem(JIRA_BASE_URL_STORAGE_KEY) ?? undefined;
  const jiraEmail = localStorage.getItem(JIRA_EMAIL_STORAGE_KEY) ?? undefined;
  const jiraApiToken = localStorage.getItem(JIRA_API_TOKEN_STORAGE_KEY) ?? undefined;
  try {
    return mergeSettings(raw ? (JSON.parse(raw) as Partial<DashboardSettings>) : undefined, {
      baseUrl: jiraBaseUrl ?? undefined,
      email: jiraEmail ?? undefined,
      apiToken: jiraApiToken ?? undefined
    });
  } catch {
    return mergeSettings(undefined, {
      baseUrl: jiraBaseUrl ?? undefined,
      email: jiraEmail ?? undefined,
      apiToken: jiraApiToken ?? undefined
    });
  }
}

export async function saveStoredSettings(settings: DashboardSettings) {
  if (hasChromeStorage()) {
    await chrome.storage.local.set({
      [SETTINGS_STORAGE_KEY]: settings,
      [JIRA_BASE_URL_STORAGE_KEY]: normalizeBaseUrl(settings.integrations.jira.baseUrl),
      [JIRA_EMAIL_STORAGE_KEY]: settings.integrations.jira.email.trim(),
      [JIRA_API_TOKEN_STORAGE_KEY]: settings.integrations.jira.apiToken.trim()
    });
    return;
  }

  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  localStorage.setItem(JIRA_BASE_URL_STORAGE_KEY, normalizeBaseUrl(settings.integrations.jira.baseUrl));
  localStorage.setItem(JIRA_EMAIL_STORAGE_KEY, settings.integrations.jira.email.trim());
  localStorage.setItem(JIRA_API_TOKEN_STORAGE_KEY, settings.integrations.jira.apiToken.trim());
}

export async function getStoredGitHubOwnerFilter() {
  if (hasChromeStorage()) {
    const result = await chrome.storage.local.get([GITHUB_OWNER_FILTER_STORAGE_KEY]);
    return mergeGitHubOwnerFilter(result[GITHUB_OWNER_FILTER_STORAGE_KEY] as string | undefined);
  }

  const raw = localStorage.getItem(GITHUB_OWNER_FILTER_STORAGE_KEY);
  if (!raw) {
    return DEFAULT_GITHUB_OWNER_FILTER;
  }

  try {
    return mergeGitHubOwnerFilter(JSON.parse(raw) as string);
  } catch {
    return DEFAULT_GITHUB_OWNER_FILTER;
  }
}

export async function saveStoredGitHubOwnerFilter(filter: GitHubListOrganizationFilter) {
  if (hasChromeStorage()) {
    await chrome.storage.local.set({ [GITHUB_OWNER_FILTER_STORAGE_KEY]: filter });
    return;
  }

  localStorage.setItem(GITHUB_OWNER_FILTER_STORAGE_KEY, JSON.stringify(filter));
}

export async function getStoredGitHubSortOrder() {
  if (hasChromeStorage()) {
    const result = await chrome.storage.local.get([GITHUB_SORT_ORDER_STORAGE_KEY]);
    return mergeGitHubSortOrder(result[GITHUB_SORT_ORDER_STORAGE_KEY] as string | undefined);
  }

  const raw = localStorage.getItem(GITHUB_SORT_ORDER_STORAGE_KEY);
  if (!raw) {
    return DEFAULT_GITHUB_SORT_ORDER;
  }

  try {
    return mergeGitHubSortOrder(JSON.parse(raw) as string);
  } catch {
    return DEFAULT_GITHUB_SORT_ORDER;
  }
}

export async function saveStoredGitHubSortOrder(sortOrder: GitHubListSort) {
  if (hasChromeStorage()) {
    await chrome.storage.local.set({ [GITHUB_SORT_ORDER_STORAGE_KEY]: sortOrder });
    return;
  }

  localStorage.setItem(GITHUB_SORT_ORDER_STORAGE_KEY, JSON.stringify(sortOrder));
}

export async function getStoredGitHubPrStatusFilter() {
  if (hasChromeStorage()) {
    const result = await chrome.storage.local.get([GITHUB_PR_STATUS_FILTER_STORAGE_KEY]);
    return mergeGitHubPrStatusFilter(result[GITHUB_PR_STATUS_FILTER_STORAGE_KEY] as string | undefined);
  }

  const raw = localStorage.getItem(GITHUB_PR_STATUS_FILTER_STORAGE_KEY);
  if (!raw) {
    return DEFAULT_GITHUB_PR_STATUS_FILTER;
  }

  try {
    return mergeGitHubPrStatusFilter(JSON.parse(raw) as string);
  } catch {
    return DEFAULT_GITHUB_PR_STATUS_FILTER;
  }
}

export async function saveStoredGitHubPrStatusFilter(filter: GitHubPrStatusFilter) {
  if (hasChromeStorage()) {
    await chrome.storage.local.set({ [GITHUB_PR_STATUS_FILTER_STORAGE_KEY]: filter });
    return;
  }

  localStorage.setItem(GITHUB_PR_STATUS_FILTER_STORAGE_KEY, JSON.stringify(filter));
}

export async function getStoredActiveIntegration() {
  if (hasChromeStorage()) {
    const result = await chrome.storage.local.get([ACTIVE_INTEGRATION_STORAGE_KEY]);
    return mergeActiveIntegration(result[ACTIVE_INTEGRATION_STORAGE_KEY] as string | undefined);
  }

  const raw = localStorage.getItem(ACTIVE_INTEGRATION_STORAGE_KEY);
  if (!raw) {
    return DEFAULT_ACTIVE_INTEGRATION;
  }

  try {
    return mergeActiveIntegration(JSON.parse(raw) as string);
  } catch {
    return DEFAULT_ACTIVE_INTEGRATION;
  }
}

export async function saveStoredActiveIntegration(activeIntegration: ActiveIntegration) {
  if (hasChromeStorage()) {
    await chrome.storage.local.set({ [ACTIVE_INTEGRATION_STORAGE_KEY]: activeIntegration });
    return;
  }

  localStorage.setItem(ACTIVE_INTEGRATION_STORAGE_KEY, JSON.stringify(activeIntegration));
}

export async function getStoredActiveGitHubView() {
  if (hasChromeStorage()) {
    const result = await chrome.storage.local.get([ACTIVE_GITHUB_VIEW_STORAGE_KEY]);
    return mergeActiveGitHubView(result[ACTIVE_GITHUB_VIEW_STORAGE_KEY] as string | undefined);
  }

  const raw = localStorage.getItem(ACTIVE_GITHUB_VIEW_STORAGE_KEY);
  if (!raw) {
    return DEFAULT_ACTIVE_GITHUB_VIEW;
  }

  try {
    return mergeActiveGitHubView(JSON.parse(raw) as string);
  } catch {
    return DEFAULT_ACTIVE_GITHUB_VIEW;
  }
}

export async function saveStoredActiveGitHubView(activeGitHubView: ActiveGitHubView) {
  if (hasChromeStorage()) {
    await chrome.storage.local.set({ [ACTIVE_GITHUB_VIEW_STORAGE_KEY]: activeGitHubView });
    return;
  }

  localStorage.setItem(ACTIVE_GITHUB_VIEW_STORAGE_KEY, JSON.stringify(activeGitHubView));
}

export async function getStoredActiveJiraView() {
  if (hasChromeStorage()) {
    const result = await chrome.storage.local.get([ACTIVE_JIRA_VIEW_STORAGE_KEY]);
    return mergeActiveJiraView(result[ACTIVE_JIRA_VIEW_STORAGE_KEY] as string | undefined);
  }

  const raw = localStorage.getItem(ACTIVE_JIRA_VIEW_STORAGE_KEY);
  if (!raw) {
    return DEFAULT_ACTIVE_JIRA_VIEW;
  }

  try {
    return mergeActiveJiraView(JSON.parse(raw) as string);
  } catch {
    return DEFAULT_ACTIVE_JIRA_VIEW;
  }
}

export async function saveStoredActiveJiraView(activeJiraView: ActiveJiraView) {
  if (hasChromeStorage()) {
    await chrome.storage.local.set({ [ACTIVE_JIRA_VIEW_STORAGE_KEY]: activeJiraView });
    return;
  }

  localStorage.setItem(ACTIVE_JIRA_VIEW_STORAGE_KEY, JSON.stringify(activeJiraView));
}

export function getDefaultSettings() {
  return structuredClone(DEFAULT_SETTINGS);
}

export function createNote(text: string): Note | null {
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }

  return {
    id: crypto.randomUUID(),
    text: trimmed,
    createdAt: Date.now()
  };
}

export function deleteNote(notes: Note[], noteId: string) {
  return notes.filter((note) => note.id !== noteId);
}

function mergeSettings(
  settings?: Partial<DashboardSettings>,
  jiraOverrides?: Partial<DashboardSettings['integrations']['jira']>
): DashboardSettings {
  const jiraBaseUrl =
    jiraOverrides?.baseUrl ?? settings?.integrations?.jira?.baseUrl ?? DEFAULT_SETTINGS.integrations.jira.baseUrl;
  const jiraEmail =
    jiraOverrides?.email ?? settings?.integrations?.jira?.email ?? DEFAULT_SETTINGS.integrations.jira.email;
  const jiraApiToken =
    jiraOverrides?.apiToken ??
    settings?.integrations?.jira?.apiToken ??
    DEFAULT_SETTINGS.integrations.jira.apiToken;

  return {
    name: settings?.name?.trim() ?? DEFAULT_SETTINGS.name,
    integrations: {
      github: {
        username: settings?.integrations?.github?.username ?? DEFAULT_SETTINGS.integrations.github.username,
        token: settings?.integrations?.github?.token ?? DEFAULT_SETTINGS.integrations.github.token
      },
      jira: {
        baseUrl: normalizeBaseUrl(jiraBaseUrl),
        email: jiraEmail.trim(),
        apiToken: jiraApiToken.trim()
      }
    }
  };
}

function normalizeBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, '');
}

function mergeGitHubOwnerFilter(filter?: string): GitHubListOrganizationFilter {
  return typeof filter === 'string' && filter.trim() ? filter : DEFAULT_GITHUB_OWNER_FILTER;
}

function mergeGitHubSortOrder(sortOrder?: string): GitHubListSort {
  if (
    sortOrder === 'oldest-updated' ||
    sortOrder === 'repository-asc' ||
    sortOrder === 'title-asc' ||
    sortOrder === 'recently-updated'
  ) {
    return sortOrder;
  }

  return DEFAULT_GITHUB_SORT_ORDER;
}

function mergeGitHubPrStatusFilter(filter?: string): GitHubPrStatusFilter {
  return filter === 'approved' || filter === 'waiting-review' || filter === 'all'
    ? filter
    : DEFAULT_GITHUB_PR_STATUS_FILTER;
}

function mergeActiveIntegration(activeIntegration?: string): ActiveIntegration {
  return activeIntegration === 'jira' || activeIntegration === 'github'
    ? activeIntegration
    : DEFAULT_ACTIVE_INTEGRATION;
}

function mergeActiveGitHubView(activeGitHubView?: string): ActiveGitHubView {
  return activeGitHubView === 'notifications' || activeGitHubView === 'review' || activeGitHubView === 'prs'
    ? activeGitHubView
    : DEFAULT_ACTIVE_GITHUB_VIEW;
}

function mergeActiveJiraView(activeJiraView?: string): ActiveJiraView {
  return activeJiraView === 'in-progress' ||
    activeJiraView === 'blocking' ||
    activeJiraView === 'high-priority' ||
    activeJiraView === 'active'
    ? activeJiraView
    : DEFAULT_ACTIVE_JIRA_VIEW;
}

function mergeFocusItems(items?: FocusItem[] | LegacyFocusItem[] | null) {
  if (!Array.isArray(items)) {
    return null;
  }

  return items
    .map((item) => normalizeFocusItem(item))
    .filter((item): item is FocusItem => item !== null);
}

function normalizeFocusItem(item: FocusItem | LegacyFocusItem | null | undefined): FocusItem | null {
  if (
    !item ||
    typeof item.id !== 'string' ||
    (item.source !== 'jira' && item.source !== 'github') ||
    typeof item.sourceLabel !== 'string' ||
    typeof item.reference !== 'string' ||
    typeof item.title !== 'string' ||
    typeof item.statusLabel !== 'string' ||
    (item.statusTone !== 'violet' && item.statusTone !== 'emerald' && item.statusTone !== 'amber')
  ) {
    return null;
  }

  const normalizedBase = {
    id: item.id,
    sourceLabel: item.sourceLabel.trim(),
    reference: item.reference.trim(),
    title: item.title.trim(),
    statusLabel: item.statusLabel.trim(),
    statusTone: item.statusTone
  };

  if (item.source === 'github') {
    return {
      ...normalizedBase,
      source: 'github',
      jiraKey: normalizeJiraKey('jiraKey' in item ? item.jiraKey : null)
    };
  }

  const rawChildren = 'children' in item && Array.isArray(item.children) ? item.children : [];
  const children = rawChildren
    .map((child) => normalizeFocusItem(child))
    .filter((child): child is FocusPullRequestItem => child?.source === 'github');
  const normalizedJiraKey =
    normalizeJiraKey('jiraKey' in item ? item.jiraKey : item.reference) ?? item.reference.trim();

  return {
    ...normalizedBase,
    source: 'jira',
    jiraKey: normalizedJiraKey,
    children,
    isPlaceholder: 'isPlaceholder' in item ? Boolean(item.isPlaceholder) : false
  };
}

function normalizeJiraKey(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim().toUpperCase() : null;
}
