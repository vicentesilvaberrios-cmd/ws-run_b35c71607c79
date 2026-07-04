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

  const { name, duration_min, price, is_active } = body as {
    name?: string;
    duration_min?: number;
    price?: number;
    is_active?: boolean;
  };

  if (duration_min !== undefined && (typeof duration_min !== 'number' || duration_min <= 0)) {
    return NextResponse.json({ error: 'La duración debe ser mayor a 0' }, { status: 400 });
  }
  if (price !== undefined && (typeof price !== 'number' || price < 0)) {
    return NextResponse.json({ error: 'El precio debe ser un número positivo' }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if (name !== undefined) update.name = name.trim();
  if (duration_min !== undefined) update.duration_min = Math.floor(duration_min);
  if (price !== undefined) update.price = price;
  if (is_active !== undefined) update.is_active = is_active;

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('services')
    .update(update)
    .eq('id', id)
    .eq('org_id', org.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: 'Servicio no encontrado' }, { status: 404 });
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
    .from('services')
    .delete({ count: 'exact' })
    .eq('id', id)
    .eq('org_id', org.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (count === 0) {
    return NextResponse.json({ error: 'Servicio no encontrado' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
