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
    .from('services')
    .select('*')
    .eq('org_id', org.id)
    .order('created_at', { ascending: true });

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

  const { name, duration_min, price, is_active } = body as {
    name?: string;
    duration_min?: number;
    price?: number;
    is_active?: boolean;
  };

  // Validate
  if (!name || typeof name !== 'string' || name.trim() === '') {
    return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 });
  }
  if (!duration_min || typeof duration_min !== 'number' || duration_min <= 0) {
    return NextResponse.json({ error: 'La duración debe ser mayor a 0' }, { status: 400 });
  }
  if (price !== undefined && (typeof price !== 'number' || price < 0)) {
    return NextResponse.json({ error: 'El precio debe ser un número positivo' }, { status: 400 });
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('services')
    .insert({
      org_id: org.id,
      name: name.trim(),
      duration_min: Math.floor(duration_min),
      price: price ?? 0,
      is_active: is_active ?? true,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
