'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

/**
 * Server Action: Register a new business owner.
 * Creates the auth user with business_name in metadata; the DB trigger
 * handle_new_user creates the organization + admin membership.
 */
export async function register(formData: FormData) {
  const email = String(formData.get('email') || '').trim();
  const password = String(formData.get('password') || '');
  const businessName = String(formData.get('business_name') || '').trim();

  if (!email || !password || !businessName) {
    return { error: 'Todos los campos son obligatorios' };
  }
  if (password.length < 8) {
    return { error: 'La contraseña debe tener al menos 8 caracteres' };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { business_name: businessName },
    },
  });

  if (error) {
    return { error: mapSignUpError(error) };
  }

  // If email confirmation is disabled, Supabase returns a session immediately.
  // The DB trigger has already fired, so the user is logged in → go to dashboard.
  if (data.session) {
    redirect('/dashboard');
  }

  // Email confirmation is enabled → tell the user to check their inbox.
  redirect('/verify');
}

/**
 * Server Action: Login with email + password.
 */
export async function login(formData: FormData) {
  const email = String(formData.get('email') || '').trim();
  const password = String(formData.get('password') || '');

  if (!email || !password) {
    return { error: 'Email y contraseña son obligatorios' };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: mapSignInError(error) };
  }

  redirect('/dashboard');
}

/** Maps common Supabase auth error messages to Spanish. */
function mapSignInError(error: { message: string; code?: string }): string {
  const msg = error.message.toLowerCase();
  if (msg.includes('invalid login credentials')) {
    return 'El correo o la contraseña no son correctos. Revísalos e inténtalo de nuevo.';
  }
  if (msg.includes('email not confirmed')) {
    return 'Todavía no has confirmado tu correo. Revisa tu bandeja de entrada (y la carpeta de spam) y haz clic en el enlace de confirmación.';
  }
  if (msg.includes('too many requests') || msg.includes('rate limit')) {
    return 'Demasiados intentos fallidos. Espera unos minutos antes de volver a intentarlo.';
  }
  return 'No pudimos iniciar sesión. Inténtalo de nuevo.';
}

/** Maps common Supabase signUp error messages to Spanish. */
function mapSignUpError(error: { message: string; code?: string }): string {
  const msg = error.message.toLowerCase();
  if (msg.includes('already registered') || msg.includes('user already registered')) {
    return 'Ya existe una cuenta con este correo. Inicia sesión en lugar de crear una nueva.';
  }
  if (msg.includes('password') && msg.includes('weak')) {
    return 'La contraseña es demasiado débil. Usa al menos 8 caracteres con letras y números.';
  }
  if (msg.includes('rate limit') || msg.includes('too many requests')) {
    return 'Demasiados intentos. Espera unos minutos antes de volver a intentarlo.';
  }
  return 'No pudimos crear tu cuenta. Inténtalo de nuevo.';
}

/**
 * Server Action: Logout the current user.
 */
export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
