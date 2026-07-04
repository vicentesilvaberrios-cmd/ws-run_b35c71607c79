import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentOrg } from '@/lib/org';

export async function GET() {
  const org = await getCurrentOrg();
  if (!org) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('professionals')
    .select('id,name,active,created_at')
    .eq('org_id', org.id)
    .order('name', { ascending: true });

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

  const { name, active } = body as {
    name?: string;
    active?: boolean;
  };

  if (!name || typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 });
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('professionals')
    .insert({
      org_id: org.id,
      name: name.trim(),
      active: active ?? true,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
