'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const MAX_LENGTH = 1000;

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export function ClientNote({
  initialNote,
  clientId,
}: {
  initialNote: string;
  clientId: string;
}) {
  const router = useRouter();
  const [note, setNote] = useState(initialNote);
  const [savedNote, setSavedNote] = useState(initialNote);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (savedTimer.current) clearTimeout(savedTimer.current);
    };
  }, []);

  const hasChanges = note !== savedNote;
  const canSave = hasChanges && saveState !== 'saving';

  const handleSave = useCallback(async () => {
    if (!canSave) return;

    // Client-side validation
    if (note.length > MAX_LENGTH) {
      setSaveState('error');
      return;
    }

    setSaveState('saving');
    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note }),
      });

      if (!res.ok) throw new Error();

      setSavedNote(note);
      setSaveState('saved');
      router.refresh();

      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSaveState('idle'), 3000);
    } catch {
      setSaveState('error');
    }
  }, [canSave, note, clientId, router]);

  const statusMessage =
    saveState === 'saving' ? 'Guardando…'
    : saveState === 'saved' ? 'Nota guardada'
    : saveState === 'error' ? 'No pudimos guardar la nota. Inténtalo de nuevo.'
    : '';

  return (
    <div className="stack">
      <div className="field">
        <label htmlFor="client-note">Nota</label>
        <textarea
          id="client-note"
          name="note"
          className="input"
          rows={4}
          value={note}
          placeholder="Escribe aquí notas internas sobre este cliente…"
          aria-describedby="client-note-help"
          aria-invalid={saveState === 'error'}
          disabled={saveState === 'saving'}
          onChange={(e) => {
            setNote(e.target.value);
            if (saveState === 'error') setSaveState('idle');
          }}
        />
        <p id="client-note-help" className="text-sm muted">
          Máximo 1.000 caracteres. No se muestra al cliente.
        </p>
      </div>
      <div className="cluster">
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleSave}
          disabled={!canSave}
        >
          {saveState === 'saving' ? 'Guardando…' : 'Guardar nota'}
        </button>
        {statusMessage && (
          <span
            aria-live="polite"
            className={saveState === 'error' ? 'error-text' : 'text-sm muted'}
          >
            {statusMessage}
          </span>
        )}
      </div>
    </div>
  );
}
