'use client';

import { useState, useEffect, useCallback } from 'react';
import { ServiceForm, type Service } from './ServiceForm';
import { formatPrice } from '@/lib/format';

export default function ServiciosPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Service | null>(null);

  const loadServices = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch('/api/services');
      if (!res.ok) throw new Error();
      const data = await res.json();
      setServices(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadServices();
  }, [loadServices]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await fetch(`/api/services/${deleteTarget.id}`, { method: 'DELETE' });
      setServices((prev) => prev.filter((s) => s.id !== deleteTarget.id));
    } catch {
      // ignore
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div className="stack">
      <div>
        <h1>Servicios</h1>
        <p className="subtitle">Define qué ofreces, cuánto dura y cuánto cuesta.</p>
      </div>

      <div className="grid grid-md-2" style={{ alignItems: 'start' }}>
        {/* List */}
        <div className="stack">
          {loading && <p className="muted">Cargando servicios…</p>}
          {error && (
            <div className="alert alert-error" role="alert">
              No pudimos cargar los servicios.{' '}
              <button className="btn btn-sm btn-ghost" onClick={loadServices}>Reintentar</button>
            </div>
          )}
          {!loading && !error && services.length === 0 && (
            <div className="empty-state">
              Aún no tienes servicios. Crea el primero para empezar a recibir reservas.
            </div>
          )}
          {!loading && !error && services.length > 0 && (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Servicio</th>
                    <th scope="col">Duración</th>
                    <th scope="col">Precio</th>
                    <th scope="col">Estado</th>
                    <th scope="col"><span className="sr-only">Acciones</span></th>
                  </tr>
                </thead>
                <tbody>
                  {services.map((svc) => (
                    <tr key={svc.id}>
                      <td style={{ fontWeight: 600 }}>{svc.name}</td>
                      <td>{svc.duration_min} min</td>
                      <td>{formatPrice(svc.price)}</td>
                      <td>
                        {svc.is_active ? (
                          <span className="badge badge-ok">Disponible</span>
                        ) : (
                          <span className="badge badge-warn">Pausado</span>
                        )}
                      </td>
                      <td>
                        <div className="cluster gap-2">
                          <button
                            className="btn btn-sm btn-ghost"
                            onClick={() => setEditing(svc)}
                          >
                            Editar
                          </button>
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() => setDeleteTarget(svc)}
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Form */}
        <ServiceForm
          service={editing}
          onSaved={() => {
            setEditing(null);
            loadServices();
          }}
          onCancel={() => setEditing(null)}
        />
      </div>

      {/* Delete confirmation */}
      {deleteTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-title"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--sp-4)',
            zIndex: 100,
          }}
          onClick={() => setDeleteTarget(null)}
        >
          <div className="card stack" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
            <h2 id="delete-title">Eliminar servicio</h2>
            <p>
              ¿Eliminar &ldquo;{deleteTarget.name}&rdquo;? Ya no estará disponible para reservar.
            </p>
            <div className="cluster" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setDeleteTarget(null)}>
                Cancelar
              </button>
              <button className="btn btn-danger" onClick={handleDelete}>
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
