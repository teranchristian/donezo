import {
  getChromeStorageValue,
  getLocalStorageJsonValue,
  hasChromeStorage,
  setChromeStorageValues,
  setLocalStorageJsonValue
} from './backend';
import { NOTES_STORAGE_KEY } from './keys';
import type { Note } from './types';

export async function saveStoredNotes(notes: Note[]) {
  if (hasChromeStorage()) {
    await setChromeStorageValues({ [NOTES_STORAGE_KEY]: notes });
    return;
  }

  setLocalStorageJsonValue(NOTES_STORAGE_KEY, notes);
}

export async function getStoredNotes() {
  if (hasChromeStorage()) {
    return (await getChromeStorageValue<Note[]>(NOTES_STORAGE_KEY)) ?? [];
  }

  return getLocalStorageJsonValue<Note[]>(NOTES_STORAGE_KEY) ?? [];
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
