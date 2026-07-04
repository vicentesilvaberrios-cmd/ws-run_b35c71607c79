import { BookingWizard } from './BookingWizard';
import { createClient } from '@/lib/supabase/server';

export default async function BookPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  // Nombre del negocio para el render inicial. Se consulta Supabase DIRECTAMENTE
  // (sin auto-fetch HTTP a la propia app, que en producción no conoce su URL).
  let orgName: string | null = null;
  let loadError = false;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('public_services', { p_slug: slug });
    if (error) {
      loadError = true;
    } else if (Array.isArray(data) && data.length > 0) {
      orgName = data[0].org_name ?? null;
    }
  } catch {
    loadError = true;
  }

  return (
    <div className="container" style={{ paddingTop: 'var(--sp-6)', paddingBottom: 'var(--sp-8)' }}>
      <BookingWizard slug={slug} initialOrgName={orgName} initialError={loadError} />
    </div>
  );
}
