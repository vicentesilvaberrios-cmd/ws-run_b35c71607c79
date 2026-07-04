import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentOrg } from '@/lib/org';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

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

  const { weekday, start_time, end_time, professional_id } = body as {
    weekday?: number;
    start_time?: string;
    end_time?: string;
    professional_id?: string;
  };

  if (weekday !== undefined && (typeof weekday !== 'number' || weekday < 0 || weekday > 6)) {
    return NextResponse.json({ error: 'Día de la semana inválido (0-6)' }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if (weekday !== undefined) update.weekday = weekday;
  if (start_time !== undefined) update.start_time = start_time;
  if (end_time !== undefined) update.end_time = end_time;
  if (professional_id !== undefined) update.professional_id = professional_id;

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('breaks')
    .update(update)
    .eq('id', id)
    .eq('org_id', org.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: 'Descanso no encontrado' }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const org = await getCurrentOrg();
  if (!org) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const supabase = await createClient();

  const { error, count } = await supabase
    .from('breaks')
    .delete({ count: 'exact' })
    .eq('id', id)
    .eq('org_id', org.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (count === 0) {
    return NextResponse.json({ error: 'Descanso no encontrado' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
