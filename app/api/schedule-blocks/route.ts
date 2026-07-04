import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentOrg } from '@/lib/org';

export async function GET() {
  const org = await getCurrentOrg();
  if (!org) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const supabase = await createClient();

  // Today in America/Santiago
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });

  const { data, error } = await supabase
    .from('schedule_blocks')
    .select('id, professional_id, block_date, start_time, end_time, reason, created_at, professionals(name)')
    .eq('org_id', org.id)
    .gte('block_date', today)
    .order('block_date', { ascending: true })
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

  const {
    block_date,
    end_date,
    start_time,
    end_time,
    professional_id,
    reason,
  } = body as {
    block_date?: string;
    end_date?: string;
    start_time?: string | null;
    end_time?: string | null;
    professional_id?: string | null;
    reason?: string;
  };

  if (!block_date || typeof block_date !== 'string') {
    return NextResponse.json({ error: 'Fecha obligatoria' }, { status: 400 });
  }

  // Validate time pair: both null (full day) or both present with end > start
  if ((start_time && !end_time) || (!start_time && end_time)) {
    return NextResponse.json({ error: 'Indica ambas horas o ninguna (día completo)' }, { status: 400 });
  }

  // Build list of dates (single or range)
  const dates: string[] = [];
  const start = new Date(block_date + 'T00:00:00');
  const end = end_date ? new Date(end_date + 'T00:00:00') : start;

  if (end < start) {
    return NextResponse.json({ error: 'La fecha final no puede ser anterior a la inicial' }, { status: 400 });
  }

  const cur = new Date(start);
  while (cur <= end) {
    dates.push(cur.toISOString().split('T')[0]);
    cur.setDate(cur.getDate() + 1);
  }

  const rows = dates.map((d) => ({
    org_id: org.id,
    professional_id: professional_id || null,
    block_date: d,
    start_time: start_time || null,
    end_time: end_time || null,
    reason: reason?.trim() || null,
  }));

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('schedule_blocks')
    .insert(rows)
    .select('id, block_date, start_time, end_time, professional_id, reason');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
