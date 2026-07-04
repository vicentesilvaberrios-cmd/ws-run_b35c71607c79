import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const supabase = await createClient();

  const { data, error } = await supabase.rpc('public_professionals', {
    p_slug: slug,
  });

  if (error) {
    return NextResponse.json(
      { error: 'Error al obtener profesionales' },
      { status: 500 }
    );
  }

  return NextResponse.json(data);
}
