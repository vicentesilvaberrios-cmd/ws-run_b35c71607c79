import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="container stack" style={{ paddingTop: "var(--sp-8)", paddingBottom: "var(--sp-8)" }}>
      <div className="card stack" style={{ maxWidth: 560, marginInline: "auto", textAlign: "center" }}>
        <h1>Reservas online para tu negocio, sin complicaciones</h1>
        <p className="subtitle">
          Momo te permite publicar un link de reservas para que tus clientes agenden
          citas en los horarios disponibles. Tú gestionas tus servicios y tu agenda
          desde un solo panel.
        </p>
        <div className="cluster" style={{ justifyContent: "center" }}>
          <Link href="/register" className="btn btn-primary">Crear mi cuenta</Link>
          <Link href="/login" className="btn btn-ghost">Ya tengo cuenta</Link>
        </div>
      </div>
    </div>
  );
}
