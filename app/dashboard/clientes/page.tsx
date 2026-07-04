import { Suspense } from 'react';
import Link from 'next/link';
import { getCurrentOrg } from '@/lib/org';
import { createClient } from '@/lib/supabase/server';

interface ClientRow {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
}

async function ClientList() {
  const org = await getCurrentOrg();
  if (!org) {
    return (
      <div className="alert alert-error" role="alert">
        No pudimos cargar tu negocio. Recarga la página.
      </div>
    );
  }

  const supabase = await createClient();

  let clients: ClientRow[] = [];
  let loadError = false;

  try {
    const { data, error } = await supabase
      .from('clients')
      .select('id, name, phone, email')
      .eq('org_id', org.id)
      .order('name', { ascending: true });

    if (error) throw new Error();
    clients = (data ?? []) as unknown as ClientRow[];
  } catch {
    loadError = true;
  }

  if (loadError) {
    return (
      <div className="alert alert-error" role="alert">
        No pudimos cargar los clientes. Inténtalo de nuevo.{' '}
        <button className="btn btn-sm btn-ghost" onClick={() => window.location.reload()}>Reintentar</button>
      </div>
    );
  }

  if (clients.length === 0) {
    return (
      <div className="empty-state">
        Aún no tienes clientes. Aparecerán aquí cuando alguien reserve por primera vez.
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th scope="col">Nombre</th>
            <th scope="col">Teléfono</th>
            <th scope="col">Email</th>
          </tr>
        </thead>
        <tbody>
          {clients.map((client) => (
            <tr key={client.id}>
              <td>
                <Link href={`/dashboard/clientes/${client.id}`} style={{ fontWeight: 600 }}>
                  {client.name}
                </Link>
              </td>
              <td>{client.phone || <span className="muted">No indicado</span>}</td>
              <td>{client.email || <span className="muted">No indicado</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function ClientesPage() {
  return (
    <div className="container stack">
      <div>
        <h1>Fichas de clientes</h1>
        <p className="subtitle muted">Personas que han reservado o han sido añadidas a tu negocio.</p>
      </div>
      <section className="card stack">
        <h2 className="title">Clientes</h2>
        <Suspense fallback={<p className="muted">Cargando…</p>}>
          <ClientList />
        </Suspense>
      </section>
    </div>
  );
}
