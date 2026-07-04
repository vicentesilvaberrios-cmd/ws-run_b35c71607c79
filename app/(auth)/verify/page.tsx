import Link from 'next/link';

export default function VerifyPage() {
  return (
    <div className="container" style={{ paddingTop: 'var(--sp-8)' }}>
      <div className="card stack" style={{ maxWidth: 420, marginInline: 'auto' }}>
        <h1>Revisa tu correo</h1>
        <p>
          Te enviamos un enlace de confirmación a tu correo electrónico.
          Haz clic en ese enlace para activar tu cuenta y empezar a usar la plataforma.
        </p>
        <p className="text-sm muted">
          ¿No llegó? Revisa la carpeta de spam o correo no deseado. El enlace expira en un tiempo.
        </p>
        <div className="cluster">
          <Link href="/login" className="btn btn-primary">Ir a iniciar sesión</Link>
        </div>
      </div>
    </div>
  );
}
