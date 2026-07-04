import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentOrg } from '@/lib/org';

const MAX_NOTE_LENGTH = 1000;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const org = await getCurrentOrg();
  if (!org) {
    return NextResponse.json(
      { error: 'No tienes permiso para editar esta ficha.' },
      { status: 403 }
    );
  }

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'No pudimos guardar la nota. Inténtalo de nuevo.' },
      { status: 400 }
    );
  }

  const { note } = body as { note?: unknown };

  if (typeof note !== 'string') {
    return NextResponse.json(
      { error: 'No pudimos guardar la nota. Inténtalo de nuevo.' },
      { status: 400 }
    );
  }

  if (note.length > MAX_NOTE_LENGTH) {
    return NextResponse.json(
      { error: 'La nota no puede superar los 1.000 caracteres.' },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  // Update only the note field; RLS policy (clients_update_admin) enforces org isolation.
  // The .eq('org_id', org.id) is a secondary guard; RLS is the real boundary.
  const { data, error } = await supabase
    .from('clients')
    .update({ note })
    .eq('id', id)
    .eq('org_id', org.id)
    .select('id')
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json(
        { error: 'No encontramos esta ficha.' },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: 'No pudimos guardar la nota. Inténtalo de nuevo.' },
      { status: 500 }
    );
  }

  if (!data) {
    return NextResponse.json(
      { error: 'No encontramos esta ficha.' },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true });
}
