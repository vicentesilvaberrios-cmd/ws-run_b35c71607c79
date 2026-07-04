'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { formatTime } from '@/lib/format';

interface WeekAppt {
  id: string;
  starts_at: string;
  ends_at: string;
  customer_name: string;
  status: string;
  confirmed_at: string | null;
  service: { id: string; name: string; duration_min: number } | null;
  professional_name: string | null;
}

interface WeekBlock {
  id: string;
  start_time: string | null;
  end_time: string | null;
  reason: string | null;
  block_date?: string | null;
}

interface BusinessHoursRow {
  weekday: number;
  start_time: string;
  end_time: string;
}

const DAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const DAY_LABELS_LONG = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

/** Returns Monday of the week containing `dateStr` (YYYY-MM-DD), computed in America/Santiago. */
function startOfWeek(dateStr: string): Date {
  // Build a date at noon Santiago time to avoid TZ edge effects
  const d = new Date(dateStr + 'T12:00:00-03:00');
  // Get the weekday in Santiago
  const santiagoWeekday = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago',
    weekday: 'short',
  }).format(d);
  const weekdayMap: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  const day = weekdayMap[santiagoWeekday] ?? 0;
  const diff = day === 6 ? -6 : -day; // offset to Monday
  d.setDate(d.getDate() + diff);
  return d;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function toISODate(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });
}

function formatRangeShort(monday: Date): string {
  const sun = addDays(monday, 6);
  const m = monday.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  const s = sun.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${m} – ${s}`;
}

function parseTimeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function toSantiagoDate(iso: string): Date {
  // Convert ISO string to a Date representing local Santiago wall-clock time.
  // We use the parts of the string in America/Santiago via Intl.
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(iso));
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  return new Date(`${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}:${map.second}`);
}

function getDayKey(iso: string): string {
  // YYYY-MM-DD in Santiago
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(iso));
}

function statusClass(status: string, confirmed: string | null): string {
  if (status === 'cancelled') return 'week-appt-st-cancelled';
  if (status === 'attended') return 'week-appt-st-attended';
  if (status === 'no_show') return 'week-appt-st-no_show';
  if (confirmed) return 'week-appt-st-confirmed';
  return 'week-appt-st-booked';
}

function statusLabel(status: string, confirmed: string | null): string {
  if (status === 'cancelled') return 'Cancelada';
  if (status === 'attended') return 'Asistió';
  if (status === 'no_show') return 'No asistió';
  if (confirmed) return 'Confirmada';
  return 'Reservada';
}

const FALLBACK_OPEN = '07:00';
const FALLBACK_CLOSE = '20:00';

export function WeekCalendar({ initialDate }: { initialDate: string }) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(initialDate));
  const [appointments, setAppointments] = useState<WeekAppt[]>([]);
  const [blocks, setBlocks] = useState<WeekBlock[]>([]);
  const [businessHours, setBusinessHours] = useState<BusinessHoursRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const openTime = businessHours
    ? businessHours.reduce((min, r) => r.start_time < min ? r.start_time : min, businessHours[0]?.start_time || FALLBACK_OPEN)
    : FALLBACK_OPEN;
  const closeTime = businessHours
    ? businessHours.reduce((max, r) => r.end_time > max ? r.end_time : max, businessHours[0]?.end_time || FALLBACK_CLOSE)
    : FALLBACK_CLOSE;
  const openMin = parseTimeToMinutes(openTime);
  const closeMin = parseTimeToMinutes(closeTime);
  const totalMin = closeMin - openMin;

  const hours = useMemo(() => {
    const arr: number[] = [];
    for (let m = openMin; m < closeMin; m += 60) arr.push(m);
    return arr;
  }, [openMin, closeMin]);

  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(weekStart, i);
      return { date: toISODate(d), label: DAY_LABELS[i], longLabel: DAY_LABELS_LONG[i], dayNum: d.getDate() };
    });
  }, [weekStart]);

  const fromStr = toISODate(weekStart);
  const toStr = toISODate(addDays(weekStart, 6));

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [apptRes, blockRes, bhRes] = await Promise.all([
        fetch(`/api/appointments?from=${fromStr}&to=${toStr}`),
        fetch(`/api/schedule-blocks`),
        fetch(`/api/business-hours`),
      ]);
      if (!apptRes.ok) throw new Error();
      const apptData = await apptRes.json();
      setAppointments(Array.isArray(apptData) ? apptData : []);

      if (blockRes.ok) {
        const blockData = await blockRes.json();
        setBlocks(Array.isArray(blockData) ? blockData : []);
      }

      if (bhRes.ok) {
        const bhData = await bhRes.json();
        if (Array.isArray(bhData) && bhData.length > 0) {
          setBusinessHours(bhData);
        }
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [fromStr, toStr]);

  useEffect(() => {
    load();
  }, [load]);

  // Filter blocks to current week (client-side)
  const weekBlocks = useMemo(() => {
    const weekDates = new Set(days.map((d) => d.date));
    return blocks.filter((b) => {
      if (b.block_date) {
        return weekDates.has(b.block_date);
      }
      return true;
    });
  }, [blocks, days]);

  // Group appointments by day key
  const apptsByDay = useMemo(() => {
    const map: Record<string, WeekAppt[]> = {};
    for (const a of appointments) {
      const key = getDayKey(a.starts_at);
      if (!map[key]) map[key] = [];
      map[key].push(a);
    }
    return map;
  }, [appointments]);

  // Group blocks by day key
  const blocksByDay = useMemo(() => {
    const map: Record<string, WeekBlock[]> = {};
    for (const b of weekBlocks) {
      const dateKey = b.block_date || '';
      if (!dateKey) continue;
      if (!map[dateKey]) map[dateKey] = [];
      map[dateKey].push(b);
    }
    return map;
  }, [weekBlocks]);

  const handleApptClick = async (appt: WeekAppt) => {
    if (appt.status === 'cancelled' || appt.status === 'attended' || appt.status === 'no_show') return;
    const action = window.confirm(
      `${appt.customer_name} — ${appt.service?.name ?? ''}\n${formatTime(appt.starts_at)}\n\n¿Qué quieres hacer?\n\n• Aceptar = Marcar como asistida\n• Cancelar = No hacer nada`
    );
    if (action) {
      setActionLoading(appt.id);
      try {
        const res = await fetch(`/api/appointments/${appt.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'attended' }),
        });
        if (!res.ok) throw new Error();
        await load();
      } catch {
        // non-fatal, could show a toast
      } finally {
        setActionLoading(null);
      }
    }
  };

  const goPrev = () => setWeekStart((d) => addDays(d, -7));
  const goNext = () => setWeekStart((d) => addDays(d, 7));
  const goToday = () => setWeekStart(startOfWeek(toISODate(new Date())));

  const rangeLabel = formatRangeShort(weekStart);
  const weekApptCount = appointments.filter((a) => a.status !== 'cancelled').length;
  const cancelledCount = appointments.filter((a) => a.status === 'cancelled').length;

  // Compute top/height for an appointment or block
  const computePosition = (startIso: string, endIso: string) => {
    const startLocal = toSantiagoDate(startIso);
    const endLocal = toSantiagoDate(endIso);
    const startMin = startLocal.getHours() * 60 + startLocal.getMinutes();
    const endMin = endLocal.getHours() * 60 + endLocal.getMinutes();
    const top = Math.max(0, (startMin - openMin) / totalMin) * 100;
    const height = Math.max(4, ((endMin - startMin) / totalMin) * 100);
    return { top: `${top}%`, height: `${height}%` };
  };

  // For blocks that may use time-only (HH:MM) without a full ISO
  const computeBlockPosition = (b: WeekBlock) => {
    const bStart = b.start_time ? parseTimeToMinutes(b.start_time.slice(0, 5)) : openMin;
    const bEnd = b.end_time ? parseTimeToMinutes(b.end_time.slice(0, 5)) : closeMin;
    const top = Math.max(0, (bStart - openMin) / totalMin) * 100;
    // A block might span the full remaining day; cap height to visible
    const height = Math.max(4, ((Math.min(bEnd, closeMin) - bStart) / totalMin) * 100);
    return { top: `${top}%`, height: `${height}%` };
  };

  // Build full-grid rows: each hour row has a label cell + 7 day cells
  return (
    <div className="stack">
      <p className="muted text-sm">Vista semanal de tu agenda. Las citas y los bloqueos se muestran en su horario.</p>

      {/* Navigation */}
      <div className="cluster gap-2">
        <button className="btn btn-sm btn-ghost" onClick={goPrev}>Semana anterior</button>
        <button className="btn btn-sm btn-ghost" onClick={goToday}>Hoy</button>
        <button className="btn btn-sm btn-ghost" onClick={goNext}>Semana siguiente</button>
        <span className="muted text-sm" style={{ fontWeight: 600 }}>{rangeLabel}</span>
      </div>

      {/* KPIs for week */}
      <div className="grid grid-sm-2">
        <div className="panel kpi">
          <span className="label">Citas esta semana</span>
          <span className="value">{loading ? '…' : weekApptCount}</span>
        </div>
        <div className="panel kpi">
          <span className="label">Canceladas</span>
          <span className="value">{loading ? '…' : cancelledCount}</span>
        </div>
      </div>

      {loading && <p className="muted">Cargando semana…</p>}

      {error && (
        <div className="alert alert-error" role="alert">
          No pudimos cargar la semana.{' '}
          <button className="btn btn-sm btn-ghost" onClick={load}>Reintentar</button>
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="table-wrap">
            <div className="week-grid" role="grid" aria-label={`Semana del ${rangeLabel}`}>
              {/* Header row */}
              <div className="week-head" role="columnheader">Hora</div>
              {days.map((d) => (
                <div key={d.date} className="week-head" role="columnheader">
                  {d.label} {d.dayNum}
                </div>
              ))}

              {/* Hour rows */}
              {hours.map((hourMin, rowIdx) => (
                <div key={rowIdx} style={{ display: 'contents' }}>
                  <div className="week-cell week-hour-label">
                    {String(Math.floor(hourMin / 60)).padStart(2, '0')}:00
                  </div>
                  {days.map((d) => {
                    const dayAppts = apptsByDay[d.date] || [];
                    const dayBlocks = blocksByDay[d.date] || [];
                    return (
                      <div key={d.date} className="week-cell" role="gridcell">
                        {/* Blocks in this cell */}
                        {dayBlocks.map((b) => {
                          const pos = computeBlockPosition(b);
                          const reason = b.reason || 'Bloqueado';
                          return (
                            <div
                              key={b.id}
                              className="week-block"
                              style={{ top: pos.top, height: pos.height }}
                              title={reason}
                            >
                              {reason.length > 18 ? reason.slice(0, 18) + '…' : reason}
                            </div>
                          );
                        })}
                        {/* Appointments in this cell */}
                        {dayAppts.map((a) => {
                          const pos = computePosition(a.starts_at, a.ends_at);
                          const stClass = statusClass(a.status, a.confirmed_at);
                          const stLabel = statusLabel(a.status, a.confirmed_at);
                          return (
                            <button
                              key={a.id}
                              className={`week-appt ${stClass}`}
                              style={{ top: pos.top, height: pos.height }}
                              onClick={() => handleApptClick(a)}
                              disabled={actionLoading === a.id}
                              aria-label={`Cita de ${a.customer_name}, ${a.service?.name ?? 'servicio'}, ${formatTime(a.starts_at)}, ${stLabel}`}
                              title={`${stLabel} — ${a.customer_name}`}
                            >
                              <div>{formatTime(a.starts_at)} {a.customer_name}</div>
                              <div className="week-appt-svc">{a.service?.name ?? ''}</div>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Legend */}
          <ul className="week-legend">
            <li><span className="swatch week-appt-st-booked" /> Reservada</li>
            <li><span className="swatch week-appt-st-confirmed" /> Confirmada</li>
            <li><span className="swatch week-appt-st-attended" /> Asistió</li>
            <li><span className="swatch week-appt-st-no_show" /> No vino</li>
            <li><span className="swatch week-appt-st-cancelled" /> Cancelada</li>
            <li><span className="swatch swatch-block" /> Bloqueado</li>
          </ul>

          {appointments.length === 0 && weekBlocks.length === 0 && (
            <div className="empty-state">
              Esta semana no tiene citas. Pulsa <strong>Agendar cita</strong> para crear una.
            </div>
          )}
        </>
      )}
    </div>
  );
}
