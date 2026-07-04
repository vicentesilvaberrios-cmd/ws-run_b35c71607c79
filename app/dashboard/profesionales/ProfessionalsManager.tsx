'use client';

import { useState, useEffect, useCallback } from 'react';

interface Professional {
  id: string;
  name: string;
  active: boolean;
}

export function ProfessionalsManager() {
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Add form
  const [newName, setNewName] = useState('');
  const [newNameError, setNewNameError] = useState('');
  const [adding, setAdding] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editError, setEditError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch('/api/professionals');
      if (!res.ok) throw new Error();
      const data = await res.json();
      setProfessionals(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      setNewNameError('Escribe un nombre para continuar.');
      return;
    }
    setAdding(true);
    setNewNameError('');
    try {
      const res = await fetch('/api/professionals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'No pudimos agregar el profesional.');
      }
      const created = await res.json();
      setProfessionals((prev) => [...prev, created]);
      setNewName('');
      showSuccess('Listo, guardamos los cambios.');
    } catch {
      setNewNameError('No pudimos agregar el profesional. Inténtalo de nuevo.');
    } finally {
      setAdding(false);
    }
  };

  const startEdit = (p: Professional) => {
    setEditingId(p.id);
    setEditName(p.name);
    setEditError('');
  };

  const handleSaveEdit = async (id: string) => {
    if (!editName.trim()) {
      setEditError('Escribe un nombre para continuar.');
      return;
    }
    setSaving(true);
    setEditError('');
    try {
      const res = await fetch(`/api/professionals/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'No pudimos guardar los cambios.');
      }
      const updated = await res.json();
      setProfessionals((prev) => prev.map((p) => (p.id === id ? updated : p)));
      setEditingId(null);
      showSuccess('Listo, guardamos los cambios.');
    } catch {
      setEditError('No pudimos guardar los cambios. Inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (p: Professional) => {
    try {
      const res = await fetch(`/api/professionals/${p.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !p.active }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setProfessionals((prev) => prev.map((x) => (x.id === p.id ? updated : x)));
      showSuccess('Listo, guardamos los cambios.');
    } catch {
      showSuccess('');
      setError(true);
    }
  };

  const handleDelete = async (p: Professional) => {
    const ok = window.confirm(`¿Eliminar a ${p.name}? Sus horarios quedarán sin asignar.`);
    if (!ok) return;
    try {
      const res = await fetch(`/api/professionals/${p.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setProfessionals((prev) => prev.filter((x) => x.id !== p.id));
      showSuccess('Listo, guardamos los cambios.');
    } catch {
      setError(true);
    }
  };

  return (
    <div className="stack">
      {successMsg && (
        <div className="alert alert-success" role="status">{successMsg}</div>
      )}

      {/* Add form */}
      <form className="card stack" onSubmit={handleAdd}>
        <h2 style={{ fontSize: 'var(--fs-lg)', fontWeight: 700 }}>Agregar profesional</h2>
        <div className="field">
          <label htmlFor="prof-name">Nombre del profesional</label>
          <input
            id="prof-name"
            type="text"
            placeholder="Ej: Camila Rojas"
            value={newName}
            onChange={(e) => { setNewName(e.target.value); if (newNameError) setNewNameError(''); }}
            aria-invalid={!!newNameError}
            aria-describedby={newNameError ? 'prof-name-error' : undefined}
          />
          {newNameError && (
            <p id="prof-name-error" className="error-text">{newNameError}</p>
          )}
        </div>
        <div className="cluster">
          <button type="submit" className="btn btn-primary" disabled={adding}>
            {adding ? 'Guardando…' : 'Agregar profesional'}
          </button>
        </div>
      </form>

      {/* List */}
      <div className="card stack">
        {loading && <p className="muted">Cargando profesionales…</p>}

        {error && (
          <div className="alert alert-error" role="alert">
            No pudimos cargar los profesionales.{' '}
            <button className="btn btn-sm btn-ghost" onClick={load}>Reintentar</button>
          </div>
        )}

        {!loading && !error && professionals.length === 0 && (
          <div className="empty-state">
            Aún no hay profesionales. Agrega al primero para empezar a asignar horarios y citas.
          </div>
        )}

        {!loading && !error && professionals.length > 0 && (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Nombre</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {professionals.map((p) => (
                  <tr key={p.id}>
                    <td>
                      {editingId === p.id ? (
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => { setEditName(e.target.value); if (editError) setEditError(''); }}
                          aria-invalid={!!editError}
                          aria-describedby={editError ? `edit-error-${p.id}` : undefined}
                          style={{ maxWidth: 240 }}
                        />
                      ) : (
                        <span style={{ fontWeight: 600 }}>{p.name}</span>
                      )}
                      {editingId === p.id && editError && (
                        <p id={`edit-error-${p.id}`} className="error-text">{editError}</p>
                      )}
                    </td>
                    <td>
                      {p.active
                        ? <span className="badge badge-ok">Activo</span>
                        : <span className="badge badge-warn">Inactivo</span>}
                    </td>
                    <td>
                      {editingId === p.id ? (
                        <div className="cluster gap-2">
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => handleSaveEdit(p.id)}
                            disabled={saving}
                          >
                            Guardar
                          </button>
                          <button
                            className="btn btn-sm btn-ghost"
                            onClick={() => { setEditingId(null); setEditError(''); }}
                            disabled={saving}
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <div className="cluster gap-2">
                          <button
                            className="btn btn-sm btn-ghost"
                            onClick={() => startEdit(p)}
                          >
                            Editar
                          </button>
                          <button
                            className="btn btn-sm btn-ghost"
                            onClick={() => handleToggleActive(p)}
                          >
                            {p.active ? 'Desactivar' : 'Activar'}
                          </button>
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() => handleDelete(p)}
                          >
                            Eliminar
                          </button>
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
    </div>
  );
}
