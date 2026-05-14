import {
  getStoredJsonValue,
  setStoredJsonValue,
} from './backend';
import { NOTES_STORAGE_KEY } from './keys';
import type { Note } from './types';

export async function saveStoredNotes(notes: Note[]) {
  await setStoredJsonValue(NOTES_STORAGE_KEY, notes);
}

export async function getStoredNotes() {
  return (await getStoredJsonValue<Note[]>(NOTES_STORAGE_KEY)) ?? [];
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
