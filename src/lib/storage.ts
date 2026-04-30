export type Note = {
  id: string;
  text: string;
  createdAt: number;
};

const NOTES_STORAGE_KEY = 'dashboard-notes';
const SETTINGS_STORAGE_KEY = 'dashboard-settings';

export type DashboardSettings = {
  name: string;
  integrations: {
    github: {
      username: string;
      token: string;
    };
  };
};

const DEFAULT_SETTINGS: DashboardSettings = {
  name: 'Christian',
  integrations: {
    github: {
      username: '',
      token: ''
    }
  }
};

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

export async function getStoredSettings() {
  if (hasChromeStorage()) {
    const result = await chrome.storage.local.get(SETTINGS_STORAGE_KEY);
    return mergeSettings(result[SETTINGS_STORAGE_KEY] as Partial<DashboardSettings> | undefined);
  }

  const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
  if (!raw) {
    return DEFAULT_SETTINGS;
  }

  try {
    return mergeSettings(JSON.parse(raw) as Partial<DashboardSettings>);
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveStoredSettings(settings: DashboardSettings) {
  if (hasChromeStorage()) {
    await chrome.storage.local.set({ [SETTINGS_STORAGE_KEY]: settings });
    return;
  }

  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
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

function mergeSettings(settings?: Partial<DashboardSettings>): DashboardSettings {
  return {
    name: settings?.name?.trim() ? settings.name : DEFAULT_SETTINGS.name,
    integrations: {
      github: {
        username: settings?.integrations?.github?.username ?? DEFAULT_SETTINGS.integrations.github.username,
        token: settings?.integrations?.github?.token ?? DEFAULT_SETTINGS.integrations.github.token
      }
    }
  };
}
