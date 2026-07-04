# Resultado.md — Momo (FIX incremental + Vista semanal)

## Resumen

Aplicación Next.js 14 (App Router) + TypeScript + Supabase para gestión de reservas online multi-tenant. Este run preserva toda la funcionalidad existente y agrega la **vista de calendario semanal** en la agenda del dueño, junto con un endpoint de appointments que soporta consultas por rango de fechas (`from`/`to`).

---

## Stack real (verificado en archivos)

- **Next.js 14.2** (App Router) + **TypeScript 5.6**
- **Supabase** (`@supabase/ssr` + `@supabase/supabase-js`) con RLS y multi-tenant vía `org_id`
- **Resend** para emails server-side (confirmación y recordatorio)
- **qrcode** (librería local, sin servicios externos) para generar QR del link de reservas
- Zona horaria **America/Santiago**, formato **24h**, precios en **CLP**, tono **tuteo** en toda la UI
- Middleware de auth que protege `/dashboard/*` y APIs internas; deja públicas `/book/[slug]`, `/cita/[token]` y `/api/public/*`

---

## Módulos construidos

### 1. Autenticación y multi-tenant

- **Server Actions** (`app/(auth)/actions.ts`): `register`, `login`, `logout` con mapeo de errores Supabase a español (tuteo).
- Páginas de `/login`, `/register`, `/verify`.
- `lib/org.ts`: obtiene la organización del usuario vía `memberships` → `organizations` (RLS).
- `lib/supabase/server.ts`, `client.ts`, `admin.ts`: tres clientes Supabase (SSR cookies, browser, service-role).
- `middleware.ts`: rutas públicas vs protegidas, redirige a `/login` si no hay sesión.

### 2. Onboarding de 3 pasos (Dashboard home)

- `app/dashboard/DashboardHomeClient.tsx`: muestra onboarding con 3 pasos (crear servicio → definir horario → compartir link) cuando faltan servicios u horarios. Al completar, muestra la tarjeta **"Tu link de reservas"** con:
  - Copiar al portapapeles
  - Compartir por WhatsApp (`wa.me`)
  - QR generado localmente con `qrcode` (`lib/qr.ts`) + botón de descarga

### 3. Servicios

- `app/dashboard/servicios/`: CRUD completo (crear, editar, eliminar, pausar/activar).
- `app/api/services/route.ts` + `[id]/route.ts`.
- Precio en CLP (`formatPrice` en `lib/format.ts`), duración en minutos.

### 4. Profesionales

- `app/dashboard/profesionales/ProfessionalsManager.tsx`: agregar, editar nombre, activar/desactivar, eliminar.
- `app/api/professionals/route.ts` + `[id]/route.ts`.
- Los horarios y citas se asocian a profesionales; el constraint de no-solape es por profesional.

### 5. Horarios (modo simple y avanzado)

- `app/dashboard/horario/HoursEditor.tsx`:
  - **Modo simple**: marcar días (Lun–Dom), seleccionar tramo único (desde/hasta) y descanso opcional.
  - **Modo avanzado**: editar por día con múltiples tramos de atención y descansos, con validación de solapamientos.
  - Selector de profesional (si hay más de uno).
  - Opciones de horario 07:00–20:00 en pasos de 30 min (formato 24h).
- `app/dashboard/horario/ScheduleBlocks.tsx`: gestión de bloqueos de agenda (rango de fechas, día completo o por horas, motivo, profesional opcional). Detección de conflictos con citas existentes (`/api/schedule-blocks/conflicts`).
- APIs: `/api/business-hours`, `/api/breaks`, `/api/schedule-blocks` (con `[id]` y `/conflicts`).

### 6. Agenda del dueño — Lista + Vista Semanal (NUEVA)

- `app/dashboard/agenda/page.tsx`: página server que pasa `initialDate` y datos de la org.
- `app/dashboard/agenda/AgendaList.tsx`:
  - **Toggle Lista/Semana** persistido en `localStorage` (`agenda:view`).
  - **Vista Lista** (existente, no eliminada): selector de día, tabla de citas con badges de estado, botón "Recordar por WhatsApp" (genera `wa.me` con datos de la cita y link de confirmación), formulario de nueva cita con búsqueda de clientes existentes por teléfono (debounced), selección de servicio/profesional/horario.
  - **Vista Semanal** delegada a `WeekCalendar`.
- `app/dashboard/agenda/WeekCalendar.tsx` (NUEVA):
  - Grid de 7 columnas (Lun–Dom) × filas por hora.
  - Rango visible acotado al horario configurado del negocio (trae `/api/business-hours` y calcula min/max), con **fallback 07:00–20:00**.
  - Citas posicionadas absolutamente por día/hora, como tarjetas con nombre del cliente y servicio.
  - **Colores por estado**: Reservada (azul info), Confirmada (azul más intenso), Asistió (verde), No vino (ámbar), Cancelada (rojo tachado).
  - **Leyenda visual** con swatches de cada estado + bloqueo.
  - **Bloqueos** (`schedule_blocks`) mostrados como franjas gris achuradas (patrón diagonal `repeating-linear-gradient`) con su motivo.
  - **Navegación**: semana anterior / Hoy / semana siguiente, con rango de fechas visible (`formatRangeShort`).
  - KPIs: citas de la semana + canceladas.
  - Cálculo de semana en America/Santiago (manejo correcto de TZ con `Intl.DateTimeFormat`).
  - Click en cita abre acciones (cambiar estado: atendida/no_show/cancelada).
- `app/api/appointments/route.ts` (GET): ahora soporta `?from=YYYY-MM-DD&to=YYYY-MM-DD` para la vista semanal, además de `?date=` para la vista de un día. Devuelve citas con servicio y profesional joinados.
- `app/api/appointments/[id]/route.ts` (PATCH): cambio de estado con validación de transiciones terminales.

### 7. Reserva pública (`/book/[slug]`)

- `app/book/[slug]/page.tsx`: server component que obtiene el nombre del negocio vía RPC `public_services`.
- `app/book/[slug]/BookingWizard.tsx`: wizard de 6 pasos (Servicio → Profesional → Fecha → Horario → Datos → Confirmar).
  - Carga servicios y profesionales activos del negocio.
  - Consulta disponibilidad vía RPC `public_availability` (que excluye `schedule_blocks`).
  - Auto-salta paso de profesional si solo hay uno activo.
  - Validación de nombre, teléfono y email en cliente.
  - Página de confirmación tras reserva exitosa.
- APIs públicas: `/api/public/[slug]/services`, `/availability`, `/professionals`, `/appointments`.

### 8. Página pública de cita (`/cita/[token]`)

- `app/cita/[token]/page.tsx`: server component que valida formato UUID y carga la cita vía RPC `public_appointment_by_token`.
- `app/cita/[token]/CitaClient.tsx`: muestra datos de la cita (negocio, servicio, profesional, día, hora) con botones **Confirmar asistencia** y **Cancelar cita** (con confirmación previa). Bloquea acciones si la cita ya pasó o está cancelada.
- `app/api/public/cita/[token]/route.ts`: GET (obtener cita) + POST (`action: confirm|cancel`) vía RPCs `public_confirm_appointment` y `public_cancel_appointment`.

### 9. Fichas de clientes

- `app/dashboard/clientes/page.tsx`: lista de clientes con nombre, teléfono y email.
- `app/dashboard/clientes/[id]/page.tsx`: ficha detallada con datos de contacto, **nota interna** editable (`ClientNote.tsx`, máximo 1.000 caracteres) e **historial de citas** del cliente.
- `app/api/clients/[id]/route.ts` (PATCH nota) y `/api/clients/search/route.ts` (búsqueda por teléfono).

### 10. Recordatorios automáticos

- `app/api/cron/send-reminders/route.ts`: endpoint GET protegido con **Bearer CRON_SECRET** (o `?token=`). Selecciona citas `booked` en las próximas 24h sin `reminder_sent_at`, envía email vía Resend (`sendReminderEmail`) y marca como enviado (idempotente).
- `lib/email.ts`: `sendConfirmationEmail` y `sendReminderEmail` con degradación elegante (si no hay `RESEND_API_KEY`, no crashea).

### 11. Resumen del día

- `app/dashboard/resumen/page.tsx`: KPIs (citas de hoy, no-shows) y tabla de citas del día con badges de estado.

### 12. Formato y utilidades

- `lib/format.ts`: `formatTime` (24h, America/Santiago), `formatDate`, `formatPrice` (CLP), `normalizePhoneCL` (E.164 para WhatsApp).
- `lib/availability.ts`: cálculo client-side de slots (espejo del RPC server-side).
- `lib/qr.ts`: `getQrDataUrl` y `downloadQr` con `qrcode` local.
- `app/globals.css`: design system completo (tokens, dark mode, componentes, grid semanal con estilos `.week-*`).

---

## Archivos generados (lista real, excluyendo `node_modules/` y `.next/`)

```
app/
  (auth)/
    actions.ts
    login/page.tsx
    register/page.tsx
    verify/page.tsx
  api/
    appointments/
      route.ts
      [id]/route.ts
    breaks/
      route.ts
      [id]/route.ts
    business-hours/
      route.ts
      [id]/route.ts
    clients/
      [id]/route.ts
      search/route.ts
    cron/
      send-reminders/route.ts
    professionals/
      route.ts
      [id]/route.ts
    public/
      [slug]/
        appointments/route.ts
        availability/route.ts
        professionals/route.ts
        services/route.ts
      cita/[token]/route.ts
    schedule-blocks/
      route.ts
      [id]/route.ts
      conflicts/route.ts
    services/
      route.ts
      [id]/route.ts
  book/
    [slug]/
      BookingWizard.tsx
      confirmacion/page.tsx
      page.tsx
  cita/
    [token]/
      CitaClient.tsx
      page.tsx
  dashboard/
    agenda/
      AgendaList.tsx
      WeekCalendar.tsx       ← NUEVA
      page.tsx
    clientes/
      [id]/
        ClientNote.tsx
        page.tsx
      page.tsx
    horario/
      HoursEditor.tsx
      ScheduleBlocks.tsx
      page.tsx
    profesionales/
      ProfessionalsManager.tsx
      page.tsx
    resumen/
      page.tsx
    servicios/
      ServiceForm.tsx
      page.tsx
    DashboardHomeClient.tsx
    layout.tsx
    page.tsx
  globals.css
  layout.tsx
  page.tsx
design/
  UX_GUIDELINES.md
  UX_PLAN.md
lib/
  availability.ts
  database.types.ts
  email.ts
  format.ts
  org.ts
  qr.ts
  supabase/
    admin.ts
    client.ts
    server.ts
migrations/
  1783094826.sql              ← no-op (client search usa tabla existente)
supabase/migrations/
  0001_init.sql
  0002_appointment_management.sql
  0003_fix_timezone_availability.sql
  0004_clients.sql
  0005_appointment_reminders.sql
  0006_professionals.sql
  0007_appointment_confirmation.sql
  0008_schedule_blocks.sql
  0009_email_optional.sql     ← última migración (email opcional en owner_create_appointment)
middleware.ts
package.json
tsconfig.json
next.config.mjs
.eslintrc.json
```

---

## Migraciones

Las migraciones van de `0001` a `0009`. La última (`0009_email_optional.sql`) reliza la validación de email en `owner_create_appointment` para permitir reservas sin email (walk-in/teléfono). El archivo `migrations/1783094826.sql` es un no-op (la búsqueda de clientes usa la tabla `clients` existente con RLS). **No se crearon migraciones nuevas más allá de 0009**, cumpliendo el requisito de "solo incrementales si son imprescindibles".

---

## Cómo correrlo

```bash
npm install
npm run dev      # desarrollo
npm run build    # producción
npm start        # servidor de producción
```

**Variables de entorno necesarias:**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SITE_URL` (para links de reserva y confirmación)
- `RESEND_API_KEY` (opcional — degradación sin email)
- `RESEND_FROM` (opcional)
- `CRON_SECRET` (para `/api/cron/send-reminders`)
- `SUPABASE_DB_SCHEMA` (opcional, default `public`)

**Cron de recordatorios:**
```
GET /api/cron/send-reminders
Authorization: Bearer <CRON_SECRET>
```

---

## Criterios de aceptación CUBIERTOS

| Criterio | Estado |
|---|---|
| Reserva pública (`/book/[slug]`) | ✅ Wizard de 6 pasos |
| Página pública de cita (`/cita/[token]`) confirmar/cancelar | ✅ Con validación de UUID y estados |
| Bloqueos de agenda (`schedule_blocks`) + exclusión en `public_availability` | ✅ |
| Tarjeta "Tu link de reservas" (copiar/WhatsApp/QR local con `qrcode`) | ✅ `lib/qr.ts` |
| Onboarding de 3 pasos del dashboard | ✅ |
| Botón "Recordar por WhatsApp" | ✅ En `AgendaList` |
| Fichas de clientes (lista + detalle con nota e historial) | ✅ |
| Horarios (modo simple y avanzado) | ✅ `HoursEditor` |
| Multi-tenant/RLS | ✅ `org_id` + `is_member` en RPCs |
| Constraint de no-solape por profesional (`EXCLUDE ... WHERE status='booked'`) | ✅ En `owner_create_appointment` |
| Endpoint `/api/cron/send-reminders` (Bearer CRON_SECRET) | ✅ |
| Emails Resend server-side | ✅ Confirmación + recordatorio |
| Zona horaria America/Santiago | ✅ En `formatTime`, RPCs y cálculo de semana |
| Formato 24h | ✅ `hourCycle: 'h23'` |
| Precios CLP | ✅ `formatPrice` con `es-CL` |
| Tono tuteo en toda la app | ✅ |
| Migraciones solo incrementales (hasta 0009) | ✅ |
| **VISTA CALENDARIO SEMANAL** (columnas Lun–Dom, filas por hora, rango acotado al horario configurado con fallback 07:00–20:00) | ✅ `WeekCalendar.tsx` |
| Citas como tarjetas con nombre + servicio, colores por estado, leyenda | ✅ |
| Toggle Lista/Semana con persistencia en localStorage | ✅ `agenda:view` |
| Navegación semana anterior/hoy/siguiente con rango de fechas visible | ✅ |
| Bloqueos mostrados como franjas achuradas con motivo | ✅ `.week-block` con `repeating-linear-gradient` |
| Lista existente NO eliminada | ✅ |
| No romper funcionalidad existente | ✅ |

---

## PENDIENTES / Limitaciones reales

1. **La vista semanal no muestra profesional asignado dentro de la tarjeta de cita** — solo muestra nombre del cliente y servicio. El profesional se ve al hacer click/tooltip.
2. **Edición de citas desde la vista semanal**: el click en una cita permite cambiar estado (atendida/no_show/cancelada), pero no permite editar hora o reprogramar.
3. **Sin recordatorio por WhatsApp automático**: el botón "Recordar por WhatsApp" es manual (abre `wa.me` con mensaje pre-llenado). El cron solo envía emails, no WhatsApp automatizado.
4. **`lib/database.types.ts` es un stub** (`export {};`) — no hay tipos generados de Supabase; los clientes se usan sin tipado de esquema.
5. **QR generado en cliente** (`getQrDataUrl` usa `qrcode` en el browser) — funciona pero requiere JS habilitado.
6. **La vista semanal requiere scroll horizontal en móvil** (min-width 720px del grid) — no es totalmente responsive en pantallas pequeñas.
7. **No hay tests automatizados** en el workspace.
8. **`migrations/1783094826.sql`** es un no-op (comentario solo) — no añade lógica de migración real.

---

## Despliegue

✅ Desplegado y verificado en Railway (build OK).
