'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';

interface BusinessHour {
  id: string;
  weekday: number;
  start_time: string;
  end_time: string;
}

interface Break {
  id: string;
  weekday: number;
  start_time: string;
  end_time: string;
}

interface Professional {
  id: string;
  name: string;
  active: boolean;
}

// Orden de visualización del modo avanzado (Domingo a Sábado, estándar JS Date)
const DAYS_FULL: { label: string; weekday: number }[] = [
  { label: 'Domingo', weekday: 0 },
  { label: 'Lunes', weekday: 1 },
  { label: 'Martes', weekday: 2 },
  { label: 'Miércoles', weekday: 3 },
  { label: 'Jueves', weekday: 4 },
  { label: 'Viernes', weekday: 5 },
  { label: 'Sábado', weekday: 6 },
];

// weekday: 0=Domingo, 1=Lunes, … 6=Sábado (estándar JS Date)
const WEEKDAYS: { label: string; value: number }[] = [
  { label: 'Lunes', value: 1 },
  { label: 'Martes', value: 2 },
  { label: 'Miércoles', value: 3 },
  { label: 'Jueves', value: 4 },
  { label: 'Viernes', value: 5 },
  { label: 'Sábado', value: 6 },
  { label: 'Domingo', value: 0 },
];

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

function buildSummary(
  selectedDays: number[],
  desde: string,
  hasta: string,
  hasBreak: boolean,
  breakStart: string,
  breakEnd: string,
): string {
  if (selectedDays.length === 0) {
    return 'Aún no marcaste días. Selecciona al menos uno para guardar.';
  }

  // Ordenar de Lunes a Domingo
  const ordered = [...selectedDays].sort((a, b) => {
    const ra = a === 0 ? 7 : a;
    const rb = b === 0 ? 7 : b;
    return ra - rb;
  });

  let diasTexto: string;
  // Detectar Lunes a Viernes
  if (
    ordered.length === 5 &&
    ordered.includes(1) && ordered.includes(2) && ordered.includes(3) &&
    ordered.includes(4) && ordered.includes(5)
  ) {
    diasTexto = 'Lunes a Viernes';
  } else if (ordered.length === 7) {
    diasTexto = 'todos los días';
  } else {
    const labels = ordered.map((d) => WEEKDAYS.find((w) => w.value === d)!.label);
    if (labels.length === 1) {
      diasTexto = labels[0];
    } else if (labels.length === 2) {
      diasTexto = `${labels[0]} y ${labels[1]}`;
    } else {
      diasTexto = `${labels.slice(0, -1).join(', ')} y ${labels[labels.length - 1]}`;
    }
  }

  let texto = `Atiendes ${diasTexto}, de ${desde} a ${hasta}`;
  if (hasBreak) {
    texto += `, con descanso de ${breakStart} a ${breakEnd}`;
  }
  texto += '.';
  return texto;
}

// ---- Modo avanzado: borrador editable por día (se guarda con un solo botón) ----
type Tramo = { start: string; end: string };
type DayDraft = { tramos: Tramo[]; descansos: Tramo[] };

/** Construye el borrador editable a partir de los datos cargados. */
function buildDraft(hours: BusinessHour[], breaks: Break[]): Record<number, DayDraft> {
  const d: Record<number, DayDraft> = {};
  for (let wd = 0; wd < 7; wd++) {
    d[wd] = {
      tramos: hours
        .filter((h) => h.weekday === wd)
        .sort((a, b) => a.start_time.localeCompare(b.start_time))
        .map((h) => ({ start: h.start_time.slice(0, 5), end: h.end_time.slice(0, 5) })),
      descansos: breaks
        .filter((b) => b.weekday === wd)
        .sort((a, b) => a.start_time.localeCompare(b.start_time))
        .map((b) => ({ start: b.start_time.slice(0, 5), end: b.end_time.slice(0, 5) })),
    };
  }
  return d;
}

/** Horas válidas para un descanso: solo las que caen dentro de algún tramo del día. */
function breakOptions(tramos: Tramo[]): string[] {
  const valid = tramos.filter((t) => t.start && t.end && t.start < t.end);
  if (valid.length === 0) return [];
  return TIME_OPTIONS.filter((t) => valid.some((tr) => t >= tr.start && t <= tr.end));
}

/** Valida la configuración de un día. Devuelve un mensaje de error o null si está OK. */
function validateDay(dayName: string, d: DayDraft): string | null {
  for (const t of d.tramos) {
    if (!t.start || !t.end) return `${dayName}: completa el inicio y el fin de cada tramo.`;
    if (t.start >= t.end) return `${dayName}: el fin del tramo debe ser posterior al inicio.`;
  }
  const sorted = [...d.tramos]
    .filter((t) => t.start && t.end)
    .sort((a, b) => a.start.localeCompare(b.start));
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].start < sorted[i - 1].end) return `${dayName}: los tramos no pueden solaparse.`;
  }
  for (const b of d.descansos) {
    if (!b.start || !b.end) return `${dayName}: completa el inicio y el fin de cada descanso.`;
    if (b.start >= b.end) return `${dayName}: el fin del descanso debe ser posterior al inicio.`;
    const inside = d.tramos.some((t) => t.start && t.end && b.start >= t.start && b.end <= t.end);
    if (!inside) return `${dayName}: el descanso debe estar dentro de un tramo de atención.`;
  }
  return null;
}

/** Burbuja de ayuda: muestra una explicación al pasar el mouse o al enfocar con teclado. */
function HelpTip({ text }: { text: string }) {
  return (
    <span className="help-tip" data-tip={text} tabIndex={0} role="note" aria-label={text}>
      ?
    </span>
  );
}

export function HoursEditor() {
  const [hours, setHours] = useState<BusinessHour[]>([]);
  const [breaks, setBreaks] = useState<Break[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [profLoading, setProfLoading] = useState(true);
  const [selectedProf, setSelectedProf] = useState<string>('');

  // Modo avanzado: borrador editable (se arma local y se guarda con un solo botón)
  const [draft, setDraft] = useState<Record<number, DayDraft>>({});
  const [advSaving, setAdvSaving] = useState(false);
  const [advError, setAdvError] = useState('');
  const [advSuccess, setAdvSuccess] = useState('');

  // Modo simple
  const [advancedMode, setAdvancedMode] = useState(false);
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [desde, setDesde] = useState('09:00');
  const [hasta, setHasta] = useState('18:00');
  const [hasBreak, setHasBreak] = useState(false);
  const [breakStart, setBreakStart] = useState('13:00');
  const [breakEnd, setBreakEnd] = useState('14:00');
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const formInitRef = useRef<string>(''); // tracks which prof the simple form was seeded for

  const loadProfessionals = useCallback(async () => {
    setProfLoading(true);
    try {
      const res = await fetch('/api/professionals');
      if (!res.ok) throw new Error();
      const data = await res.json();
      setProfessionals(data);
      if (data.length > 0 && !selectedProf) {
        setSelectedProf(data[0].id);
      }
    } catch {
      // handled by empty state
    } finally {
      setProfLoading(false);
    }
  }, [selectedProf]);

  useEffect(() => {
    loadProfessionals();
  }, [loadProfessionals]);

  const loadAll = useCallback(async () => {
    if (!selectedProf) return;
    setLoading(true);
    setError(false);
    try {
      const [hRes, bRes] = await Promise.all([
        fetch(`/api/business-hours?professionalId=${selectedProf}`),
        fetch(`/api/breaks?professionalId=${selectedProf}`),
      ]);
      if (!hRes.ok || !bRes.ok) throw new Error();
      const [hData, bData] = await Promise.all([hRes.json(), bRes.json()]);
      setHours(hData);
      setBreaks(bData);
      // Sembrar el borrador editable del modo avanzado
      setDraft(buildDraft(hData as BusinessHour[], bData as Break[]));

      // Precargar el formulario simple con los datos del profesional
      if (formInitRef.current !== selectedProf) {
        const hoursData = hData as BusinessHour[];
        const breaksData = bData as Break[];
        const activeDays: number[] = [...new Set(hoursData.map((h) => h.weekday))];
        if (activeDays.length > 0) {
          setSelectedDays(activeDays);
          const firstHour = hoursData[0];
          setDesde(firstHour.start_time.slice(0, 5));
          setHasta(firstHour.end_time.slice(0, 5));
          const firstBreak = breaksData.find((b) => activeDays.includes(b.weekday));
          if (firstBreak) {
            setHasBreak(true);
            setBreakStart(firstBreak.start_time.slice(0, 5));
            setBreakEnd(firstBreak.end_time.slice(0, 5));
          } else {
            setHasBreak(false);
          }
        } else {
          // Sin horario configurado: usar valores por defecto
          setSelectedDays([1, 2, 3, 4, 5]);
          setDesde('09:00');
          setHasta('18:00');
          setHasBreak(false);
        }
        // Marcar como inicializado solo tras procesar exitosamente,
        // para que un reintento (si el fetch falló) vuelva a precargar.
        formInitRef.current = selectedProf;
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [selectedProf]);

  useEffect(() => {
    if (selectedProf) loadAll();
    else { setHours([]); setBreaks([]); setLoading(false); }
  }, [selectedProf, loadAll]);

  // Limpiar mensaje de éxito al cambiar cualquier campo del formulario simple
  useEffect(() => {
    setSuccessMsg('');
  }, [selectedDays, desde, hasta, hasBreak, breakStart, breakEnd, selectedProf]);

  // ---- Modo avanzado: edición del borrador (no persiste hasta presionar Guardar) ----
  const updateDay = (wd: number, fn: (d: DayDraft) => DayDraft) => {
    setAdvSuccess('');
    setAdvError('');
    setDraft((prev) => ({ ...prev, [wd]: fn(prev[wd] || { tramos: [], descansos: [] }) }));
  };
  const addTramo = (wd: number) =>
    updateDay(wd, (d) => ({ ...d, tramos: [...d.tramos, { start: '', end: '' }] }));
  const updateTramo = (wd: number, i: number, field: 'start' | 'end', val: string) =>
    updateDay(wd, (d) => ({ ...d, tramos: d.tramos.map((t, j) => (j === i ? { ...t, [field]: val } : t)) }));
  const removeTramo = (wd: number, i: number) =>
    updateDay(wd, (d) => ({
      ...d,
      tramos: d.tramos.filter((_, j) => j !== i),
      // Si quitas un tramo, descarta descansos que queden fuera de horario
      descansos: d.descansos,
    }));
  const addDescanso = (wd: number) =>
    updateDay(wd, (d) => ({ ...d, descansos: [...d.descansos, { start: '', end: '' }] }));
  const updateDescanso = (wd: number, i: number, field: 'start' | 'end', val: string) =>
    updateDay(wd, (d) => ({ ...d, descansos: d.descansos.map((b, j) => (j === i ? { ...b, [field]: val } : b)) }));
  const removeDescanso = (wd: number, i: number) =>
    updateDay(wd, (d) => ({ ...d, descansos: d.descansos.filter((_, j) => j !== i) }));

  const saveAdvanced = async () => {
    setAdvError('');
    setAdvSuccess('');
    for (const { label, weekday } of DAYS_FULL) {
      const err = validateDay(label, draft[weekday] || { tramos: [], descansos: [] });
      if (err) { setAdvError(err); return; }
    }
    setAdvSaving(true);
    try {
      // Borrar todo lo existente del profesional y recrear desde el borrador
      await Promise.all([
        ...hours.map((h) => fetch(`/api/business-hours/${h.id}`, { method: 'DELETE' })),
        ...breaks.map((b) => fetch(`/api/breaks/${b.id}`, { method: 'DELETE' })),
      ]);
      for (const { weekday } of DAYS_FULL) {
        const d = draft[weekday] || { tramos: [], descansos: [] };
        for (const t of d.tramos) {
          const r = await fetch('/api/business-hours', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ weekday, start_time: t.start, end_time: t.end, professional_id: selectedProf }),
          });
          if (!r.ok) throw new Error();
        }
        for (const b of d.descansos) {
          const r = await fetch('/api/breaks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ weekday, start_time: b.start, end_time: b.end, professional_id: selectedProf }),
          });
          if (!r.ok) throw new Error();
        }
      }
      await loadAll();
      setAdvSuccess('Horario guardado correctamente.');
    } catch {
      setAdvError('No pudimos guardar el horario. Revisa los datos e inténtalo de nuevo.');
    } finally {
      setAdvSaving(false);
    }
  };

  // ---- Guardado del modo simple ----
  const timeError = desde && hasta && hasta <= desde
    ? 'La hora de cierre debe ser posterior a la de apertura.'
    : '';

  const breakError = useMemo(() => {
    if (!hasBreak) return '';
    if (breakEnd <= breakStart) return 'La hora de fin del descanso debe ser posterior a la de inicio.';
    if (breakStart < desde || breakEnd > hasta) return 'El descanso debe estar dentro del horario de atención.';
    return '';
  }, [hasBreak, breakStart, breakEnd, desde, hasta]);

  const canSave = selectedDays.length > 0 && !timeError && !breakError && !saving;

  const saveSimple = async () => {
    if (!canSave) return;
    setSaving(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      // Eliminar bloques de días que ya no están seleccionados (evita huérfanos)
      const removedDays = [0, 1, 2, 3, 4, 5, 6].filter((d) => !selectedDays.includes(d));
      const orphanedHours = hours.filter((h) => removedDays.includes(h.weekday));
      const orphanedBreaks = breaks.filter((b) => removedDays.includes(b.weekday));
      await Promise.all([
        ...orphanedHours.map((h) => fetch(`/api/business-hours/${h.id}`, { method: 'DELETE' })),
        ...orphanedBreaks.map((b) => fetch(`/api/breaks/${b.id}`, { method: 'DELETE' })),
      ]);

      for (const weekday of selectedDays) {
        // Borrar bloques existentes del día
        const dayHours = hours.filter((h) => h.weekday === weekday);
        const dayBreaks = breaks.filter((b) => b.weekday === weekday);
        await Promise.all([
          ...dayHours.map((h) => fetch(`/api/business-hours/${h.id}`, { method: 'DELETE' })),
          ...dayBreaks.map((b) => fetch(`/api/breaks/${b.id}`, { method: 'DELETE' })),
        ]);

        // Crear nuevo bloque de atención
        const bhRes = await fetch('/api/business-hours', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ weekday, start_time: desde, end_time: hasta, professional_id: selectedProf }),
        });
        if (!bhRes.ok) throw new Error('No pudimos guardar el horario.');

        // Crear descanso si corresponde
        if (hasBreak) {
          const brRes = await fetch('/api/breaks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ weekday, start_time: breakStart, end_time: breakEnd, professional_id: selectedProf }),
          });
          if (!brRes.ok) throw new Error('No pudimos guardar el descanso.');
        }
      }
      await loadAll();
      setSuccessMsg('Horario guardado correctamente.');
    } catch {
      setErrorMsg('No pudimos guardar el horario. Revisa los datos e inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  const toggleDay = (day: number) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  };

  const summary = buildSummary(selectedDays, desde, hasta, hasBreak, breakStart, breakEnd);

  // ---- Render: estados de carga / vacío / error ----
  if (profLoading) return <p className="muted">Cargando profesionales…</p>;

  if (!profLoading && professionals.length === 0) {
    return (
      <div className="alert alert-info">
        Primero crea un profesional para configurar su horario.{' '}
        <a href="/dashboard/profesionales" className="link">Ir a profesionales</a>
      </div>
    );
  }

  if (loading) return <p className="muted">Cargando horario…</p>;
  if (error) {
    return (
      <div className="alert alert-error" role="alert">
        No pudimos cargar el horario.{' '}
        <button className="btn btn-sm btn-ghost" onClick={loadAll}>Reintentar</button>
      </div>
    );
  }

  const selectedProfessional = professionals.find((p) => p.id === selectedProf);

  return (
    <div className="stack">
      {/* Selector de profesional + toggle de modo */}
      <div className="card stack">
        <div className="cluster justify-between">
          {professionals.length > 1 ? (
            <div className="field" style={{ marginBottom: 0, flex: 1, minWidth: 200 }}>
              <label htmlFor="prof">Profesional</label>
              <select
                id="prof"
                value={selectedProf}
                onChange={(e) => setSelectedProf(e.target.value)}
                style={{ maxWidth: 320 }}
              >
                {professionals.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}{!p.active ? ' (Inactivo)' : ''}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div />
          )}
          <label className="cluster gap-2" style={{ marginBottom: 0 }}>
            <span className="text-sm">Modo avanzado</span>
            <HelpTip text="Úsalo solo si necesitas horarios distintos para cada día, o atender en dos tramos (por ejemplo mañana y tarde). Si tu horario es parejo toda la semana, deja esta opción apagada." />
            <input
              type="checkbox"
              checked={advancedMode}
              onChange={(e) => setAdvancedMode(e.target.checked)}
              aria-label="Usar modo avanzado por día"
            />
          </label>
        </div>
        {selectedProfessional && !selectedProfessional.active && (
          <span className="badge badge-warn" style={{ alignSelf: 'flex-start' }}>Inactivo</span>
        )}
      </div>

      {/* ====== MODO SIMPLE ====== */}
      {!advancedMode && (
        <div className="card stack">
          {/* Días */}
          <div className="field">
            <label>Días que atiendes</label>
            <p className="text-sm muted">Marca los días en que recibes reservas.</p>
            <div className="cluster gap-2">
              {WEEKDAYS.map((day) => (
                <label key={day.value} className="cluster gap-2">
                  <input
                    type="checkbox"
                    id={`day-${day.value}`}
                    checked={selectedDays.includes(day.value)}
                    onChange={() => toggleDay(day.value)}
                  />
                  {day.label}
                </label>
              ))}
            </div>
          </div>

          {/* Desde / Hasta */}
          <div className="grid grid-sm-2">
            <div className="field">
              <label htmlFor="desde">Desde</label>
              <select
                id="desde"
                value={desde}
                onChange={(e) => { setDesde(e.target.value); setErrorMsg(''); }}
                aria-invalid={!!timeError}
                aria-describedby={timeError ? 'desde-error' : undefined}
              >
                {TIME_OPTIONS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              {timeError && <span id="desde-error" className="error-text">{timeError}</span>}
            </div>
            <div className="field">
              <label htmlFor="hasta">Hasta</label>
              <select
                id="hasta"
                value={hasta}
                onChange={(e) => { setHasta(e.target.value); setErrorMsg(''); }}
                aria-invalid={!!timeError}
                aria-describedby={timeError ? 'hasta-error' : undefined}
              >
                {TIME_OPTIONS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              {timeError && <span id="hasta-error" className="error-text">{timeError}</span>}
            </div>
          </div>

          {/* Descanso / colación */}
          <div className="field">
            <label className="cluster gap-2">
              <input
                type="checkbox"
                checked={hasBreak}
                onChange={(e) => setHasBreak(e.target.checked)}
              />
              ¿Tomas un descanso (colación)?
            </label>

            {hasBreak && (
              <>
                {selectedDays.length === 0 ? (
                  <p className="text-sm muted">Marca al menos un día para configurar el descanso.</p>
                ) : (
                  <div className="grid grid-sm-2">
                    <div className="field">
                      <label htmlFor="break-start">Descanso desde</label>
                      <select
                        id="break-start"
                        value={breakStart}
                        onChange={(e) => { setBreakStart(e.target.value); setErrorMsg(''); }}
                        aria-invalid={!!breakError}
                        aria-describedby={breakError ? 'break-error' : undefined}
                      >
                        {TIME_OPTIONS.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor="break-end">Descanso hasta</label>
                      <select
                        id="break-end"
                        value={breakEnd}
                        onChange={(e) => { setBreakEnd(e.target.value); setErrorMsg(''); }}
                        aria-invalid={!!breakError}
                        aria-describedby={breakError ? 'break-error' : undefined}
                      >
                        {TIME_OPTIONS.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                    {breakError && (
                      <span id="break-error" className="error-text" style={{ gridColumn: '1 / -1' }}>{breakError}</span>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Errores y éxito */}
          {errorMsg && (
            <div className="alert alert-error" role="alert">{errorMsg}</div>
          )}
          {successMsg && (
            <div className="alert alert-success" role="status">{successMsg}</div>
          )}

          {/* Botón guardar */}
          <button
            className="btn btn-primary btn-block"
            onClick={saveSimple}
            disabled={!canSave}
            aria-busy={saving}
          >
            {saving ? 'Guardando…' : 'Guardar horario'}
          </button>

          {/* Resumen */}
          <div className="panel">
            <h3 style={{ fontSize: 'var(--fs-base)', fontWeight: 600 }}>Resumen de tu horario</h3>
            <p className="text-sm">{summary}</p>
          </div>
        </div>
      )}

      {/* ====== MODO AVANZADO ====== */}
      {advancedMode && (
        <>
          <div className="card stack" style={{ background: 'color-mix(in srgb, var(--info) 7%, var(--surface))', borderColor: 'var(--info)' }}>
            <h2 style={{ fontSize: 'var(--fs-lg)', margin: 0 }}>Cómo configurar tu horario por día</h2>
            <p className="text-sm muted" style={{ margin: 0 }}>
              Usa esto cuando atiendes en horarios distintos según el día, o en dos tramos el mismo día.
            </p>
            <ol className="steps">
              <li>Ubica el día que quieres configurar (hay una tarjeta por cada día más abajo).</li>
              <li>
                En ese día, elige <strong>Desde</strong> y <strong>Hasta</strong> para armar un tramo de atención.
                <HelpTip text="Un tramo es un período seguido en que atiendes. Ejemplo: de 09:00 a 13:00." />
              </li>
              <li>¿Atiendes mañana y tarde? Presiona <strong>«+ Otro tramo»</strong> y agrega el segundo (por ejemplo 09:00–13:00 y 15:00–19:00).</li>
              <li>
                Si haces una pausa corta dentro de un tramo, agrégala como <strong>descanso</strong>; solo podrás elegir horas dentro de tu atención.
                <HelpTip text="El descanso es una pausa dentro de un tramo (por ejemplo, la colación). No cierres el tramo: déjalo completo y marca el descanso." />
              </li>
              <li>Un día sin tramos queda <strong>cerrado</strong> (no se podrá reservar).</li>
              <li>Cuando termines con todos los días, presiona <strong>«Guardar horario»</strong> abajo. Nada se guarda hasta entonces.</li>
            </ol>
            <p className="text-sm" style={{ margin: 0, color: 'var(--warn)' }}>
              ⚠️ Lo que guardes aquí reemplaza lo que hayas puesto en el modo simple.
            </p>
          </div>

          {DAYS_FULL.map(({ label: dayName, weekday }) => {
            const day = draft[weekday] || { tramos: [], descansos: [] };
            const brkOpts = breakOptions(day.tramos);
            const canAddBreak = brkOpts.length > 0;

            return (
              <div key={weekday} className="card stack">
                <div className="cluster gap-2" style={{ alignItems: 'baseline' }}>
                  <h2 style={{ fontSize: 'var(--fs-xl)', margin: 0 }}>{dayName}</h2>
                  {day.tramos.length === 0 && <span className="badge">Cerrado</span>}
                </div>

                {/* Horario de atención (uno o más tramos) */}
                <div className="stack gap-2">
                  <p className="text-sm" style={{ fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center' }}>
                    Horario de atención
                    <HelpTip text="Elige desde y hasta qué hora atiendes. Agrega otro tramo si trabajas en dos turnos (mañana y tarde)." />
                  </p>
                  {day.tramos.length === 0 && (
                    <p className="text-sm muted" style={{ margin: 0 }}>
                      Sin tramos: este día está cerrado. Agrega uno para abrirlo a reservas.
                    </p>
                  )}
                  {day.tramos.map((t, i) => (
                    <div key={i} className="cluster gap-2" style={{ alignItems: 'flex-end', flexWrap: 'wrap' }}>
                      <div className="field" style={{ marginBottom: 0 }}>
                        <label htmlFor={`tramo-start-${weekday}-${i}`}>Desde</label>
                        <select id={`tramo-start-${weekday}-${i}`} value={t.start}
                          onChange={(e) => updateTramo(weekday, i, 'start', e.target.value)} style={{ maxWidth: 110 }}>
                          <option value="">—</option>
                          {TIME_OPTIONS.map((o) => (<option key={o} value={o}>{o}</option>))}
                        </select>
                      </div>
                      <div className="field" style={{ marginBottom: 0 }}>
                        <label htmlFor={`tramo-end-${weekday}-${i}`}>Hasta</label>
                        <select id={`tramo-end-${weekday}-${i}`} value={t.end}
                          onChange={(e) => updateTramo(weekday, i, 'end', e.target.value)} style={{ maxWidth: 110 }}>
                          <option value="">—</option>
                          {TIME_OPTIONS.map((o) => (<option key={o} value={o}>{o}</option>))}
                        </select>
                      </div>
                      <button className="btn btn-sm btn-ghost" onClick={() => removeTramo(weekday, i)}
                        aria-label={`Quitar tramo de ${dayName}`}>
                        Quitar
                      </button>
                    </div>
                  ))}
                  <div>
                    <button className="btn btn-sm btn-ghost" onClick={() => addTramo(weekday)}>
                      {day.tramos.length === 0 ? '+ Agregar tramo' : '+ Otro tramo'}
                    </button>
                  </div>
                </div>

                {/* Descansos (solo horas dentro de los tramos del día) */}
                <div className="stack gap-2">
                  <p className="text-sm" style={{ fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center' }}>
                    Descansos (opcional)
                    <HelpTip text="Pausas dentro de tu atención, como la colación. Solo puedes elegir horas dentro de tus tramos." />
                  </p>
                  {!canAddBreak && (
                    <p className="text-sm muted" style={{ margin: 0 }}>
                      Primero agrega un tramo de atención para poder marcar un descanso.
                    </p>
                  )}
                  {day.descansos.map((b, i) => (
                    <div key={i} className="cluster gap-2" style={{ alignItems: 'flex-end', flexWrap: 'wrap' }}>
                      <div className="field" style={{ marginBottom: 0 }}>
                        <label htmlFor={`desc-start-${weekday}-${i}`}>Desde</label>
                        <select id={`desc-start-${weekday}-${i}`} value={b.start}
                          onChange={(e) => updateDescanso(weekday, i, 'start', e.target.value)} style={{ maxWidth: 110 }}>
                          <option value="">—</option>
                          {brkOpts.map((o) => (<option key={o} value={o}>{o}</option>))}
                        </select>
                      </div>
                      <div className="field" style={{ marginBottom: 0 }}>
                        <label htmlFor={`desc-end-${weekday}-${i}`}>Hasta</label>
                        <select id={`desc-end-${weekday}-${i}`} value={b.end}
                          onChange={(e) => updateDescanso(weekday, i, 'end', e.target.value)} style={{ maxWidth: 110 }}>
                          <option value="">—</option>
                          {brkOpts.map((o) => (<option key={o} value={o}>{o}</option>))}
                        </select>
                      </div>
                      <button className="btn btn-sm btn-ghost" onClick={() => removeDescanso(weekday, i)}
                        aria-label={`Quitar descanso de ${dayName}`}>
                        Quitar
                      </button>
                    </div>
                  ))}
                  {canAddBreak && (
                    <div>
                      <button className="btn btn-sm btn-ghost" onClick={() => addDescanso(weekday)}>
                        + Agregar descanso
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Errores, éxito y botón ÚNICO de guardado */}
          {advError && <div className="alert alert-error" role="alert">{advError}</div>}
          {advSuccess && <div className="alert alert-success" role="status">{advSuccess}</div>}
          <button
            className="btn btn-primary btn-block"
            onClick={saveAdvanced}
            disabled={advSaving}
            aria-busy={advSaving}
          >
            {advSaving ? 'Guardando…' : 'Guardar horario'}
          </button>
        </>
      )}
    </div>
  );
}
