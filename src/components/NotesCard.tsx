import { FormEvent, KeyboardEvent, useEffect, useState } from 'react';
import { createNote, deleteNote, getStoredNotes, saveStoredNotes, type Note } from '../lib/storage';
import { CardShell } from './CardShell';
import { SectionHeading } from './SectionHeading';

export function NotesCard() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [draft, setDraft] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    getStoredNotes().then((storedNotes) => {
      if (!active) {
        return;
      }

      setNotes(storedNotes);
      setIsLoading(false);
    });

    return () => {
      active = false;
    };
  }, []);

  async function handleAddNote(event: FormEvent) {
    event.preventDefault();

    const nextNote = createNote(draft);
    if (!nextNote) {
      return;
    }

    const nextNotes = [nextNote, ...notes];
    setNotes(nextNotes);
    setDraft('');
    await saveStoredNotes(nextNotes);
  }

  async function handleDeleteNote(noteId: string) {
    const nextNotes = deleteNote(notes, noteId);
    setNotes(nextNotes);
    await saveStoredNotes(nextNotes);
  }

  function onComposerKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setDraft('');
    }
  }

  return (
    <CardShell className="min-h-[420px]">
      <SectionHeading
        eyebrow="Notes"
        title="Quick capture"
        description="Drop short notes here without switching apps. They stay in local extension storage."
      />

      <form className="flex gap-3" onSubmit={handleAddNote}>
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onComposerKeyDown}
          placeholder="Add a short note..."
          className="flex-1 rounded-[14px] bg-[var(--card-bg-soft)] px-4 py-3 text-sm text-primary outline-none transition placeholder:text-[var(--text-tertiary)] focus:bg-[var(--card-bg-strong)] focus:ring-1 focus:ring-white/10"
          maxLength={160}
        />
        <button
          type="submit"
          className="rounded-[14px] bg-accent px-4 py-3 text-sm font-medium text-stone-950 transition hover:-translate-y-0.5 hover:brightness-105"
        >
          Add
        </button>
      </form>

      <div className="mt-6 flex flex-col gap-3">
        {isLoading ? (
          <p className="text-sm text-secondary">Loading notes...</p>
        ) : notes.length === 0 ? (
          <div className="rounded-[14px] bg-[var(--card-bg-soft)] p-5 text-sm text-secondary">
            No notes yet. Add one to start building your scratchpad for the day.
          </div>
        ) : (
          notes.map((note) => (
            <article
              key={note.id}
              className="flex items-start justify-between gap-3 rounded-[14px] bg-[var(--card-bg-soft)] px-4 py-3"
            >
              <p className="text-sm leading-6 text-primary">{note.text}</p>
              <button
                type="button"
                onClick={() => void handleDeleteNote(note.id)}
                className="shrink-0 rounded-full bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.2em] text-secondary transition hover:bg-white/10 hover:text-primary"
                aria-label={`Delete note: ${note.text}`}
              >
                Delete
              </button>
            </article>
          ))
        )}
      </div>
    </CardShell>
  );
}
