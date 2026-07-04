# UX Guidelines — estándar de experiencia de la fábrica

Estas reglas son **obligatorias** para todo el frontend. El objetivo: experiencias
consistentes, intuitivas, responsive y accesibles, escritas para usuarios finales
(no para desarrolladores).

## 1. Lenguaje de cara al usuario (lo más importante)
- **Todo el texto visible va en español, orientado al usuario final.**
- **PROHIBIDO mostrar jerga técnica en la UI.** Nunca uses términos como:
  `CRUD`, `endpoint`, `payload`, `request`, `API`, `backend`, `query`, `schema`,
  `string`, `boolean`, `null`, `id` (como etiqueta visible), `submit`.
- Usa verbos y sustantivos del dominio:
  - en vez de "CRUD de productos" → "Gestionar productos"
  - en vez de "Crear/Editar/Eliminar registro" → "Crear", "Editar", "Eliminar" (el sustantivo del dominio)
  - en vez de "Submit" → "Guardar", "Confirmar", "Enviar"
  - en vez de "Listado" técnico → títulos claros ("Productos", "Reservas de hoy")
- Mensajes de error en lenguaje humano y accionable ("No pudimos guardar el producto. Revisa el precio."), nunca el error crudo del sistema.

## 2. Consistencia (usar el design system)
- Reutiliza SIEMPRE las clases de `app/globals.css`: `.btn`/`.btn-primary`/`.btn-danger`,
  `.card`, `.panel`, `.field`/`.input`, `.table`/`.table-wrap`, `.badge`, `.alert`,
  `.navbar`, `.kpi`, `.empty-state`, utilidades de layout (`.container`, `.grid`, `.cluster`, `.stack`).
- No inventes estilos ad-hoc ni colores hardcodeados: usa los tokens (`var(--brand)`, `var(--sp-4)`, etc.).
- Mismos patrones para acciones equivalentes en todas las pantallas (un solo estilo de botón primario, un solo patrón de formulario, un solo patrón de tabla).
- Marca/acentos: si el proyecto tiene color de marca, ajústalo SOLO vía `--brand` en `:root`; no rieguen colores sueltos.

## 3. Responsive (mobile-first)
- Diseña primero para móvil; mejora en pantallas grandes con los breakpoints del design system (640px, 960px).
- Tablas anchas SIEMPRE dentro de `.table-wrap` (scroll horizontal en móvil).
- Grids con `.grid` + `.grid-sm-2`/`.grid-md-3`/`.grid-md-4` en vez de anchos fijos.
- Objetivos táctiles ≥ 40px (los `.btn`/`.input` ya lo cumplen).

## 4. Accesibilidad
- Todo input tiene `<label>` asociado (`htmlFor`/`id`).
- Botones e íconos con texto o `aria-label`. Imágenes con `alt`.
- Errores de campo con `aria-invalid` y texto `.error-text` asociado por `aria-describedby`.
- No comunicar estados solo por color: acompaña con texto/ícono (usa `.badge-ok/-warn/-danger`).
- Contraste suficiente (los tokens ya están calibrados).

## 5. Estados de cada pantalla (no olvidar)
Toda vista que carga datos debe contemplar y mostrar:
- **Cargando** (skeleton o texto "Cargando…").
- **Vacío** con `.empty-state` y mensaje útil ("Aún no hay reservas. Crea la primera.").
- **Error** con `.alert-error` y opción de reintentar.
- **Éxito** con feedback claro tras una acción (confirmación breve).

## 6. Flujos
- Acciones destructivas (eliminar) piden confirmación explícita.
- Formularios validan en cliente y muestran errores junto al campo.
- Navegación clara y consistente vía `.navbar`; el usuario siempre sabe dónde está y cómo volver.
- Jerarquía visual: un `h1` por pantalla con título claro del dominio.
