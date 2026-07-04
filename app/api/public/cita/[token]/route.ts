import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// This route lives under /api/public/* which is allowed by middleware (no auth required).

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  let tokenUuid: string;
  try {
    tokenUuid = token;
    // Validate it looks like a UUID
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tokenUuid)) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: 'Token inválido' }, { status: 400 });
  }

  const supabase = await createClient();

  const { data, error } = await supabase.rpc('public_appointment_by_token', {
    p_token: tokenUuid,
  });

  if (error) {
    return NextResponse.json({ error: 'Error al buscar la cita' }, { status: 500 });
  }

  if (!data || data.length === 0) {
    return NextResponse.json({ error: 'La cita no existe' }, { status: 404 });
  }

  return NextResponse.json(data[0]);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 });
  }

  const action = body.action as string | undefined;

  if (action !== 'confirm' && action !== 'cancel') {
    return NextResponse.json(
      { error: "Acción inválida. Use 'confirm' o 'cancel'." },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  if (action === 'confirm') {
    const { error } = await supabase.rpc('public_confirm_appointment', {
      p_token: token,
    });

    if (error) {
      const msg = error.message;
      if (msg.includes('no encontrada') || msg.includes('no se puede confirmar')) {
        return NextResponse.json({ error: 'La cita no existe o no se puede confirmar' }, { status: 404 });
      }
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: 'Tu cita ha sido confirmada. ¡Gracias!' });
  }

  // action === 'cancel'
  const { error } = await supabase.rpc('public_cancel_appointment', {
    p_token: token,
  });

  if (error) {
    const msg = error.message;
    if (msg.includes('no existe') || msg.includes('ya fue cancelada')) {
      return NextResponse.json({ error: 'La cita no existe o ya fue cancelada' }, { status: 404 });
    }
    if (msg.includes('ya no se puede cancelar')) {
      return NextResponse.json({ error: 'La cita ya no se puede cancelar' }, { status: 409 });
    }
    if (msg.includes('ya ocurri') || msg.includes('en curso')) {
      return NextResponse.json({ error: 'No se puede cancelar una cita que ya ocurrió' }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  return NextResponse.json({ success: true, message: 'Tu cita ha sido cancelada. El horario queda libre.' });
}
