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
          className="flex-1 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-stone-100 outline-none transition placeholder:text-stone-500 focus:border-accent/50 focus:ring-1 focus:ring-accent/40"
          maxLength={160}
        />
        <button
          type="submit"
          className="rounded-2xl bg-accent px-4 py-3 text-sm font-medium text-stone-950 transition hover:brightness-105"
        >
          Add
        </button>
      </form>

      <div className="mt-6 flex flex-col gap-3">
        {isLoading ? (
          <p className="text-sm text-stone-500">Loading notes...</p>
        ) : notes.length === 0 ? (
          <div className="rounded-[22px] border border-dashed border-white/10 bg-black/10 p-5 text-sm text-stone-500">
            No notes yet. Add one to start building your scratchpad for the day.
          </div>
        ) : (
          notes.map((note) => (
            <article
              key={note.id}
              className="flex items-start justify-between gap-3 rounded-[22px] border border-white/5 bg-panelAlt/75 px-4 py-3"
            >
              <p className="text-sm leading-6 text-stone-200">{note.text}</p>
              <button
                type="button"
                onClick={() => void handleDeleteNote(note.id)}
                className="shrink-0 rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-stone-400 transition hover:border-white/20 hover:text-stone-200"
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
