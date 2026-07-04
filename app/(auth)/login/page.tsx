'use client';

import { useState } from 'react';
import { useFormState } from 'react-dom';
import { login } from '../actions';
import Link from 'next/link';

export default function LoginPage() {
  const [state, formAction, isPending] = useFormState(
    async (_prev: { error?: string } | undefined, formData: FormData) => login(formData),
    undefined
  );
  const [email, setEmail] = useState('');
  const [emailTouched, setEmailTouched] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordTouched, setPasswordTouched] = useState(false);

  const emailError = emailTouched && !email ? 'El correo es obligatorio' : '';
  const passwordError = passwordTouched && !password ? 'La contraseña es obligatoria' : '';

  return (
    <div className="container" style={{ paddingTop: 'var(--sp-8)' }}>
      <div className="card stack" style={{ maxWidth: 420, marginInline: 'auto' }}>
        <h1>Inicia sesión</h1>

        {state?.error && (
          <div className="alert alert-error" role="alert">
            {state.error}
          </div>
        )}

        <form action={formAction} className="stack" noValidate>
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
              autoComplete="current-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (passwordTouched) setPasswordTouched(false);
              }}
              onBlur={() => setPasswordTouched(true)}
              aria-invalid={!!passwordError}
              aria-describedby={passwordError ? 'password-error' : undefined}
              required
            />
            {passwordError && (
              <span id="password-error" className="error-text" role="alert">{passwordError}</span>
            )}
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={isPending}>
            {isPending ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <p className="text-sm muted" style={{ textAlign: 'center' }}>
          ¿Aún no tienes cuenta?{' '}
          <Link href="/register"><strong>Créala aquí</strong></Link>
        </p>
      </div>
    </div>
  );
}
