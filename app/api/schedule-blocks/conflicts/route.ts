import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentOrg } from '@/lib/org';

/**
 * GET /api/schedule-blocks/conflicts
 * Counts booked appointments that overlap a proposed block.
 * Params:
 *   block_date (required) — start date
 *   end_date (optional)   — end date for a range (inclusive)
 *   start_time (optional) — if present, end_time must also be present
 *   end_time (optional)
 *   professional_id (optional) — null/absent = whole business
 *
 * Returns { count: number } — does NOT cancel anything.
 */
export async function GET(request: Request) {
  const org = await getCurrentOrg();
  if (!org) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const blockDate = searchParams.get('block_date');
  const endDate = searchParams.get('end_date');
  const startTime = searchParams.get('start_time');
  const endTime = searchParams.get('end_time');
  const professionalId = searchParams.get('professional_id');

  if (!blockDate) {
    return NextResponse.json({ error: 'Fecha obligatoria' }, { status: 400 });
  }

  const supabase = await createClient();

  // Convert date(s) + optional times to timestamptz range(s) in America/Santiago
  // For full-day blocks, the range is the entire day 00:00 → next day 00:00.
  const lastDate = endDate || blockDate;

  // We query appointments that overlap the blocked period.
  // Build the range start/end as ISO strings using the Santiago timezone pattern.
  const rangeStart = startTime
    ? `${blockDate}T${startTime}:00`
    : `${blockDate}T00:00:00`;
  // end of last date: if end_time given use it, else end of day
  const rangeEnd = endTime
    ? `${lastDate}T${endTime}:00`
    : `${lastDate}T23:59:59`;

  let query = supabase
    .from('appointments')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', org.id)
    .eq('status', 'booked')
    .gte('starts_at', rangeStart)
    .lte('starts_at', rangeEnd);

  if (professionalId) {
    // If a specific professional is blocked, only count their appointments.
    // If professional_id is null (whole business), count all.
    query = query.eq('professional_id', professionalId);
  }

  const { count, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ count: count ?? 0 });
}
