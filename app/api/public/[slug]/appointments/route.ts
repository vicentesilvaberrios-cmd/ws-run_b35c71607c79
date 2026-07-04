import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendConfirmationEmail } from '@/lib/email';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  let body: Record<string, unknown>;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Cuerpo de la petición inválido' },
      { status: 400 }
    );
  }

  const { serviceId, starts_at, customer_name, customer_phone, customer_email, professionalId } = body as {
    serviceId?: string;
    starts_at?: string;
    customer_name?: string;
    customer_phone?: string;
    customer_email?: string;
    professionalId?: string;
  };

  // Validate required fields
  if (!serviceId || !starts_at || !customer_name || !customer_phone || !customer_email) {
    return NextResponse.json(
      { error: 'Todos los campos son obligatorios' },
      { status: 400 }
    );
  }

  // Validate email format
  if (!/^.+@.+\..+$/.test(customer_email)) {
    return NextResponse.json(
      { error: 'Email inválido' },
      { status: 400 }
    );
  }

  // Validate starts_at is a valid ISO date
  const startDate = new Date(starts_at);
  if (isNaN(startDate.getTime())) {
    return NextResponse.json(
      { error: 'Fecha de inicio inválida' },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  const { data, error } = await supabase.rpc('create_appointment', {
    p_slug: slug,
    p_service_id: serviceId,
    p_starts_at: starts_at,
    p_name: customer_name,
    p_phone: customer_phone,
    p_email: customer_email,
    p_professional_id: professionalId || null,
  });

  if (error) {
    const msg = error.message;

    // Slot already taken or not available
    if (msg.includes('Slot') || msg.includes('ya reservado') || msg.includes('no disponible')) {
      return NextResponse.json(
        { error: 'El horario seleccionado ya no está disponible' },
        { status: 409 }
      );
    }

    return NextResponse.json({ error: msg }, { status: 400 });
  }

  // Enviar email de confirmación (degradación con gracia)
  let email_sent = true;
  try {
    const { data: org } = await supabase
      .from('organizations')
      .select('name')
      .eq('slug', slug)
      .single();

    const { data: service } = await supabase
      .from('services')
      .select('name')
      .eq('id', serviceId)
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
      businessName: org?.name ?? 'Negocio',
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
