'use client';

import { useState, useEffect } from 'react';

export interface Service {
  id: string;
  name: string;
  duration_min: number;
  price: number;
  is_active: boolean;
}

export function ServiceForm({
  service,
  onSaved,
  onCancel,
}: {
  service: Service | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [durationMin, setDurationMin] = useState('');
  const [price, setPrice] = useState('');

  const [nameTouched, setNameTouched] = useState(false);
  const [durationTouched, setDurationTouched] = useState(false);
  const [priceTouched, setPriceTouched] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (service) {
      setName(service.name);
      setDurationMin(String(service.duration_min));
      setPrice(String(service.price));
    } else {
      setName('');
      setDurationMin('');
      setPrice('');
    }
    setNameTouched(false);
    setDurationTouched(false);
    setPriceTouched(false);
    setError('');
  }, [service]);

  const nameError = nameTouched && !name.trim() ? 'El nombre es obligatorio' : '';
  const durationNum = Number(durationMin);
  const durationError =
    durationTouched && (!durationMin || isNaN(durationNum) || durationNum < 5)
      ? 'La duración debe ser de al menos 5 minutos'
      : '';
  const priceNum = Number(price);
  const priceError =
    priceTouched && (price === '' || isNaN(priceNum) || priceNum < 0)
      ? 'El precio debe ser un número positivo'
      : '';

  const isFormValid =
    name.trim() &&
    durationMin &&
    !isNaN(durationNum) &&
    durationNum >= 5 &&
    price !== '' &&
    !isNaN(priceNum) &&
    priceNum >= 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNameTouched(true);
    setDurationTouched(true);
    setPriceTouched(true);
    if (!isFormValid) return;

    setSaving(true);
    setError('');

    const payload = {
      name: name.trim(),
      duration_min: Math.floor(durationNum),
      price: priceNum,
    };

    try {
      const url = service ? `/api/services/${service.id}` : '/api/services';
      const method = service ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'No pudimos guardar el servicio.');
      }

      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos guardar el servicio.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card stack">
      <h2>{service ? `Editar ${service.name}` : 'Nuevo servicio'}</h2>

      {error && (
        <div className="alert alert-error" role="alert">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="stack" noValidate>
        <div className="field">
          <label htmlFor="svc-name">Nombre del servicio</label>
          <input
            id="svc-name"
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (nameTouched) setNameTouched(false);
            }}
            onBlur={() => setNameTouched(true)}
            aria-invalid={!!nameError}
            aria-describedby={nameError ? 'svc-name-error' : undefined}
            required
          />
          {nameError && <span id="svc-name-error" className="error-text" role="alert">{nameError}</span>}
        </div>

        <div className="field">
          <label htmlFor="svc-duration">Duración en minutos</label>
          <input
            id="svc-duration"
            type="number"
            min={5}
            step={5}
            value={durationMin}
            onChange={(e) => {
              setDurationMin(e.target.value);
              if (durationTouched) setDurationTouched(false);
            }}
            onBlur={() => setDurationTouched(true)}
            aria-invalid={!!durationError}
            aria-describedby={durationError ? 'svc-duration-error' : undefined}
            required
          />
          {durationError && <span id="svc-duration-error" className="error-text" role="alert">{durationError}</span>}
        </div>

        <div className="field">
          <label htmlFor="svc-price">Precio</label>
          <div className="cluster" style={{ gap: 'var(--sp-1)' }}>
            <span className="muted" style={{ fontWeight: 600 }}>$</span>
            <input
              id="svc-price"
              type="number"
              min={0}
              step="0.01"
              value={price}
              onChange={(e) => {
                setPrice(e.target.value);
                if (priceTouched) setPriceTouched(false);
              }}
              onBlur={() => setPriceTouched(true)}
              aria-invalid={!!priceError}
              aria-describedby={priceError ? 'svc-price-error' : undefined}
              required
            />
          </div>
          {priceError && <span id="svc-price-error" className="error-text" role="alert">{priceError}</span>}
        </div>

        <div className="cluster">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar servicio'}
          </button>
          {service && (
            <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={saving}>
              Cancelar
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
