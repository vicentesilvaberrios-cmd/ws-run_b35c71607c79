# Plan de UX — Mejoras de la Agenda (vista semanal + cita manual rápida)

> Tono: **TUTEO** consistente con el resto de la app. Cero jerga técnica en la UI.
> Stack visual: clases del design system en `app/globals.css`.

---

## Pantalla 1 — Agenda del dueño (mejorada)

**Ruta:** `app/dashboard/agenda/page.tsx`
**Objetivo para el usuario:** ver y gestionar las citas del negocio; alternar entre vista **Lista** (día a día, lo que ya existe) y vista **Semana** (calendario semanal), y poder agendar una cita manual rápida (walk-in / teléfono) en pocos clics.

### Estructura general (aplica a ambas vistas)

- Contenedor `.container` + `.stack`.
- Encabezado (ya existe en `page.tsx`): `h1` "Agenda de hoy" + subtítulo con la fecha larga. Se conserva tal cual.
- Barra de control común (movida al `AgendaList` para que aplique a Lista y Semana):
  - **Toggle de vista** (segmento pequeño con dos botones `.btn .btn-sm`, uno con `.btn-primary` activo): **"Lista"** / **"Semana"**. Persistencia en `localStorage` con clave `agenda:view` (`"list" | "week"`); al montar, leer el valor y aplicarlo.
  - **Botón primario único:** `.btn .btn-primary` con texto **"Agendar cita"** (visible siempre, junto al toggle). Abre/cierra el formulario `CreateAppointmentForm`.
  - En vista Lista: input fecha "Día" + botones rápidos **"Hoy"** / **"Mañana"** (los ya existentes).
  - En vista Semana: navegador **"Semana anterior"** / **"Hoy"** / **"Semana siguiente"** + texto con el rango visible (ej. *"15 – 21 sep 2025"*).
- KPIs (2–3 paneles `.panel .kpi`): **"Citas del día"** y **"Próxima cita"** (en Lista) o **"Citas esta semana"** y **"Canceladas"** (en Semana). Se muestran sobre la vista activa.

### Vista Lista (sin cambios funcionales)

- Tabla `.table` dentro de `.table-wrap` con columnas: Hora · Cliente · Servicio · Profesional · Estado · Acciones.
- Estados con `.badge` (Reservada, Confirmada, Asistió, No asistió, Cancelada).
- Acciones por fila: **"Confirmar"** (sólo si está Reservada), **"Marcar como asistida"** / **"No vino"**, **"Cancelar"** (con `window.confirm`), **"Recordar por WhatsApp"** (botón `.btn-ghost` `.btn-sm`, sólo si hay teléfono normalizable a `+56…`).
- Estados obligatorios: cargando ("Cargando…"), error (`.alert-error` con **"Reintentar"**), vacío (`.empty-state`: *"Aún no hay citas para este día. Pulsa **Agendar cita** para crear la primera."*).

### Vista Semana — `app/dashboard/agenda/WeekCalendar.tsx` (nuevo)

- **Subtítulo guía:** justo bajo el `h1`/toggle, texto `.muted` corto: *"Vista semanal de tu agenda. Las citas y los bloqueos se muestran en su horario."*
- **Fetch:**
  - `GET /api/appointments?from=YYYY-MM-DD&to=YYYY-MM-DD` (rango lunes–domingo de la semana visible).
  - `GET /api/schedule-blocks` (una vez al montar o al cambiar semana; filtro client-side por día).
  - `GET /api/business-hours` para obtener el rango visible (fallback `07:00`–`20:00` si no hay datos).
- **Rango horario:** de `open_time` a `close_time` en pasos de 1 hora. Filas = horas, columnas = días. Si el rango cruza mediodía, no se divide: una sola columna vertical de horas (simple y mobile-friendly).
- **Layout:** `.table-wrap` con scroll horizontal en móvil (mínimo 7 días × celdas). Dentro, `.week-grid` (CSS grid 8 columnas: 1 para etiqueta de hora + 7 para días). Cada intersección es `.week-cell` con `position: relative`.
- **Tarjetas de cita (`.week-appt`):** posicionadas absolutamente dentro de la celda, calculando `top` y `height` desde `starts_at`/`ends_at` (en minutos desde `open_time`). Contenido: **hora + nombre del cliente** y debajo el **servicio** en `.text-sm .muted`. Colores de fondo por estado (variables `--ok` / `--info` / `--warn` / `--danger` con `color-mix` para el fondo y color sólido para contraste):
  - **Reservada** → azul (`--info`).
  - **Confirmada por el cliente** → verde-azulado (también `--info` oscuro, diferenciable por icono ✓ y por tooltip).
  - **Asistió** → verde (`--ok`).
  - **No vino** → ámbar (`--warn`).
  - **Cancelada** → rojo claro tachado (`--danger`, texto tachado y opacidad reducida).
  - En hover/focus, la tarjeta muestra un `.badge` con el estado completo (no comunicar solo por color).
  - Click en la tarjeta → `window.confirm` de acciones rápidas: **"Marcar como asistida"**, **"No vino"**, **"Cancelar"** (reutiliza el endpoint `PATCH /api/appointments/:id`).
- **Bloqueos (`schedule_blocks`, `.week-block`):** franja horizontal dentro de la celda del día correspondiente, `background: repeating-linear-gradient(45deg, ...)` (estilo achurado) en gris `--text-muted`, con texto pequeño: **motivo** (truncado a ~18 chars + tooltip con el motivo completo vía `title` o `.help-tip`). Si el bloqueo cubre varias horas, se extiende visualmente por todas las filas que ocupa.
- **Leyenda (`.week-legend`):** debajo del calendario, una fila con los 5 estados (cuadradito de color + etiqueta) más **"Bloqueado"** (cuadrado achurado). Texto: *"Leyenda: Reservada · Confirmada · Asistió · No vino · Cancelada · Bloqueado"*.
- **Estados:**
  - Cargando: skeleton de 7 columnas con bandas suaves o texto "Cargando semana…".
  - Error: `.alert-error` con botón **"Reintentar"**.
  - Vacío (sin citas esa semana): `.empty-state` con mensaje *"Esta semana no tiene citas. Pulsa **Agendar cita** para crear una."*; los bloqueos sí se muestran.
- **Responsive:**
  - Móvil (<640px): `.table-wrap` con scroll horizontal nativo, sticky para la columna de horas (para no perder el eje vertical al scrollear). Celdas mínimas de 88px de ancho.
  - Tablet/escritorio: vista completa, días como columnas visibles.
- **Accesibilidad:** las tarjetas son `<button>` con `aria-label` "Cita de {cliente}, {servicio}, {hora}, {estado}". La leyenda es `<ul>` con texto para lectores. Contraste verificado para los 5 estados (texto oscuro sobre fondo claro generado con `color-mix`).

---

## Pantalla 2 — Formulario "Agendar cita" (manual, dentro de la agenda)

**Ruta:** renderizado por `app/dashboard/agenda/AgendaList.tsx` → `CreateAppointmentForm` (ya existe, se ajusta).
**Objetivo para el usuario:** registrar una cita walk-in o por teléfono en el menor tiempo posible.

### Camino de mínimo esfuerzo (secciones 7 y 8 de `UX_GUIDELINES`)

- **Tarea principal y costo en clics:** **agendar una cita nueva**. Caso típico: **2 clics** (uno abre el form, otro confirma) más escribir nombre + teléfono. Todo lo demás viene precargado.
- **Defaults/presets al abrir el form:**
  - **Fecha:** el día actualmente seleccionado en la vista Lista, o **hoy** si estás en vista Semana.
  - **Hora:** el primer slot disponible del día (auto-seleccionado al elegir servicio + profesional). Si el usuario no cambia nada y presiona **"Agendar"**, se guarda en ese horario.
  - **Profesional:** **auto-seleccionado** si hay un único profesional activo; en caso contrario el `<select>` queda en "Selecciona un profesional" (sin preselección forzada).
  - **Servicio:** sin preselección (depende de qué vino a hacer el cliente), pero al elegir uno se recarga la grilla de slots.
  - **Nombre / teléfono / email:** vacíos (es el cliente nuevo que está al teléfono o entrando al local). **Email pasa a ser opcional**: sin `required`, sin mensaje de error por estar vacío; si se ingresa, se valida formato.
- **Acción principal única:** un solo botón `.btn .btn-primary .btn-block` al final del formulario con texto **"Agendar"**. Texto del toggle en la agenda: **"Agendar cita"** (consistente).
- **Avanzado escondido:** por defecto no se muestra nada extra. El campo email, al ser opcional, queda visible pero con placeholder *"Email (opcional, para enviar confirmación)"* y un `.help-tip` con texto *"Si lo agregas, le enviaremos la confirmación por correo. No es obligatorio."*.
- **Pickers acotados y opciones dependientes:**
  - **Servicio** y **Profesional** son `<select>` con la lista de activos.
  - **Hora** es `<select>` con los slots REALES devueltos por `GET /api/public/{slug}/availability` (mismo endpoint que usa la reserva pública). NO se inventan horas: si no hay slots ese día, mostrar mensaje *"No hay horarios disponibles para este día. Prueba otro día o cambia el profesional."* con un botón **"Mañana"** que avanza la fecha un día.
  - Al cambiar Servicio o Profesional, los slots se recargan automáticamente.
  - Al cambiar la fecha, se recargan los slots.
- **Guía incorporada:**
  - Subtítulo de propósito en el formulario: *"Completa los datos del cliente para registrar su cita."*.
  - `.help-tip` junto al campo **Hora**: *"Horarios reales según la disponibilidad del profesional."*.
  - `.help-tip` junto a **Email**: *"Opcional. Si lo agregas, enviaremos la confirmación por correo."*.
  - Tras guardar correctamente, mostrar `.alert .alert-success` con resumen legible: *"Listo: agendamos a {nombre} el {fecha} a las {hora} para {servicio} con {profesional}."*. Si el envío de email falla: *"Cita guardada. No pudimos enviar el correo de confirmación; avísale al cliente directamente."* (texto ya contemplado en el código).
  - Si el backend rechaza por solape u otro motivo: `.alert .alert-error` con mensaje en lenguaje humano: *"Ese horario se acaba de ocupar. Elige otro disponible."*.

### Layout del formulario

- Contenedor `.panel` con `.stack` interno.
- Título `h2` "Nueva cita" (o "Agendar cita" si el contexto lo pide; nos quedamos con "Nueva cita" ya existente, corto y claro).
- Campos en una columna en móvil; en escritorio `.grid .grid-sm-2` para agrupar **Fecha + Hora** y **Servicio + Profesional**.
- `input type="date"` para fecha, `input type="tel"` para teléfono, `input type="text"` para nombre, `input type="email"` para email.
- Todos los inputs con `<label htmlFor>` y errores con `aria-invalid` + `<p class="error-text" id="…-error">`.
- Botones al pie en `.cluster`: **"Agendar"** (`.btn-primary .btn-block` en móvil) y **"Cancelar"** (`.btn-ghost`) alineados a la derecha en escritorio.
- Estado de envío: botón **"Agendar"** con `disabled` y texto "Agendando…" mientras `submitting === true`.

### Responsive y accesibilidad

- Móvil: campos a una columna, botón primario a ancho completo, objetivos táctiles ≥ 40px (los inputs y botones del design system ya lo cumplen).
- Teclado: orden de tabulación natural (fecha → hora → profesional → servicio → nombre → teléfono → email → agendar).
- Sin trampas de foco; tras éxito, el form se cierra y el foco vuelve al botón **"Agendar cita"**.

---

## Resumen de cambios transversales

| Elemento | Antes | Ahora |
| --- | --- | --- |
| Toggle de nueva cita | "Nueva cita" / "Cerrar" | **"Agendar cita"** (abrir) / **"Cerrar"** |
| Botón submit del form | "Agendar" | **"Agendar"** (se mantiene) |
| Email en form | obligatorio + error | **opcional**, con `.help-tip` y placeholder |
| Profesional | sin preselección | **auto-seleccionado** si hay 1 activo |
| Toggle de vista | no existía | **Lista / Semana** con persistencia en `localStorage` |
| Vista Semana | no existía | `WeekCalendar.tsx` con `.week-grid`, `.week-cell`, `.week-appt`, `.week-block`, `.week-legend` |
| `globals.css` | sin estilos de semana | nuevas clases `.week-grid`, `.week-cell`, `.week-appt`, `.week-block`, `.week-legend` (mínimas, reutilizando tokens) |

### Reglas de copy (referencia rápida para devs)

- Botones primarios de la agenda: **"Agendar cita"** (abrir), **"Agendar"** (confirmar), **"Hoy"**, **"Mañana"**, **"Semana anterior"**, **"Siguiente semana"**, **"Reintentar"**.
- Acciones sobre citas: **"Confirmar"**, **"Marcar como asistida"**, **"No vino"**, **"Cancelar"**, **"Recordar por WhatsApp"**.
- Estados: **Reservada · Confirmada · Asistió · No vino · Cancelada · Bloqueado**.
- Mensajes: siempre en 2.ª persona del singular (tuteo). Nunca mostrar `error.message` crudo: humanizar.
