# Plan de UX — Fix Momo (bloqueos + link + onboarding)

Solo pantallas afectadas. Patrones del design system (`app/globals.css`).
Toda copia en español, sin jerga. Mobile-first.

---

## 1. Inicio del dashboard — `app/dashboard/DashboardHomeClient.tsx`

**Objetivo para el usuario:** que el dueño (a) arranque si es nuevo, o (b) comparta su link si ya está listo. **Una sola tarjeta protagonista** arriba del home, que se reemplaza según el estado. El resto del home queda intacto.

### Layout
- Reemplazar el link simple actual por una **sección `.card` con `.stack`** que renderiza **una de dos variantes** (mutuamente excluyentes).
- Clases: `.card`, `.stack`, `.cluster`, `.steps`, `.help-tip`, `.btn`, `.btn-primary`, `.btn-ghost`, `.badge-ok`, `.alert-warn`, `.alert-info`.

### Subtítulo de propósito (siempre visible)
> "Deja tu agenda lista" — "Tres pasos para empezar a recibir reservas."

### Variante A — Onboarding (cuando `services=0` **o** `hours=incompleto`)

Render: `<ol class="steps">` con 3 ítems. Cada paso: badge circular numerado (lo da `.steps`), título, estado (`.badge-ok` "Listo" o botón directo), y `help-tip` opcional.

| # | Título | Subtítulo (texto) | Acción primaria del paso | Estado completo |
|---|--------|------------------|--------------------------|-----------------|
| 1 | Crea tu primer servicio | "Lo que ofreces y cuánto dura." | Botón "Crear servicio" → `/dashboard/servicios` | `.badge-ok` "Listo" cuando `services>0` |
| 2 | Define tu horario | "Días y horas en que atiendes." | Botón "Definir horario" → `/dashboard/horario` | `.badge-ok` "Listo" cuando hay al menos 1 día con horas |
| 3 | Comparte tu link | "Tu página de reservas lista para enviar." | Se habilita solo cuando 1 y 2 están listos; botón "Ver mi link" hace scroll a la Variante B en la misma página (mismo archivo). | `.badge-ok` "Listo" cuando `link_shared_at` no es null **o** siempre listo si 1 y 2 lo están (no obligamos compartir) |

- **Acción principal única:** el botón del primer paso incompleto (CTA destacado `.btn-primary`); el resto son `.btn-ghost` o badges.
- **Avanzado escondido:** nada que esconder; este asistente es la versión simple.
- **Guía incorporada:** el `subtitle` explica el propósito; un `.help-tip` junto al título con texto: "Esto aparece solo la primera vez. Cuando completes los tres pasos, lo reemplazaré por tu link para compartir."
- **Confirmación:** al completar el último paso, la tarjeta se transforma (sin recarga agresiva) en la Variante B con un `.alert-success` breve "¡Listo! Ya puedes compartir tu link." (3 s, luego se autosiembra).

### Variante B — "Tu link de reservas" (cuando los 3 pasos están completos)

Layout dentro de la misma `.card`, con `.stack`:

- **Encabezado:** `h2` "Tu link de reservas" + `subtitle` "Compártelo en Instagram, WhatsApp o pégalo impreso en tu local."
- **URL:** `<input class="input" readonly>` con la URL final (`NEXT_PUBLIC_SITE_URL` + `/book/<slug>`, fallback `window.location.origin` + `/book/<slug>`). Aria: `aria-label="Tu enlace público de reservas"`. Botón al lado "Copiar link" (`.btn-primary`); al pulsarlo: feedback inline "Copiado" (`.badge-ok`, 2 s) y `navigator.clipboard.writeText`. En error: `.alert-error` "No pudimos copiar. Cópialo manualmente."
- **Acciones secundarias (en `.cluster`):**
  - "Compartir por WhatsApp" (`.btn`) → abre `https://wa.me/?text=<texto>` con `texto` pre-armado: `Hola, puedes reservar tu hora aquí: <URL>`. `target="_blank" rel="noopener"`.
  - "Descargar QR" (`.btn`) → descarga `<slug>-qr.svg` (generado por `lib/qr.ts`).
- **QR:** `<img alt="Código QR de tu link de reservas">` con el SVG inline. Tamaño ~180 px en desktop, 160 px en móvil. Borde 1 px `var(--border)` y `.radius-sm`.
- **Estados:**
  - **Cargando link/QR:** skeleton `.empty-state` "Cargando tu link…"
  - **Error:** `.alert-error` "No pudimos generar tu link. Reintentar" (botón reintenta fetch).
  - **Éxito al copiar:** feedback ya descrito.

### Camino de mínimo esfuerzo (Variante B)
- **Tarea principal y costo:** ver el link → **0 clics** (visible al cargar). Copiar → **1 clic**. Compartir por WhatsApp → **1 clic**. Descargar QR → **1 clic**.
- **Defaults/presets:** link y QR pre-cargados al render (server-side si es posible; sino client en mount).
- **Acción principal única:** "Copiar link" como único `.btn-primary`; los demás son `.btn-ghost`.
- **Avanzado escondido:** ninguno (la tarjeta ya es mínima). Si se quisiera el slug editable, va detrás de un toggle "Personalizar link" (`.btn-ghost .btn-sm`) en la parte inferior de la tarjeta.
- **Pickers acotados:** ninguno en esta pantalla.
- **Guía incorporada:** `subtitle` explica para qué sirve; un `help-tip` junto al QR con texto: "Imprime este código y pégalo en tu local. Al escanearlo, el cliente abre la página de reservas."

### Responsive y a11y
- Mobile: `URL` apilada arriba, "Copiar link" full-width (`.btn-block`); "WhatsApp" y "Descargar QR" en fila (`.cluster` con wrap).
- Desktop (≥640 px): URL en fila con "Copiar link" al lado; QR centrado debajo.
- `help-tip` con `tabindex="0"` para que sea focable por teclado.
- Contraste del QR: fondo blanco, módulos negros (los QR del módulo nativo ya cumplen).

---

## 2. Horario — `app/dashboard/horario/page.tsx` (con `HoursEditor` + `ScheduleBlocks`)

**Objetivo para el usuario:** configurar horario de atención **y** bloquear fechas en un solo lugar, sin saltar de pantalla. Cambios mínimos: añadir el componente `ScheduleBlocks` **debajo** del `HoursEditor`, dentro del mismo `.stack` o como segunda `.card`.

- Sin cambios de copy ni de jerarquía del `HoursEditor`.
- Separador visual entre ambos: el `ScheduleBlocks` ya es su propia `.card`, así que el "debajo" se materializa con un `gap-4` o un `<hr>` sutil.

---

## 3. Bloquear fechas — `app/dashboard/horario/ScheduleBlocks.tsx` (nuevo, cliente)

**Objetivo para el usuario:** cerrar la agenda en días/horas puntuales (feriado, vacaciones, trámite) sin tocar el horario base. Mínimo de clics.

### Layout
- Una `.card` con `.stack`.
- Clases: `.card`, `.stack`, `.field`, `.input`, `.cluster`, `.table-wrap`, `.table`, `.badge`, `.badge-warn`, `.alert-warn`, `.alert-success`, `.help-tip`, `.empty-state`, `.btn`, `.btn-primary`, `.btn-danger`, `.btn-ghost`.

### Subtítulo de propósito (encabezado de la tarjeta)
> "Bloquear fechas" — "Cierra la agenda en feriados, vacaciones o trámites. Tus clientes no podrán reservar en esos horarios."

### Formulario (campos)
- **Fecha** (`type="date"`): default = hoy.
- **Hasta** (`type="date"`, opcional): aparece solo si el usuario marca "Es un rango de fechas" (toggle `.btn-ghost .btn-sm` "Rango / Vacaciones"). Default: oculto → bloqueo de un solo día.
- **Todo el día** (`type="checkbox"`, default **marcado**): si está activo, oculta desde/hasta.
- **Desde** / **Hasta** (`<select>` con `.input`): visibles solo si "Todo el día" está desmarcado. Opciones acotadas 07:00–20:00 en pasos de 30 min (`07:00`, `07:30`, `08:00`, …, `20:00`). Default: `09:00` / `18:00`. **Dependencia:** "Hasta" se limita a opciones **posteriores** a "Desde"; si "Desde" ≥ "Hasta", se muestra `.error-text` "La hora de término debe ser posterior a la de inicio."
- **Profesional** (`<select>`): opciones = lista de profesionales del negocio + opción fija "Todo el negocio" (default, primero, valor vacío). **Dependencia:** al elegir un profesional, la advertencia de citas afectadas cuenta solo las suyas.
- **Motivo** (`<input type="text" maxlength="80">`, opcional): placeholder "Ej. Vacaciones de invierno".

### Acción principal única
- Un solo `.btn-primary` "Bloquear fechas" al final del formulario, full-width en móvil.
- Al guardar: `.alert-success` breve "Bloqueo guardado." (2 s) y el formulario vuelve a sus defaults (fecha = hoy, "Todo el día" marcado, profesional = "Todo el negocio", motivo vacío).
- Validación: si "Es un rango" está activo y `fecha_hasta < fecha_desde` → `.error-text` "La fecha de término debe ser igual o posterior a la de inicio."

### Advertencia de citas afectadas
- Antes/después de guardar: si el rango solapa con citas `booked`, mostrar `.alert-warn` (no bloqueante): "Hay **N** cita(s) ya reservada(s) en ese horario. Las mantendremos activas; solo impediremos nuevas reservas. [Bloquear de todos modos]" (N = número). El conteo debe venir del servidor.
- **No** cancelamos nada automáticamente.

### Lista de bloqueos vigentes
- Subtítulo: "Bloqueos vigentes".
- `.table-wrap > .table` con columnas: **Fecha(s)**, **Horario**, **Aplica a**, **Motivo**, **Acción** (botón "Quitar" `.btn-danger .btn-sm`).
- "Quitar" pide confirmación inline (`window.confirm("¿Quitar este bloqueo?")`) y al confirmar muestra `.alert-success` "Bloqueo eliminado."
- **Una sola acción primaria** por fila solo si se confirma; no se mezcla con la de guardar.
- **Vacío:** `.empty-state` "Aún no tienes bloqueos. Marca una fecha arriba para comenzar."

### Tooltips (`.help-tip`)
- Junto a "Todo el día": `data-tip="Si lo dejas marcado, la agenda se cierra todo el día. Desmarca solo si quieres bloquear un tramo de horas."`
- Junto a "Profesional": `data-tip="Elige un profesional para bloquear solo su agenda. 'Todo el negocio' cierra la agenda para todos."`
- Junto a "Es un rango de fechas": `data-tip="Activa esto para vacaciones o cierres de varios días seguidos."`

### Camino de mínimo esfuerzo
- **Tarea principal y costo:** bloquear un día feriado completo → **2 clics** (abrir la sección ya cargada + "Bloquear fechas" con defaults). Bloquear un rango de horas de un día → **3 clics** (desmarcar "Todo el día", ajustar "Hasta", guardar). Bloquear vacaciones de una semana → **4 clics** (toggle "Rango", poner fecha fin, motivo opcional, guardar).
- **Defaults/presets:** fecha = hoy, "Todo el día" = marcado, profesional = "Todo el negocio", motivo = vacío → **Guardar sin tocar nada** funciona para el caso más común.
- **Acción principal única:** "Bloquear fechas" (`.btn-primary`). "Quitar" por fila es la única acción destructiva y va con `.btn-danger` + confirmación.
- **Avanzado escondido:** el campo "Motivo" es opcional y va al final, sin asterisco; el toggle "Rango" parte oculto hasta que el usuario lo activa.
- **Pickers acotados y opciones dependientes:** selects de 07:00–20:00 en pasos de 30 min; "Hasta" depende de "Desde"; "Profesional" filtra el conteo de citas; "Rango" muestra/oculta "Hasta".
- **Guía incorporada:** `subtitle` explica el propósito; tres `help-tip` en los campos no obvios; **no** se requiere `.steps` (flujo corto de un solo formulario); resumen de confirmación: "Bloqueo guardado. La agenda estará cerrada el [fecha(s)] de [desde] a [hasta] para [profesional]."

### Estados (no olvidar)
- **Cargando bloqueos:** texto "Cargando bloqueos…" dentro de la tabla o `.empty-state` neutral.
- **Error al cargar/guardar:** `.alert-error` "No pudimos guardar el bloqueo. Reintentar." (botón reintenta).
- **Éxito:** `.alert-success` "Bloqueo guardado." (autocierre 2 s).
- **Vacío inicial:** `.empty-state` como se describió.

### Responsive y a11y
- Mobile: formulario en una columna, `.btn-primary .btn-block`. Tabla con scroll horizontal (`.table-wrap`).
- Desktop (≥640 px): "Desde" y "Hasta" lado a lado con `.grid-sm-2`.
- Cada `<label htmlFor>` enlazado al `id` del input.
- Errores de campo con `aria-invalid="true"` y `aria-describedby`指向 al `.error-text`.
- Botones con texto visible (no solo íconos); "Quitar" incluye `aria-label="Quitar bloqueo del 15 de marzo"`.
- Foco visible heredado del design system; `help-tip` focable (`tabindex="0"`).

---

## 4. Utilidad QR — `lib/qr.ts` (nuevo)

**No es una pantalla**, pero nota de UX:
- API mínima: `toSvg(text: string, opts?: { size?: number; margin?: number }): string` → devuelve SVG inline (string), sin dependencias pesadas, módulos negros sobre fondo blanco.
- Tamaño recomendado por defecto: 240×240 px (se muestra a ~180 px en pantalla y se descarga a 480 px para impresión nítida).
- `alt` de la imagen: "Código QR de tu link de reservas".
- Si el texto falla (URL malformada), el componente Variante B debe mostrar `.alert-error` "No pudimos generar el código QR. Reintentar." en lugar de un QR roto.

---

## Resumen de consistencia entre pantallas
- Un solo `.btn-primary` por vista (Bloquear fechas / Copiar link).
- Mismo patrón de `subtitle` descriptivo en ambas tarjetas del dashboard.
- Mismas clases de alerta (`.alert-success` breve con autocierre, `.alert-warn` no bloqueante, `.alert-error` con reintento).
- Mismos `help-tip` con `tabindex="0"` y copy en español del dominio (feriados, vacaciones, WhatsApp, Instagram, local).
- Mobile-first: `.btn-block` en CTAs principales en móvil, `.grid-sm-2` para pares de campos en ≥640 px.
- Estados vacío/carga/error cubiertos en las tres vistas.
