'use client';

import { useState, useEffect, useCallback } from 'react';

interface Professional {
  id: string;
  name: string;
  active: boolean;
}

interface ScheduleBlock {
  id: string;
  professional_id: string | null;
  block_date: string;
  start_time: string | null;
  end_time: string | null;
  reason: string | null;
  created_at: string;
  professionals?: { name: string } | null;
}

/** Genera opciones 07:00–20:00 en pasos de 30 min (formato 24h). */
const TIME_OPTIONS: string[] = (() => {
  const opts: string[] = [];
  for (let h = 7; h <= 20; h++) {
    for (const m of [0, 30]) {
      if (h === 20 && m === 30) break;
      opts.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  return opts;
})();

const WEEKDAYS_ES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const wd = WEEKDAYS_ES[d.getDay()];
  return `${wd} ${d.getDate()} ${MONTHS_ES[d.getMonth()]}`;
}

export function ScheduleBlocks() {
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [blocks, setBlocks] = useState<ScheduleBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Form state
  const [blockDate, setBlockDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [allDay, setAllDay] = useState(true);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [professionalId, setProfessionalId] = useState<string>('');
  const [reason, setReason] = useState('');

  // Conflicts
  const [conflictCount, setConflictCount] = useState<number | null>(null);
  const [checkingConflicts, setCheckingConflicts] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [profRes, blocksRes] = await Promise.all([
        fetch('/api/professionals'),
        fetch('/api/schedule-blocks'),
      ]);
      if (!profRes.ok || !blocksRes.ok) throw new Error('load failed');
      const profData = await profRes.json();
      const blocksData = await blocksRes.json();
      setProfessionals(Array.isArray(profData) ? profData : []);
      setBlocks(Array.isArray(blocksData) ? blocksData : []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Check conflicts whenever relevant form fields change
  useEffect(() => {
    if (!blockDate) {
      setConflictCount(null);
      return;
    }
    setCheckingConflicts(true);
    const params = new URLSearchParams({
      block_date: blockDate,
      ...(endDate ? { end_date: endDate } : {}),
      ...(!allDay && startTime && endTime ? { start_time: startTime, end_time: endTime } : {}),
      ...(professionalId ? { professional_id: professionalId } : {}),
    });
    fetch(`/api/schedule-blocks/conflicts?${params}`)
      .then((r) => r.ok ? r.json() : { count: 0 })
      .then((d) => setConflictCount(d.count ?? 0))
      .catch(() => setConflictCount(0))
      .finally(() => setCheckingConflicts(false));
  }, [blockDate, endDate, allDay, startTime, endTime, professionalId]);

  const handleSave = async () => {
    setSaving(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const body: Record<string, unknown> = {
        block_date: blockDate,
        ...(endDate ? { end_date: endDate } : {}),
        ...(allDay ? { start_time: null, end_time: null } : { start_time: startTime, end_time: endTime }),
        ...(professionalId ? { professional_id: professionalId } : { professional_id: null }),
        ...(reason.trim() ? { reason: reason.trim() } : {}),
      };
      const res = await fetch('/api/schedule-blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'No se pudo crear el bloqueo');
      }
      setBlockDate('');
      setEndDate('');
      setReason('');
      setAllDay(true);
      setConflictCount(null);
      setSuccessMsg('Bloqueo creado correctamente.');
      await loadAll();
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'No se pudo crear el bloqueo.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/schedule-blocks/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('delete failed');
      setBlocks((prev) => prev.filter((b) => b.id !== id));
    } catch {
      setErrorMsg('No se pudo eliminar el bloqueo.');
    }
  };

  const canSave = blockDate && (allDay || (startTime && endTime && startTime < endTime));

  if (loading) return <p className="muted">Cargando bloqueos…</p>;
  if (error) {
    return (
      <div className="alert alert-error" role="alert">
        No pudimos cargar los bloqueos.{' '}
        <button className="btn btn-sm btn-ghost" onClick={loadAll}>Reintentar</button>
      </div>
    );
  }

  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });

  return (
    <div className="stack">
      <div>
        <h2>Bloqueos de agenda</h2>
        <p className="subtitle">
          Bloquea días o rangos de horas en los que no aceptas reservas. Útil para feriados, vacaciones o trámites personales.
        </p>
      </div>

      {/* Formulario */}
      <div className="card stack">
        <div className="grid grid-sm-2">
          <div className="field">
            <label htmlFor="block-date">Fecha desde</label>
            <input
              id="block-date"
              type="date"
              value={blockDate}
              min={todayStr}
              onChange={(e) => setBlockDate(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="end-date">Fecha hasta (opcional)</label>
            <input
              id="end-date"
              type="date"
              value={endDate}
              min={blockDate || todayStr}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor="professional">Profesional (opcional)</label>
          <p className="text-sm muted">Déjalo en blanco para bloquear todo el negocio.</p>
          <select
            id="professional"
            value={professionalId}
            onChange={(e) => setProfessionalId(e.target.value)}
          >
            <option value="">Todo el negocio</option>
            {professionals.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="cluster gap-2" style={{ marginBottom: 0 }}>
            <input
              type="checkbox"
              checked={allDay}
              onChange={(e) => setAllDay(e.target.checked)}
            />
            <span>Día completo</span>
          </label>
        </div>

        {!allDay && (
          <div className="grid grid-sm-2">
            <div className="field">
              <label htmlFor="start-time">Desde</label>
              <select
                id="start-time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              >
                {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="end-time">Hasta</label>
              <select
                id="end-time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              >
                {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
        )}

        <div className="field">
          <label htmlFor="reason">Motivo (opcional)</label>
          <input
            id="reason"
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ej: Feriado, vacaciones, trámite"
            maxLength={100}
          />
        </div>

        {/* Aviso de conflictos */}
        {blockDate && !checkingConflicts && conflictCount !== null && conflictCount > 0 && (
          <div className="alert alert-warn" role="alert">
            ⚠️ Hay {conflictCount} {conflictCount === 1 ? 'cita reservada' : 'citas reservadas'} en el rango que vas a bloquear. No se cancelarán automáticamente — comunícate con el/los cliente/s.
          </div>
        )}

        {errorMsg && <div className="alert alert-error" role="alert">{errorMsg}</div>}
        {successMsg && <div className="alert alert-success" role="status">{successMsg}</div>}

        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={!canSave || saving}
        >
          {saving ? 'Guardando…' : 'Bloquear'}
        </button>
      </div>

      {/* Lista de bloqueos vigentes */}
      <div className="card stack">
        <h3 style={{ marginBottom: 0 }}>Bloqueos vigentes</h3>
        {blocks.length === 0 ? (
          <p className="muted">No tienes bloqueos activos.</p>
        ) : (
          <ul className="stack gap-2" style={{ listStyle: 'none', padding: 0 }}>
            {blocks.map((b) => (
              <li
                key={b.id}
                className="cluster justify-between"
                style={{
                  background: 'var(--surface-2)',
                  padding: '0.6rem 0.85rem',
                  borderRadius: 'var(--radius-sm)',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                }}
              >
                <div className="stack gap-0">
                  <span style={{ fontWeight: 600 }}>
                    {formatDate(b.block_date)}
                  </span>
                  <span className="text-sm muted">
                    {b.start_time && b.end_time
                      ? `${b.start_time.slice(0, 5)} – ${b.end_time.slice(0, 5)}`
                      : 'Día completo'}
                    {b.professionals?.name ? ` · ${b.professionals.name}` : ' · Todo el negocio'}
                    {b.reason ? ` · ${b.reason}` : ''}
                  </span>
                </div>
                <button
                  className="btn btn-sm btn-ghost"
                  onClick={() => handleDelete(b.id)}
                >
                  Quitar
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
