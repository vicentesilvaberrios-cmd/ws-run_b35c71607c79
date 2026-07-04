import { ReactNode } from 'react';
import Link from 'next/link';
import { getCurrentOrg } from '@/lib/org';
import { logout } from '@/app/(auth)/actions';

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const org = await getCurrentOrg();

  return (
    <>
      <header className="navbar">
        <div className="cluster" style={{ gap: 'var(--sp-3)' }}>
          <Link href="/dashboard" style={{ fontWeight: 700, fontSize: 'var(--fs-lg)', color: 'var(--text)', textDecoration: 'none' }}>
            Momo
          </Link>
          {org && <span className="text-sm muted">· {org.name}</span>}
        </div>
        <nav aria-label="Panel" className="navbar-nav" style={{ display: 'flex', gap: 'var(--sp-4)', flexWrap: 'wrap' }}>
          <Link href="/dashboard" className="text-sm" style={{ fontWeight: 600 }}>Inicio</Link>
          <Link href="/dashboard/resumen" className="text-sm" style={{ fontWeight: 600 }}>Resumen</Link>
          <Link href="/dashboard/servicios" className="text-sm" style={{ fontWeight: 600 }}>Servicios</Link>
          <Link href="/dashboard/profesionales" className="text-sm" style={{ fontWeight: 600 }}>Profesionales</Link>
          <Link href="/dashboard/horario" className="text-sm" style={{ fontWeight: 600 }}>Horario</Link>
          <Link href="/dashboard/agenda" className="text-sm" style={{ fontWeight: 600 }}>Agenda</Link>
          <Link href="/dashboard/clientes" className="text-sm" style={{ fontWeight: 600 }}>Fichas</Link>
        </nav>
        <form action={logout}>
          <button type="submit" className="btn btn-sm btn-ghost">Cerrar sesión</button>
        </form>
      </header>

      <main className="container stack" style={{ paddingTop: 'var(--sp-6)', paddingBottom: 'var(--sp-8)' }}>
        {org ? children : (
          <div className="alert alert-error" role="alert">
            No pudimos cargar tu negocio. Recarga la página.
          </div>
        )}
      </main>
    </>
  );
}
