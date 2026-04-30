export type Note = {
  id: string;
  text: string;
  createdAt: number;
};

const NOTES_STORAGE_KEY = 'dashboard-notes';

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
