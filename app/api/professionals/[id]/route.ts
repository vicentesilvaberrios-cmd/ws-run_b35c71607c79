import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentOrg } from '@/lib/org';

export async function PATCH(
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

  const { name, active } = body as {
    name?: string;
    active?: boolean;
  };

  const update: Record<string, unknown> = {};
  if (name !== undefined) {
    if (typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'El nombre no puede estar vacío' }, { status: 400 });
    }
    update.name = name.trim();
  }
  if (active !== undefined) {
    update.active = active;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No hay campos para actualizar' }, { status: 400 });
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('professionals')
    .update(update)
    .eq('id', id)
    .eq('org_id', org.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: 'Profesional no encontrado' }, { status: 404 });
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
    .from('professionals')
    .delete({ count: 'exact' })
    .eq('id', id)
    .eq('org_id', org.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (count === 0) {
    return NextResponse.json({ error: 'Profesional no encontrado' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
