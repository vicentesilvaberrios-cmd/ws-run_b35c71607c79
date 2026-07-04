import { CitaClient } from './CitaClient';
import { createClient } from '@/lib/supabase/server';

export default async function CitaPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  // Validate token format before hitting the DB
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
    return <CitaClient initialData={null} initialError="El enlace no es válido." token={token} />;
  }

  let cita: Record<string, unknown> | null = null;
  let loadError: string | null = null;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('public_appointment_by_token', { p_token: token });
    if (error) {
      loadError = 'No pudimos cargar tu cita. Inténtalo más tarde.';
    } else if (!data || data.length === 0) {
      loadError = 'No encontramos una cita con este enlace.';
    } else {
      cita = data[0] as Record<string, unknown>;
    }
  } catch {
    loadError = 'No pudimos cargar tu cita. Inténtalo más tarde.';
  }

  return <CitaClient initialData={cita} initialError={loadError} token={token} />;
}
