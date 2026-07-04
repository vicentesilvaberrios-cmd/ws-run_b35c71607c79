import { createClient } from '@supabase/supabase-js';

/**
 * Cliente admin server-side con service-role key.
 * Omite RLS; usar SOLO en rutas de servidor protegidas
 * (ej. cron con CRON_SECRET). Nunca exponer al cliente.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  return createClient(url, serviceRoleKey, {
    db: { schema: process.env.SUPABASE_DB_SCHEMA || 'public' },
  });
}
