import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentOrg } from '@/lib/org';

const STATUS_LABELS: Record<string, string> = {
  booked: 'reservada',
  attended: 'atendida',
  no_show: 'no-show',
  cancelled: 'cancelada',
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const org = await getCurrentOrg();
  if (!org) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 });
  }

  const { status } = body as { status?: string };

  if (!status || !['attended', 'no_show', 'cancelled'].includes(status)) {
    return NextResponse.json(
      { error: 'Estado inválido (debe ser attended, no_show o cancelled)' },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  // Fetch current appointment to validate state transition
  const { data: current, error: fetchError } = await supabase
    .from('appointments')
    .select('status')
    .eq('id', id)
    .eq('org_id', org.id)
    .single();

  if (fetchError) {
    if (fetchError.code === 'PGRST116') {
      return NextResponse.json({ error: 'Cita no encontrada' }, { status: 404 });
    }
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  // Prevent invalid transitions: cancelled/attended/no_show are terminal states
  const currentStatus = current.status;
  if (currentStatus === 'cancelled' || currentStatus === 'attended' || currentStatus === 'no_show') {
    return NextResponse.json(
      { error: `No se puede cambiar el estado de una cita ${STATUS_LABELS[currentStatus] ?? currentStatus}` },
      { status: 409 }
    );
  }

  const { data, error } = await supabase
    .from('appointments')
    .update({ status })
    .eq('id', id)
    .eq('org_id', org.id)
    .select()
    .single();

  if (error) {
    // PGRST116: no row matched the query (RLS filtered it out or wrong id)
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Cita no encontrada' }, { status: 404 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
