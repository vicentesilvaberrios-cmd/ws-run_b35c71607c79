import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentOrg } from '@/lib/org';

export async function GET(request: Request) {
  const org = await getCurrentOrg();
  if (!org) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const supabase = await createClient();

  const { searchParams } = new URL(request.url);
  const professionalId = searchParams.get('professionalId');

  let query = supabase
    .from('breaks')
    .select('*')
    .eq('org_id', org.id);

  if (professionalId) {
    query = query.eq('professional_id', professionalId);
  }

  const { data, error } = await query
    .order('weekday', { ascending: true })
    .order('start_time', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

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

  const { weekday, start_time, end_time, professional_id } = body as {
    weekday?: number;
    start_time?: string;
    end_time?: string;
    professional_id?: string;
  };

  if (weekday === undefined || typeof weekday !== 'number' || weekday < 0 || weekday > 6) {
    return NextResponse.json({ error: 'Día de la semana inválido (0-6)' }, { status: 400 });
  }
  if (!start_time || typeof start_time !== 'string') {
    return NextResponse.json({ error: 'Hora de inicio obligatoria' }, { status: 400 });
  }
  if (!end_time || typeof end_time !== 'string') {
    return NextResponse.json({ error: 'Hora de fin obligatoria' }, { status: 400 });
  }
  if (!professional_id || typeof professional_id !== 'string') {
    return NextResponse.json({ error: 'Profesional obligatorio' }, { status: 400 });
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('breaks')
    .insert({
      org_id: org.id,
      weekday,
      start_time,
      end_time,
      professional_id,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
