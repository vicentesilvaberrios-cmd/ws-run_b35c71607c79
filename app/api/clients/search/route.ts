import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentOrg } from '@/lib/org';

/**
 * GET /api/clients/search?phone=...
 * Searches for existing clients by phone (exact or partial match).
 * Returns an array of { id, name, phone, email }.
 */
export async function GET(request: Request) {
  const org = await getCurrentOrg();
  if (!org) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const phone = searchParams.get('phone');

  if (!phone || phone.trim().length < 4) {
    return NextResponse.json([]);
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('clients')
    .select('id,name,phone,email')
    .eq('org_id', org.id)
    .ilike('phone', `%${phone.trim()}%`)
    .limit(5);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
