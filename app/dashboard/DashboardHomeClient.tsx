'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getQrDataUrl, downloadQr } from '@/lib/qr';

export default function DashboardHomeClient({
  orgName,
  slug,
  needsSetup,
  hasServices,
  hasHours,
  hasProfessionals,
  todayApptsCount,
}: {
  orgName: string;
  slug: string;
  needsSetup: boolean;
  hasServices: boolean;
  hasHours: boolean;
  hasProfessionals: boolean;
  todayApptsCount: number;
}) {
  const [copied, setCopied] = useState(false);
  const [qrError, setQrError] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [noShowCount, setNoShowCount] = useState<number | null>(null);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || '';
  const bookUrl = siteUrl
    ? `${siteUrl}/book/${slug}`
    : (typeof window !== 'undefined' ? `${window.location.origin}/book/${slug}` : `/book/${slug}`);

  useEffect(() => {
    if (!bookUrl) return;
    getQrDataUrl(bookUrl, 200)
      .then(setQrDataUrl)
      .catch(() => setQrError(true));
  }, [bookUrl]);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    fetch(`/api/appointments?date=${today}`)
      .then((r) => r.ok ? r.json() : [])
      .then((data) => {
        setNoShowCount(Array.isArray(data) ? data.filter((a: { status: string }) => a.status === 'no_show').length : 0);
      })
      .catch(() => setNoShowCount(0));
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(bookUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: no clipboard available
    }
  };

  const handleDownloadQr = async () => {
    try {
      setQrError(false);
      await downloadQr(bookUrl, `qr-${slug}.png`);
    } catch {
      setQrError(true);
    }
  };

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`¡Hola! Reserva tu cita en ${orgName} aquí: ${bookUrl}`)}`;

  // Steps completion
  const stepsComplete = hasServices && hasHours;

  return (
    <div className="stack">
      <h1>Hola, {orgName}</h1>

      {/* ONBOARDING — solo si falta configurar servicios u horario */}
      {needsSetup && (
        <div className="card stack">
          <h2 style={{ marginBottom: 0 }}>Deja tu agenda lista</h2>
          <p className="text-sm muted" style={{ marginTop: 0 }}>
            Completa estos 3 pasos para empezar a recibir reservas online.
          </p>

          <ol className="steps stack gap-2" style={{ listStyle: 'none', padding: 0 }}>
            {/* Step 1: Crear servicio */}
            <li className="cluster gap-2" style={{ alignItems: 'flex-start' }}>
              <span
                className="cluster"
                style={{
                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                  background: hasServices ? 'var(--success, #22c55e)' : 'var(--surface-2)',
                  color: hasServices ? '#fff' : 'var(--text-muted)',
                  fontWeight: 700, justifyContent: 'center', fontSize: '0.85rem',
                }}
              >
                {hasServices ? '✓' : '1'}
              </span>
              <div className="stack gap-0" style={{ flex: 1 }}>
                <span style={{ fontWeight: 600 }}>Crea tu primer servicio</span>
                <span className="text-sm muted">Define qué ofreces, su duración y precio.</span>
              </div>
              {!hasServices && (
                <Link href="/dashboard/servicios" className="btn btn-sm btn-primary">Crear servicio</Link>
              )}
            </li>

            {/* Step 2: Definir horario */}
            <li className="cluster gap-2" style={{ alignItems: 'flex-start' }}>
              <span
                className="cluster"
                style={{
                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                  background: hasHours ? 'var(--success, #22c55e)' : 'var(--surface-2)',
                  color: hasHours ? '#fff' : 'var(--text-muted)',
                  fontWeight: 700, justifyContent: 'center', fontSize: '0.85rem',
                }}
              >
                {hasHours ? '✓' : '2'}
              </span>
              <div className="stack gap-0" style={{ flex: 1 }}>
                <span style={{ fontWeight: 600 }}>Define tu horario</span>
                <span className="text-sm muted">Elige los días y horas en que atiendes.</span>
              </div>
              {!hasHours && (
                <Link href="/dashboard/horario" className="btn btn-sm btn-primary">Configurar horario</Link>
              )}
            </li>

            {/* Step 3: Compartir link */}
            <li className="cluster gap-2" style={{ alignItems: 'flex-start' }}>
              <span
                className="cluster"
                style={{
                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                  background: stepsComplete ? 'var(--success, #22c55e)' : 'var(--surface-2)',
                  color: stepsComplete ? '#fff' : 'var(--text-muted)',
                  fontWeight: 700, justifyContent: 'center', fontSize: '0.85rem',
                }}
              >
                {stepsComplete ? '✓' : '3'}
              </span>
              <div className="stack gap-0" style={{ flex: 1 }}>
                <span style={{ fontWeight: 600 }}>Comparte tu link</span>
                <span className="text-sm muted">Pásalo a tus clientes para que reserven solos.</span>
              </div>
            </li>
          </ol>
        </div>
      )}

      {/* TARJETA "Tu link de reservas" — se muestra cuando NO hay onboarding pendiente */}
      {!needsSetup && (
        <div className="panel stack">
          <label className="text-sm muted" style={{ fontWeight: 600 }}>Tu link de reservas</label>
          <p className="text-sm muted" style={{ marginTop: 0 }}>
            Compártelo en Instagram, WhatsApp o pégalo impreso en tu local.
          </p>

          <div className="cluster gap-2" style={{ flexWrap: 'wrap' }}>
            <code
              className="text-sm"
              style={{
                background: 'var(--surface-2)',
                padding: '0.4rem 0.75rem',
                borderRadius: 'var(--radius-sm)',
                flex: 1,
                overflowX: 'auto',
                whiteSpace: 'nowrap',
                minWidth: 200,
              }}
            >
              {bookUrl}
            </code>
            <button className="btn btn-sm" onClick={handleCopy}>
              {copied ? 'Copiado' : 'Copiar'}
            </button>
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-primary">
              Compartir por WhatsApp
            </a>
          </div>

          {/* QR (generado localmente, sin depender de servicios externos) */}
          <div className="cluster gap-2" style={{ flexWrap: 'wrap', alignItems: 'flex-start' }}>
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt={`Código QR de ${bookUrl}`}
                width={160}
                height={160}
                style={{ borderRadius: 'var(--radius-sm)' }}
              />
            ) : (
              <div
                aria-hidden="true"
                style={{
                  width: 160, height: 160, borderRadius: 'var(--radius-sm)',
                  background: 'var(--surface-2)',
                }}
              />
            )}
            <div className="stack gap-1">
              <button className="btn btn-sm" onClick={handleDownloadQr} disabled={!qrDataUrl}>
                Descargar QR
              </button>
              {qrError && <span className="text-sm error-text">No se pudo generar el QR. Intenta de nuevo.</span>}
            </div>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-sm-2">
        <div className="panel kpi">
          <span className="label">Citas de hoy</span>
          <span className="value">{todayApptsCount}</span>
        </div>
        <div className="panel kpi">
          <span className="label">No-shows de hoy</span>
          <span className="value">{noShowCount === null ? '…' : noShowCount}</span>
        </div>
      </div>

      {/* Acciones rápidas */}
      <div className="cluster" style={{ flexWrap: 'wrap' }}>
        <Link href="/dashboard/agenda" className="btn btn-primary">Ver agenda de hoy</Link>
        <Link href="/dashboard/servicios" className="btn btn-ghost">Gestionar servicios</Link>
        <Link href="/dashboard/horario" className="btn btn-ghost">Configurar horario</Link>
      </div>
    </div>
  );
}
