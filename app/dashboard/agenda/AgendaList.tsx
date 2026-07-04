'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { formatTime, formatDate, normalizePhoneCL } from '@/lib/format';

interface AgendaItem {
  id: string;
  starts_at: string;
  ends_at: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  status: string;
  public_token: string | null;
  confirmed_at: string | null;
  service: { id: string; name: string; duration_min: number } | null;
  professional_name: string | null;
}

interface Service {
  id: string;
  name: string;
  duration_min: number;
}

interface Professional {
  id: string;
  name: string;
  active: boolean;
}

function todayStr(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });
}

function tomorrowStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'cancelled') return <span className="badge badge-danger">Cancelada</span>;
  if (status === 'attended') return <span className="badge badge-ok">Asistió</span>;
  if (status === 'no_show') return <span className="badge badge-warn">No asistió</span>;
  return <span className="badge badge-info">Reservada</span>;
}

function buildWhatsAppUrl(item: AgendaItem, orgName: string): string | null {
  const phone = normalizePhoneCL(item.customer_phone);
  if (!phone) return null;
  const fecha = formatDate(item.starts_at.slice(0, 10));
  const hora = formatTime(item.starts_at);
  const servicio = item.service?.name ?? 'Servicio';
  const profesional = item.professional_name ? `\n• Profesional: ${item.professional_name}` : '';
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== 'undefined' ? window.location.origin : '');
  const citaLink = item.public_token && siteUrl ? `${siteUrl}/cita/${item.public_token}` : '';
  const msg =
    `Hola ${item.customer_name}, te recordamos tu cita en ${orgName}:\n\n` +
    `• Servicio: ${servicio}\n` +
    `• Fecha: ${fecha}\n` +
    `• Hora: ${hora}` +
    profesional +
    (citaLink ? `\n\nPuedes confirmar o cancelar tu cita aquí: ${citaLink}` : '');
  return `https://wa.me/${phone.replace('+', '')}?text=${encodeURIComponent(msg)}`;
}

export function AgendaList({ initialDate, slug, orgName }: { initialDate: string; slug: string | null; orgName: string | null }) {
  const [date, setDate] = useState(initialDate);
  const [items, setItems] = useState<AgendaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async (d: string) => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/appointments?date=${d}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setItems(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(date);
  }, [date, load]);

  const handleStatusChange = async (id: string, status: string, customerName?: string) => {
    if (status === 'cancelled' && customerName) {
      const ok = window.confirm(`¿Cancelar la cita de ${customerName}?`);
      if (!ok) return;
    }
    setActionLoading(id);
    setRowErrors((prev) => { const next = { ...prev }; delete next[id]; return next; });
    try {
      const res = await fetch(`/api/appointments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al actualizar');
      }
      await load(date);
    } catch {
      setRowErrors((prev) => ({
        ...prev,
        [id]: 'No pudimos actualizar la cita. Inténtalo de nuevo.',
      }));
    } finally {
      setActionLoading(null);
    }
  };

  const nextCita = items.length > 0 ? formatTime(items[0].starts_at) : '—';
  const noShowCount = items.filter((i) => i.status === 'no_show').length;

  return (
    <div className="stack">
      <div className="field">
        <label htmlFor="agenda-date">Día</label>
        <div className="cluster gap-2">
          <input
            id="agenda-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{ maxWidth: 200 }}
          />
          <button className="btn btn-sm btn-ghost" onClick={() => setDate(todayStr())}>
            Hoy
          </button>
          <button className="btn btn-sm btn-ghost" onClick={() => setDate(tomorrowStr())}>
            Mañana
          </button>
          <button className="btn btn-sm btn-primary" onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Cerrar' : 'Nueva cita'}
          </button>
        </div>
      </div>

      {showForm && slug && (
        <CreateAppointmentForm
          date={date}
          slug={slug}
          onCreated={() => {
            setShowForm(false);
            load(date);
          }}
        />
      )}
      {showForm && !slug && (
        <div className="alert alert-error" role="alert">
          No pudimos obtener tu enlace público. Recarga la página.
        </div>
      )}

      <div className="grid grid-sm-2">
        <div className="panel kpi">
          <span className="label">Citas del día</span>
          <span className="value">{loading ? '…' : items.length}</span>
        </div>
        <div className="panel kpi">
          <span className="label">Próxima cita</span>
          <span className="value">{loading ? '…' : nextCita}</span>
        </div>
      </div>

      {noShowCount > 0 && (
        <div className="panel kpi">
          <span className="label">No-shows del día</span>
          <span className="value">{noShowCount}</span>
        </div>
      )}

      {loading && <p className="muted">Cargando agenda…</p>}

      {error && (
        <div className="alert alert-error" role="alert">
          No pudimos cargar las citas.{' '}
          <button className="btn btn-sm btn-ghost" onClick={() => load(date)}>Reintentar</button>
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="empty-state">
          No hay citas para este día. Comparte tu link público para empezar a recibir reservas.
        </div>
      )}

      {!loading && !error && items.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <caption className="sr-only">Citas del {date}</caption>
            <thead>
              <tr>
                <th scope="col">Hora</th>
                <th scope="col">Servicio</th>
                <th scope="col">Profesional</th>
                <th scope="col">Cliente</th>
                <th scope="col">Contacto</th>
                <th scope="col">Estado</th>
                <th scope="col">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {formatTime(item.starts_at)}
                  </td>
                  <td>{item.service?.name ?? '—'}</td>
                  <td>{item.professional_name ?? '—'}</td>
                  <td>{item.customer_name}</td>
                  <td className="text-sm">
                    <div>{item.customer_phone}</div>
                    <div className="muted">{item.customer_email}</div>
                  </td>
                  <td>
                    <div className="stack gap-2">
                      <StatusBadge status={item.status} />
                      {item.confirmed_at && item.status === 'booked' && (
                        <span className="badge badge-ok">Confirmada por el cliente</span>
                      )}
                    </div>
                  </td>
                  <td>
                    {item.status === 'booked' && (
                      <div className="stack gap-2">
                        <div className="cluster gap-2">
                          <button
                            className="btn btn-sm btn-primary"
                            disabled={actionLoading === item.id}
                            aria-label={`Marcar como asistió a ${item.customer_name}`}
                            onClick={() => handleStatusChange(item.id, 'attended')}
                          >
                            Asistió
                          </button>
                          <button
                            className="btn btn-sm btn-ghost"
                            disabled={actionLoading === item.id}
                            aria-label={`Marcar que ${item.customer_name} no asistió`}
                            onClick={() => handleStatusChange(item.id, 'no_show')}
                          >
                            No-show
                          </button>
                          <button
                            className="btn btn-sm btn-danger"
                            disabled={actionLoading === item.id}
                            onClick={() => handleStatusChange(item.id, 'cancelled', item.customer_name)}
                          >
                            Cancelar
                          </button>
                        </div>
                        {(() => {
                          const waUrl = buildWhatsAppUrl(item, orgName ?? 'el negocio');
                          if (waUrl) {
                            return (
                              <a
                                href={waUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-sm btn-ghost"
                              >
                                Recordar por WhatsApp
                              </a>
                            );
                          }
                          return (
                            <span className="cluster gap-1">
                              <button className="btn btn-sm btn-ghost" disabled>
                                Recordar por WhatsApp
                              </button>
                              <span className="help-tip" data-tip="El teléfono del cliente no es un número chileno válido." tabIndex={0} role="note" aria-label="El teléfono del cliente no es un número chileno válido.">?</span>
                            </span>
                          );
                        })()}
                        {rowErrors[item.id] && (
                          <div className="alert alert-error" role="alert">
                            {rowErrors[item.id]}
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CreateAppointmentForm({
  date,
  slug,
  onCreated,
}: {
  date: string;
  slug: string;
  onCreated: () => void;
}) {
  const [services, setServices] = useState<Service[]>([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [professionalsLoading, setProfessionalsLoading] = useState(true);
  const [professionalId, setProfessionalId] = useState('');

  const [serviceId, setServiceId] = useState('');
  const [slots, setSlots] = useState<{ starts_at: string; ends_at: string }[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ starts_at: string; ends_at: string } | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [clientMatches, setClientMatches] = useState<{ id: string; name: string; phone: string | null; email: string | null }[]>([]);
  const [clientSearchLoading, setClientSearchLoading] = useState(false);
  const [isNewClient, setIsNewClient] = useState(true);

  const clearFieldError = (field: string) => {
    setFieldErrors((prev) => { const next = { ...prev }; delete next[field]; return next; });
    if (formError) setFormError(null);
  };

  // Debounced client search by phone
  const phoneSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handlePhoneChange = (value: string) => {
    setPhone(value);
    clearFieldError('phone');
    setClientMatches([]);
    setIsNewClient(true);
    if (phoneSearchTimer.current) clearTimeout(phoneSearchTimer.current);
    if (value.trim().length >= 4) {
      setClientSearchLoading(true);
      phoneSearchTimer.current = setTimeout(async () => {
        try {
          const res = await fetch(`/api/clients/search?phone=${encodeURIComponent(value.trim())}`);
          if (res.ok) {
            const data = await res.json();
            setClientMatches(Array.isArray(data) ? data : []);
          }
        } catch {
          // non-fatal
        } finally {
          setClientSearchLoading(false);
        }
      }, 350);
    }
  };

  const selectClient = (c: { name: string; phone: string | null; email: string | null }) => {
    setName(c.name);
    setPhone(c.phone ?? '');
    setEmail(c.email ?? '');
    setClientMatches([]);
    setIsNewClient(false);
    setFieldErrors({});
    if (formError) setFormError(null);
  };

  useEffect(() => {
    fetch('/api/services')
      .then((r) => r.json())
      .then((data) => {
        setServices(Array.isArray(data) ? data : []);
        setServicesLoading(false);
      })
      .catch(() => setServicesLoading(false));

    fetch('/api/professionals')
      .then((r) => r.json())
      .then((data) => {
        const active = (Array.isArray(data) ? data : []).filter((p: Professional) => p.active);
        setProfessionals(active);
        setProfessionalsLoading(false);
      })
      .catch(() => setProfessionalsLoading(false));
  }, []);

  const loadSlots = useCallback(async (svcId: string, profId: string) => {
    setSlotsLoading(true);
    setSlotsError(false);
    setSelectedSlot(null);
    try {
      const params = new URLSearchParams({ serviceId: svcId, date });
      if (profId) params.set('professionalId', profId);
      const res = await fetch(
        `/api/public/${slug}/availability?${params.toString()}`
      );
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSlots(data);
    } catch {
      setSlotsError(true);
    } finally {
      setSlotsLoading(false);
    }
  }, [slug, date]);

  const handleServiceChange = (svcId: string) => {
    setServiceId(svcId);
    clearFieldError('serviceId');
    if (svcId && professionalId) {
      loadSlots(svcId, professionalId);
    } else {
      setSlots([]);
      setSelectedSlot(null);
    }
  };

  const handleProfessionalChange = (profId: string) => {
    setProfessionalId(profId);
    clearFieldError('professionalId');
    if (profId && serviceId) {
      loadSlots(serviceId, profId);
    } else {
      setSlots([]);
      setSelectedSlot(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const errors: Record<string, string> = {};
    if (!professionalId) errors.professionalId = 'Elige un profesional para la cita.';
    if (!serviceId) errors.serviceId = 'Selecciona un servicio';
    if (!selectedSlot) errors.slot = 'Elige un horario disponible';
    if (!name.trim()) errors.name = 'El nombre es obligatorio';
    if (!phone.trim()) errors.phone = 'El teléfono es obligatorio';
    if (!email.trim()) errors.email = 'El email es obligatorio';
    else if (!/^.+@.+\..+$/.test(email)) errors.email = 'Email inválido';
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    setSubmitting(true);

    try {
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id: serviceId,
          starts_at: selectedSlot!.starts_at,
          customer_name: name.trim(),
          customer_phone: phone.trim(),
          customer_email: email.trim(),
          professional_id: professionalId,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al crear la cita');
      }

      const data = await res.json();
      if (data.email_sent === false) {
        setSuccessMsg('Cita guardada. No pudimos enviar el correo de confirmación; avisa al cliente directamente.');
      } else {
        setSuccessMsg('Cita guardada. Se envió la confirmación al correo del cliente.');
      }
      // Mostrar el resultado brevemente antes de cerrar
      setTimeout(() => onCreated(), 1500);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No pudimos guardar la cita. Revisa los datos e inténtalo de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="panel stack" onSubmit={handleSubmit}>
      <h2 className="text-lg" style={{ fontWeight: 700 }}>Nueva cita</h2>

      {successMsg && (
        <div className="alert alert-success" role="status">{successMsg}</div>
      )}

      {servicesLoading || professionalsLoading ? (
        <p className="muted">Cargando servicios…</p>
      ) : professionals.length === 0 ? (
        <div className="alert alert-info">
          Crea y activa un profesional antes de agendar citas.{' '}
          <a href="/dashboard/profesionales" className="link">Ir a profesionales</a>
        </div>
      ) : services.length === 0 ? (
        <div className="alert alert-info">
          No tienes servicios configurados.{' '}
          <a href="/dashboard/servicios" className="link">Crear un servicio</a>
        </div>
      ) : (
        <>
          <div className="field">
            <label htmlFor="form-professional">Profesional</label>
            <select
              id="form-professional"
              value={professionalId}
              onChange={(e) => handleProfessionalChange(e.target.value)}
              aria-invalid={!!fieldErrors.professionalId}
              aria-describedby={fieldErrors.professionalId ? 'form-professional-error' : undefined}
              required
            >
              <option value="">Selecciona un profesional</option>
              {professionals.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            {fieldErrors.professionalId && (
              <p id="form-professional-error" className="error-text">{fieldErrors.professionalId}</p>
            )}
          </div>

          <div className="field">
            <label htmlFor="form-service">Servicio</label>
            <select
              id="form-service"
              value={serviceId}
              onChange={(e) => handleServiceChange(e.target.value)}
              aria-invalid={!!fieldErrors.serviceId}
              aria-describedby={fieldErrors.serviceId ? 'form-service-error' : undefined}
              required
            >
              <option value="">Selecciona un servicio</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.duration_min} min)
                </option>
              ))}
            </select>
            {fieldErrors.serviceId && (
              <p id="form-service-error" className="error-text">{fieldErrors.serviceId}</p>
            )}
          </div>

          {serviceId && professionalId && (
            <div className="field">
              <span className="label">Horario disponible</span>
              {slotsLoading && <p className="muted">Buscando horarios…</p>}
              {slotsError && (
                <div className="alert alert-error" role="alert">
                  No pudimos cargar los horarios.{' '}
                  <button type="button" className="btn btn-sm btn-ghost" onClick={() => loadSlots(serviceId, professionalId)}>
                    Reintentar
                  </button>
                </div>
              )}
              {!slotsLoading && !slotsError && slots.length === 0 && (
                <p className="muted">No hay horarios disponibles para este día. Elige otro día o ajusta tu horario.</p>
              )}
              {!slotsLoading && !slotsError && slots.length > 0 && (
                <div className="grid grid-sm-2 grid-md-3">
                  {slots.map((slot, i) => (
                    <button
                      key={i}
                      type="button"
                      className={selectedSlot?.starts_at === slot.starts_at ? 'btn btn-primary' : 'btn btn-ghost'}
                      onClick={() => { setSelectedSlot(slot); clearFieldError('slot'); }}
                    >
                      {formatTime(slot.starts_at)}
                    </button>
                  ))}
                </div>
              )}
              {fieldErrors.slot && (
                <p className="error-text">{fieldErrors.slot}</p>
              )}
            </div>
          )}

          <div className="field">
            <label htmlFor="form-name">Nombre del cliente</label>
            <input
              id="form-name"
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); clearFieldError('name'); }}
              aria-invalid={!!fieldErrors.name}
              aria-describedby={fieldErrors.name ? 'form-name-error' : undefined}
              required
            />
            {fieldErrors.name && (
              <p id="form-name-error" className="error-text">{fieldErrors.name}</p>
            )}
          </div>

          <div className="field">
            <label htmlFor="form-phone">Teléfono</label>
            <input
              id="form-phone"
              type="tel"
              value={phone}
              onChange={(e) => { handlePhoneChange(e.target.value); }}
              aria-invalid={!!fieldErrors.phone}
              aria-describedby={fieldErrors.phone ? 'form-phone-error' : undefined}
              required
            />
            {fieldErrors.phone && (
              <p id="form-phone-error" className="error-text">{fieldErrors.phone}</p>
            )}
            {clientSearchLoading && (
              <p className="text-sm muted">Buscando clientes…</p>
            )}
            {!clientSearchLoading && clientMatches.length > 0 && (
              <div className="stack gap-1" style={{ marginTop: 'var(--sp-1)' }}>
                <p className="text-sm muted">¿Es alguno de estos clientes?</p>
                {clientMatches.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="btn btn-sm btn-ghost"
                    onClick={() => selectClient(c)}
                  >
                    {c.name} — {c.phone ?? 'sin teléfono'}
                  </button>
                ))}
              </div>
            )}
            {!clientSearchLoading && phone.trim().length >= 4 && clientMatches.length === 0 && isNewClient && (
              <p className="text-sm muted">Cliente nuevo</p>
            )}
          </div>

          <div className="field">
            <label htmlFor="form-email">Email</label>
            <input
              id="form-email"
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); clearFieldError('email'); }}
              aria-invalid={!!fieldErrors.email}
              aria-describedby={fieldErrors.email ? 'form-email-error' : undefined}
              required
            />
            {fieldErrors.email && (
              <p id="form-email-error" className="error-text">{fieldErrors.email}</p>
            )}
          </div>

          {formError && (
            <div className="alert alert-error" role="alert">{formError}</div>
          )}

          <div className="cluster">
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Guardando cita…' : 'Guardar cita'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={onCreated} disabled={submitting}>
              Cancelar
            </button>
          </div>
        </>
      )}
    </form>
  );
}
