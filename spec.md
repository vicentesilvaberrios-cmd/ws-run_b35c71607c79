# Solicitud de cambios (modo fix)

Momo (FIX incremental). NO rompas lo existente: reserva publica (/book/[slug]), pagina publica de cita (/cita/[token] confirmar/cancelar), bloqueos de agenda (schedule_blocks y su exclusion en public_availability), tarjeta "Tu link de reservas" (copiar/WhatsApp/QR local con la libreria qrcode), onboarding de 3 pasos del dashboard, boton "Recordar por WhatsApp", fichas de clientes, horarios (modo simple y avanzado), multi-tenant/RLS, constraint de no-solape POR PROFESIONAL (EXCLUDE ... WHERE status='booked'), endpoint /api/cron/send-reminders (Bearer CRON_SECRET), emails Resend server-side, zona horaria America/Santiago, formato 24h, precios CLP, tono TUTEO en toda la app. Migraciones: SOLO incrementales nuevas (desde 0009) y solo si son imprescindibles. Agrega DOS mejoras a la AGENDA del dueno:

1) VISTA CALENDARIO SEMANAL:
- Ademas de la lista actual (no la elimines), una vista de calendario de la semana: columnas Lunes a Domingo, filas por hora (rango visible acotado al horario configurado del negocio, con fallback 07:00-20:00), citas como tarjetas posicionadas en su dia/hora con nombre del cliente y servicio, colores por estado (reservada/confirmada por el cliente/atendida/no vino/cancelada) con leyenda simple.
- Toggle claro entre "Lista" y "Semana" (recuerda la eleccion, ej. localStorage). Navegacion: semana anterior / hoy / semana siguiente, mostrando el rango de fechas visible.
- Los bloqueos (schedule_blocks) se muestran como franjas gris achuradas o similares con su motivo.
- En movil la vista semana puede degradar a scroll horizontal con .table-wrap o a vista de un dia; elige lo mas simple y usable.
- Todas las horas en 24h zona America/Santiago (usa lib/format.ts existente).

2) CITA MANUAL RAPIDA (walk-in / telefono):
- Boton "Agendar cita" visible en la agenda que abre un formulario compacto: servicio (select), profesional (select, preseleccionado si hay uno solo), fecha (hoy por defecto), hora (select de slots DISPONIBLES reales usando la disponibilidad existente, no horas libres inventadas), nombre y telefono del cliente (email opcional).
- Reutiliza la logica/endpoint existente de creacion de citas del dueno (POST /api/appointments); no dupliques validaciones de solape (el constraint ya protege; muestra el error claro si el cupo se ocupo).
- Minimo de clicks: defaults precargados, un solo boton primario "Agendar".

UX (obligatorio): TUTEO consistente, minimo de clicks, defaults, selects acotados, tooltips .help-tip donde ayude, estados vacio/carga/error, mobile-first. Alcance acotado a estas dos mejoras de la agenda.