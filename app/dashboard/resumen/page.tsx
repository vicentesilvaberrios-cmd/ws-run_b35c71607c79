import { getCurrentOrg } from '@/lib/org';
import { createClient } from '@/lib/supabase/server';
import { formatTime } from '@/lib/format';

interface ResumenItem {
  id: string;
  starts_at: string;
  status: string;
  customer_name: string;
  service: { name: string } | null;
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'cancelled') return <span className="badge badge-danger">Cancelada</span>;
  if (status === 'attended') return <span className="badge badge-ok">Asistió</span>;
  if (status === 'no_show') return <span className="badge badge-warn">No asistió</span>;
  return <span className="badge badge-info">Reservada</span>;
}

export default async function ResumenPage() {
  const org = await getCurrentOrg();
  if (!org) return null;

  const supabase = await createClient();

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });
  const startOfDay = `${today}T00:00:00.000Z`;
  const endOfDay = `${today}T23:59:59.999Z`;

  const fechaLarga = new Date().toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  let items: ResumenItem[] = [];
  let loadError = false;

  try {
    const { data, error } = await supabase
      .from('appointments')
      .select('id, starts_at, status, customer_name, service:services(name)')
      .eq('org_id', org.id)
      .gte('starts_at', startOfDay)
      .lte('starts_at', endOfDay)
      .order('starts_at', { ascending: true });

    if (error) throw new Error();
    items = (data ?? []) as unknown as ResumenItem[];
  } catch {
    loadError = true;
  }

  const noShowCount = items.filter((i) => i.status === 'no_show').length;

  return (
    <div className="stack">
      <h1>Resumen de hoy</h1>
      <p className="subtitle">{fechaLarga}</p>

      {loadError ? (
        <div className="alert alert-error" role="alert">
          No pudimos cargar el resumen. Recarga la página.
        </div>
      ) : (
        <>
          <div className="grid grid-md-3">
            <div className="card kpi">
              <span className="label">Citas de hoy</span>
              <span className="value">{items.length}</span>
            </div>
            <div className="card kpi">
              <span className="label">
                No-shows {noShowCount > 0 && <span className="badge badge-warn">{noShowCount}</span>}
              </span>
              <span className="value">{noShowCount}</span>
            </div>
          </div>

          <div className="card stack">
            <h2 className="text-lg" style={{ fontWeight: 700 }}>Citas de hoy</h2>
            {items.length === 0 ? (
              <div className="empty-state">No tienes citas para hoy.</div>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <caption className="sr-only">Citas del {today}</caption>
                  <thead>
                    <tr>
                      <th scope="col">Hora</th>
                      <th scope="col">Cliente</th>
                      <th scope="col">Servicio</th>
                      <th scope="col">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id}>
                        <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {formatTime(item.starts_at)}
                        </td>
                        <td>{item.customer_name}</td>
                        <td>{item.service?.name ?? '—'}</td>
                        <td><StatusBadge status={item.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
