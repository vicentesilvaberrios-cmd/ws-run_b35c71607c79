import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendReminderEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  // --- Validar CRON_SECRET antes de cualquier cosa ---
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET no configurado' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const queryToken = new URL(request.url).searchParams.get('token');

  const token = bearerToken || queryToken;
  if (token !== cronSecret) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  // --- Seleccionar citas bookadas en las próximas 24h sin recordatorio ---
  const supabase = createAdminClient();

  const { data: appointments, error: fetchError } = await supabase
    .from('appointments')
    .select(`
      id,
      customer_email,
      starts_at,
      public_token,
      services ( name ),
      organizations ( name )
    `)
    .eq('status', 'booked')
    .is('reminder_sent_at', null)
    .gte('starts_at', new Date().toISOString())
    .lte('starts_at', new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString());

  if (fetchError) {
    console.error('[send-reminders] Error al consultar citas:', fetchError);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }

  if (!appointments || appointments.length === 0) {
    return NextResponse.json({ sent: 0, message: 'No hay citas pendientes de recordatorio.' });
  }

  // --- Enviar recordatorios y marcar como enviadas ---
  let sent = 0;
  const sentIds: string[] = [];

  for (const apt of appointments) {
    const serviceName = (apt.services as { name: string }[] | null)?.[0]?.name ?? 'Servicio';
    const businessName = (apt.organizations as { name: string }[] | null)?.[0]?.name ?? 'Negocio';

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
    const confirmUrl = apt.public_token
      ? `${siteUrl}/cita/${apt.public_token}`
      : undefined;

    await sendReminderEmail({
      to: apt.customer_email,
      businessName,
      serviceName,
      startsAt: apt.starts_at,
      confirmUrl,
    });

    // Marcar como enviado para idempotencia (incluso si el email se degradó,
    // para no reintentar indefinidamente cuando falta RESEND_API_KEY)
    await supabase
      .from('appointments')
      .update({ reminder_sent_at: new Date().toISOString() })
      .eq('id', apt.id);

    sentIds.push(apt.id);
    sent++;
  }

  return NextResponse.json({ sent, ids: sentIds });
}
