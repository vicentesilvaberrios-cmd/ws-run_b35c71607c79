import Link from 'next/link';
import { getCurrentOrg } from '@/lib/org';
import { createClient } from '@/lib/supabase/server';
import { ClientNote } from './ClientNote';

interface ClientDetail {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  note: string;
  created_at: string;
}

interface AppointmentRow {
  id: string;
  starts_at: string;
  status: string;
  service: { name: string } | null;
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'cancelled') return <span className="badge badge-danger">Cancelada</span>;
  if (status === 'attended') return <span className="badge badge-ok">Completada</span>;
  if (status === 'no_show') return <span className="badge badge-warn">No asistió</span>;
  if (status === 'booked') return <span className="badge badge-info">Confirmada</span>;
  return <span className="badge">Pendiente</span>;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('es-ES', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Santiago',
  });
}

export default async function ClienteFichaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const org = await getCurrentOrg();

  if (!org) {
    return (
      <div className="container stack">
        <div className="alert alert-error" role="alert">
          No encontramos esta ficha. <Link href="/dashboard/clientes" className="link">Volver a Fichas</Link>
        </div>
      </div>
    );
  }

  const supabase = await createClient();

  // Fetch client (RLS filters by org membership)
  const { data: clientData, error: clientError } = await supabase
    .from('clients')
    .select('id, name, phone, email, note, created_at')
    .eq('id', id)
    .eq('org_id', org.id)
    .single();

  if (clientError || !clientData) {
    return (
      <div className="container stack">
        <Link href="/dashboard/clientes" className="text-sm muted">← Volver a Fichas</Link>
        <div className="empty-state">
          No encontramos esta ficha. <Link href="/dashboard/clientes" className="link">Volver a Fichas</Link>
        </div>
      </div>
    );
  }

  const client = clientData as unknown as ClientDetail;

  // Fetch appointments for this client (RLS by org_id)
  const { data: aptData } = await supabase
    .from('appointments')
    .select('id, starts_at, status, service:services(name)')
    .eq('client_id', id)
    .eq('org_id', org.id)
    .order('starts_at', { ascending: true });

  const appointments = (aptData ?? []) as unknown as AppointmentRow[];

  const fechaAlta = new Date(client.created_at).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Santiago',
  });

  return (
    <div className="container stack">
      <Link href="/dashboard/clientes" className="text-sm muted">← Volver a Fichas</Link>

      <div>
        <h1>{client.name}</h1>
        <p className="subtitle muted">Cliente desde {fechaAlta}.</p>
      </div>

      {/* Datos de contacto */}
      <section className="card stack">
        <h2 className="title">Datos de contacto</h2>
        <div className="grid grid-sm-2">
          <div className="field">
            <span className="label">Teléfono</span>
            <span>{client.phone || <span className="muted">No indicado</span>}</span>
          </div>
          <div className="field">
            <span className="label">Email</span>
            <span>{client.email || <span className="muted">No indicado</span>}</span>
          </div>
        </div>
      </section>

      {/* Nota interna */}
      <section className="card stack">
        <h2 className="title">Nota interna</h2>
        <p className="muted text-sm">Información sobre el cliente. Solo la verá tu equipo.</p>
        <ClientNote initialNote={client.note} clientId={client.id} />
      </section>

      {/* Historial de citas */}
      <section className="card stack">
        <h2 className="title">Historial de citas</h2>
        {appointments.length === 0 ? (
          <div className="empty-state">Este cliente aún no tiene citas.</div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Fecha y hora</th>
                  <th scope="col">Servicio</th>
                  <th scope="col">Estado</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((apt) => (
                  <tr key={apt.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatDateTime(apt.starts_at)}</td>
                    <td>{apt.service?.name ?? '—'}</td>
                    <td><StatusBadge status={apt.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
