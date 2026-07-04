import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "Momo — Agenda de reservas",
  description: "Reservas online para tu negocio, sin complicaciones.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>
        <a href="#main" className="sr-only" style={{ position: "absolute", left: -9999 }}>
          Saltar al contenido
        </a>
        <div id="main">{children}</div>
      </body>
    </html>
  );
}
