import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentOrg } from '@/lib/org';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const org = await getCurrentOrg();
  if (!org) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const supabase = await createClient();

  const { error, count } = await supabase
    .from('schedule_blocks')
    .delete({ count: 'exact' })
    .eq('id', id)
    .eq('org_id', org.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (count === 0) {
    return NextResponse.json({ error: 'Bloqueo no encontrado' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
