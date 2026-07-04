import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentOrg } from '@/lib/org';
import { sendConfirmationEmail } from '@/lib/email';

export async function GET(request: Request) {
  const org = await getCurrentOrg();
  if (!org) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');

  if (!date) {
    return NextResponse.json(
      { error: 'El parámetro date es obligatorio (YYYY-MM-DD)' },
      { status: 400 }
    );
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: 'Formato de fecha inválido (usar YYYY-MM-DD)' },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  const startOfDay = `${date}T00:00:00.000Z`;
  const endOfDay = `${date}T23:59:59.999Z`;

  const { data: appts, error } = await supabase
    .from('appointments')
    .select('id,starts_at,ends_at,customer_name,customer_phone,customer_email,status,service_id,client_id,professional_id,public_token,confirmed_at')
    .eq('org_id', org.id)
    .gte('starts_at', startOfDay)
    .lte('starts_at', endOfDay)
    .order('starts_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!appts || appts.length === 0) {
    return NextResponse.json([]);
  }

  // Fetch related services in a separate query to avoid nested-select issues
  const serviceIds = [...new Set(appts.map((a) => a.service_id))];
  const { data: services } = await supabase
    .from('services')
    .select('id,name,duration_min')
    .in('id', serviceIds);

  const serviceMap = new Map(
    (services ?? []).map((s) => [s.id, s])
  );

  // Fetch related professionals
  const profIds = [...new Set(appts.filter((a) => a.professional_id).map((a) => a.professional_id!))];
  const profMap = new Map<string, string>();
  if (profIds.length > 0) {
    const { data: profs } = await supabase
      .from('professionals')
      .select('id,name')
      .in('id', profIds);
    (profs ?? []).forEach((p) => profMap.set(p.id, p.name));
  }

  const data = appts.map((a) => ({
    ...a,
    service: serviceMap.get(a.service_id) ?? null,
    professional_name: a.professional_id ? (profMap.get(a.professional_id) ?? null) : null,
  }));

  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const org = await getCurrentOrg();
  if (!org) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 });
  }

  const { service_id, starts_at, customer_name, customer_phone, customer_email, professional_id } = body as {
    service_id?: string;
    starts_at?: string;
    customer_name?: string;
    customer_phone?: string;
    customer_email?: string;
    professional_id?: string;
  };

  if (!service_id || !starts_at || !customer_name || !customer_phone || !customer_email) {
    return NextResponse.json(
      { error: 'Todos los campos son obligatorios' },
      { status: 400 }
    );
  }

  if (!/^.+@.+\..+$/.test(customer_email)) {
    return NextResponse.json({ error: 'Email inválido' }, { status: 400 });
  }

  const startDate = new Date(starts_at);
  if (isNaN(startDate.getTime())) {
    return NextResponse.json(
      { error: 'Fecha de inicio inválida' },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  const { data, error } = await supabase.rpc('owner_create_appointment', {
    p_org_id: org.id,
    p_service_id: service_id,
    p_starts_at: starts_at,
    p_name: customer_name,
    p_phone: customer_phone,
    p_email: customer_email,
    p_professional_id: professional_id ?? null,
  });

  if (error) {
    const msg = error.message;

    if (msg.includes('Slot') || msg.includes('ya reservado')) {
      return NextResponse.json(
        { error: 'El horario seleccionado ya no está disponible' },
        { status: 409 }
      );
    }

    if (msg.includes('No autorizado')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    return NextResponse.json({ error: msg }, { status: 400 });
  }

  // Enviar email de confirmación (degradación con gracia)
  let email_sent = true;
  try {
    const { data: service } = await supabase
      .from('services')
      .select('name')
      .eq('id', service_id)
      .single();

    // Recuperar public_token de la cita recién creada
    const { data: aptRow } = await supabase
      .from('appointments')
      .select('public_token')
      .eq('id', data)
      .single();

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
    const confirmUrl = aptRow?.public_token
      ? `${siteUrl}/cita/${aptRow.public_token}`
      : undefined;

    await sendConfirmationEmail({
      to: customer_email,
      businessName: org.name,
      serviceName: service?.name ?? 'Servicio',
      startsAt: starts_at,
      confirmUrl,
    });
  } catch (err) {
    console.warn('[appointments] No se pudo enviar email de confirmación:', err);
    email_sent = false;
  }

  return NextResponse.json({ id: data, email_sent }, { status: 201 });
}
