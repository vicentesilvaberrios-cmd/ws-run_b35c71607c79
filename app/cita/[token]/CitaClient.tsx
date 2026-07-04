'use client';

import { useState } from 'react';
import { formatTime, formatDate } from '@/lib/format';

interface CitaData {
  id: string;
  service_name: string;
  starts_at: string;
  ends_at: string;
  professional_name: string | null;
  org_name: string;
  status: string;
  confirmed_at: string | null;
}

type ActionResult = { type: 'success'; message: string } | { type: 'error'; message: string } | null;

export function CitaClient({
  initialData,
  initialError,
  token,
}: {
  initialData: Record<string, unknown> | null;
  initialError: string | null;
  token: string;
}) {
  const [cita, setCita] = useState<CitaData | null>(initialData as CitaData | null);
  const [error] = useState<string | null>(initialError);
  const [result, setResult] = useState<ActionResult>(null);
  const [loading, setLoading] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const refreshCita = async () => {
    try {
      const res = await fetch(`/api/public/cita/${token}`, { method: 'GET' });
      if (res.ok) {
        const data = await res.json();
        if (data && data.id) {
          setCita(data as CitaData);
        }
      }
    } catch {
      // non-fatal: the action itself succeeded
    }
  };

  // --- Error / not found states ---
  if (error) {
    return (
      <div className="container" style={{ paddingTop: 'var(--sp-8)', paddingBottom: 'var(--sp-8)' }}>
        <div className="card stack" style={{ maxWidth: 480, marginInline: 'auto' }}>
          <div className="alert alert-error" role="alert">{error}</div>
        </div>
      </div>
    );
  }

  if (!cita) {
    return (
      <div className="container" style={{ paddingTop: 'var(--sp-8)', paddingBottom: 'var(--sp-8)' }}>
        <div className="card stack" style={{ maxWidth: 480, marginInline: 'auto' }}>
          <p className="muted">No encontramos una cita con este enlace.</p>
        </div>
      </div>
    );
  }

  const isCancelled = cita.status === 'cancelled';
  const isPast = new Date(cita.starts_at) <= new Date();
  const canAct = !isCancelled && !isPast && !result;
  const isConfirmed = !!cita.confirmed_at;

  const handleConfirm = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`/api/public/cita/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'confirm' }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult({ type: 'error', message: data.error || 'No pudimos confirmar tu cita. Inténtalo de nuevo.' });
      } else {
        setResult({ type: 'success', message: '¡Tu cita está confirmada! Te esperamos.' });
        await refreshCita();
      }
    } catch {
      setResult({ type: 'error', message: 'No pudimos confirmar tu cita. Inténtalo de nuevo.' });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`/api/public/cita/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult({ type: 'error', message: data.error || 'No pudimos cancelar tu cita. Inténtalo de nuevo.' });
      } else {
        setResult({ type: 'success', message: 'Tu cita fue cancelada. El horario quedó libre.' });
        await refreshCita();
      }
    } catch {
      setResult({ type: 'error', message: 'No pudimos cancelar tu cita. Inténtalo de nuevo.' });
    } finally {
      setLoading(false);
      setConfirmCancel(false);
    }
  };

  const fecha = formatDate(cita.starts_at.slice(0, 10));
  const hora = formatTime(cita.starts_at);

  return (
    <div className="container" style={{ paddingTop: 'var(--sp-8)', paddingBottom: 'var(--sp-8)' }}>
      <div className="card stack" style={{ maxWidth: 480, marginInline: 'auto' }}>
        <h1>Tu cita</h1>

        {/* Estado actual */}
        {isCancelled && (
          <div className="alert alert-error" role="status">
            Esta cita fue cancelada.
          </div>
        )}
        {isPast && !isCancelled && (
          <div className="alert alert-info" role="status">
            Esta cita ya no se puede modificar porque ya ocurrió o está en curso.
          </div>
        )}
        {isConfirmed && !isCancelled && !isPast && (
          <div className="alert alert-success" role="status">
            Ya confirmaste tu asistencia. ¡Gracias!
          </div>
        )}

        {/* Detalles de la cita */}
        <div className="panel stack" style={{ gap: 'var(--sp-2)' }}>
          <div className="cluster" style={{ justifyContent: 'space-between' }}>
            <span className="muted text-sm">Negocio</span>
            <span style={{ fontWeight: 600 }}>{cita.org_name}</span>
          </div>
          <div className="cluster" style={{ justifyContent: 'space-between' }}>
            <span className="muted text-sm">Servicio</span>
            <span style={{ fontWeight: 600 }}>{cita.service_name}</span>
          </div>
          {cita.professional_name && (
            <div className="cluster" style={{ justifyContent: 'space-between' }}>
              <span className="muted text-sm">Profesional</span>
              <span style={{ fontWeight: 600 }}>{cita.professional_name}</span>
            </div>
          )}
          <div className="cluster" style={{ justifyContent: 'space-between' }}>
            <span className="muted text-sm">Día</span>
            <span style={{ fontWeight: 600 }}>{fecha}</span>
          </div>
          <div className="cluster" style={{ justifyContent: 'space-between' }}>
            <span className="muted text-sm">Hora</span>
            <span style={{ fontWeight: 600 }}>{hora}</span>
          </div>
        </div>

        {/* Resultado de acción */}
        {result && (
          <div
            className={result.type === 'success' ? 'alert alert-success' : 'alert alert-error'}
            role="status"
          >
            {result.message}
          </div>
        )}

        {/* Confirmación de cancelación */}
        {confirmCancel && canAct && (
          <div className="alert alert-info" role="alert">
            <p>¿Seguro que quieres cancelar esta cita? El horario quedará libre para otras personas.</p>
            <div className="cluster gap-2" style={{ marginTop: 'var(--sp-2)' }}>
              <button
                className="btn btn-danger btn-block"
                disabled={loading}
                onClick={handleCancel}
              >
                {loading ? 'Cancelando…' : 'Sí, cancelar mi cita'}
              </button>
              <button
                className="btn btn-ghost btn-block"
                disabled={loading}
                onClick={() => setConfirmCancel(false)}
              >
                No, mantener mi cita
              </button>
            </div>
          </div>
        )}

        {/* Botones de acción */}
        {canAct && !confirmCancel && (
          <div className="stack" style={{ gap: 'var(--sp-3)' }}>
            {!isConfirmed && (
              <button
                className="btn btn-primary btn-block"
                disabled={loading}
                onClick={handleConfirm}
              >
                {loading ? 'Confirmando…' : 'Confirmar asistencia'}
              </button>
            )}
            <button
              className="btn btn-danger btn-block"
              disabled={loading}
              onClick={() => setConfirmCancel(true)}
            >
              Cancelar cita
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
