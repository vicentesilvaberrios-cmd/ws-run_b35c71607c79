'use client';

import { useState } from 'react';
import { useFormState } from 'react-dom';
import { register } from '../actions';
import Link from 'next/link';

export default function RegisterPage() {
  const [state, formAction, isPending] = useFormState(
    async (_prev: { error?: string } | undefined, formData: FormData) => register(formData),
    undefined
  );

  const [businessName, setBusinessName] = useState('');
  const [businessNameTouched, setBusinessNameTouched] = useState(false);
  const [email, setEmail] = useState('');
  const [emailTouched, setEmailTouched] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordTouched, setPasswordTouched] = useState(false);

  const businessNameError = businessNameTouched && !businessName.trim()
    ? 'El nombre de tu negocio es obligatorio' : '';
  const emailError = emailTouched && !email.trim()
    ? 'El correo es obligatorio' : '';
  const passwordError = passwordTouched && password.length > 0 && password.length < 8
    ? 'La contraseña debe tener al menos 8 caracteres' : '';

  return (
    <div className="container" style={{ paddingTop: 'var(--sp-8)' }}>
      <div className="card stack" style={{ maxWidth: 420, marginInline: 'auto' }}>
        <h1>Crea tu cuenta y empieza</h1>

        {state?.error && (
          <div className="alert alert-error" role="alert">
            {state.error}
          </div>
        )}

        <form action={formAction} className="stack" noValidate>
          <div className="field">
            <label htmlFor="business_name">Nombre de tu negocio</label>
            <input
              id="business_name"
              name="business_name"
              type="text"
              autoComplete="organization"
              value={businessName}
              onChange={(e) => {
                setBusinessName(e.target.value);
                if (businessNameTouched) setBusinessNameTouched(false);
              }}
              onBlur={() => setBusinessNameTouched(true)}
              aria-invalid={!!businessNameError}
              aria-describedby={businessNameError ? 'business_name-error' : undefined}
              required
            />
            {businessNameError && (
              <span id="business_name-error" className="error-text" role="alert">{businessNameError}</span>
            )}
            <span className="text-sm muted">Se usará para crear tu link de reservas.</span>
          </div>

          <div className="field">
            <label htmlFor="email">Correo electrónico</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailTouched) setEmailTouched(false);
              }}
              onBlur={() => setEmailTouched(true)}
              aria-invalid={!!emailError}
              aria-describedby={emailError ? 'email-error' : undefined}
              required
            />
            {emailError && (
              <span id="email-error" className="error-text" role="alert">{emailError}</span>
            )}
          </div>

          <div className="field">
            <label htmlFor="password">Contraseña</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (passwordTouched) setPasswordTouched(false);
              }}
              onBlur={() => setPasswordTouched(true)}
              aria-invalid={!!passwordError}
              aria-describedby={passwordError ? 'password-error' : undefined}
              required
              minLength={8}
            />
            {passwordError ? (
              <span id="password-error" className="error-text" role="alert">{passwordError}</span>
            ) : (
              <span className="text-sm muted">Mínimo 8 caracteres.</span>
            )}
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={isPending}>
            {isPending ? 'Creando cuenta…' : 'Crear cuenta'}
          </button>
        </form>

        <p className="text-sm muted" style={{ textAlign: 'center' }}>
          ¿Ya tienes cuenta?{' '}
          <Link href="/login"><strong>Inicia sesión</strong></Link>
        </p>
      </div>
    </div>
  );
}
