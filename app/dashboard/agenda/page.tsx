import { AgendaList } from './AgendaList';
import { getCurrentOrg } from '@/lib/org';

export default async function AgendaPage() {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });
  const fechaLarga = new Date().toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const org = await getCurrentOrg();
  return (
    <div className="stack">
      <h1>Agenda de hoy</h1>
      <p className="subtitle">{fechaLarga}</p>
      <AgendaList initialDate={today} slug={org?.slug ?? null} orgName={org?.name ?? null} />
    </div>
  );
}
