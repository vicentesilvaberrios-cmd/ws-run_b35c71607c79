import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const { searchParams } = new URL(request.url);
  const serviceId = searchParams.get('serviceId');
  const date = searchParams.get('date');
  const professionalId = searchParams.get('professionalId');

  if (!serviceId || !date) {
    return NextResponse.json(
      { error: 'serviceId y date son obligatorios' },
      { status: 400 }
    );
  }

  // Validate date format (YYYY-MM-DD)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: 'Formato de fecha inválido (usar YYYY-MM-DD)' },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  const { data, error } = await supabase.rpc('public_availability', {
    p_slug: slug,
    p_service_id: serviceId,
    p_date: date,
    p_professional_id: professionalId || null,
  });

  if (error) {
    return NextResponse.json(
      { error: 'Error al calcular disponibilidad' },
      { status: 500 }
    );
  }

  return NextResponse.json(data);
}
