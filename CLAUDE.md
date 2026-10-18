# Bocause Dieta

PWA para seguir la dieta de la nutricionista. Se usa en Android, con una mano y a veces sin cobertura.
La unidad es el **hogar**: varias personas que comparten comida y cena.
Roles: cliente (perfil de un hogar) y nutricionista (`staff_members`, ve y edita todos los hogares).
Se entra con **usuario y contraseña**, y el perfil lo asigna la nutricionista al crear la cuenta: nadie elige quién es.
Hay una app y un Supabase por consulta. Lo que cambia entre clones está en `src/config/brand.ts` (ver `docs/CLONAR.md`). El plan v2 está en `docs/PLAN.md`.

## Stack (no cambiar sin preguntar)

Vite · React 19 · TS (`strict`, `noUncheckedIndexedAccess`) · Tailwind v4 (tokens en `src/styles/tokens.css`) · vite-plugin-pwa `injectManifest` (`src/sw.ts`, Web Push) · TanStack Query persistido en IndexedDB (offline-first, mutaciones optimistas reanudables) · Zustand solo para UI · Supabase · Zod (todo dato entrante pasa por `src/domain/schema.ts`) · Vitest (`src/domain`) + Playwright.
Sin librería de arrastre: el intercambio va con un carrusel de scroll-snap, que con una mano funciona mejor.

## Comandos

Para terminar una tarea, todo esto debe pasar en verde: `npm run typecheck && npm run lint && npm test && npm run build`.
Otros: `npm run seed:validate | migrate | seed:demo`, `npm run user -- list|add|password|rename`, `npm run staff:add -- <usuario>`, `npx supabase start | db reset | test db`.

## Arquitectura

- `domain/`: lógica pura. No importa nada del proyecto.
- `data/`: Supabase, queries, Realtime, `scope.ts` y `keys.ts`.
- `features/`: una carpeta por funcionalidad. Importa de `domain/` y `data/`.
- `components/`: primitivas propias.
- `data/plans/*.json`: fuente original, solo lectura.

Las reglas específicas de cada carpeta están en `src/data/`, `src/domain/`, `src/features/editor/` y `supabase/` (`CLAUDE.md`).

## Dominio

- **Dieta viva:** cada publicación crea una versión en `plans` (`valid_from` en lunes) y cierra la anterior. Cada versión es una plantilla de 7 días. El original nunca se modifica.
- **Franjas del hogar actual:**
  - Cristina: desayuno, snack, snack2, comida y cena.
  - Andrés: desayuno, almuerzo, comida y cena.
  - Pan y postre no son franjas, sino secciones de comida y cena.
- **Ámbito de las comidas:**
  - Comida y cena son `scope: "shared"`, con raciones en `portions[profileId]`. Alguien puede no tener un alimento.
  - Desayunos y snacks son `scope: <profileId>`.
- **Intercambio:**
  - Solo entre días de la misma franja y el mismo scope.
  - El bloque viaja entero (platos, pan y postre).
  - Si es compartido, afecta a todos.
  - Con una celda vacía, la comida se mueve.
- **Resolución:** `week_overrides` (solo esta semana) → `template_cells` (todo el plan) → vacío.
- **Copy-on-write:**
  - Editar crea un bloque nuevo con `originBlockId`. Nunca se muta el original.
  - "Restaurar" borra los overrides y las copias.
- **Permisos:**
  - Cada persona edita sus bloques individuales.
  - Los bloques compartidos los edita cualquiera.
  - Todos lo ven todo, incluidos los checks ajenos.
- **Checks:**
  - Se guardan por alimento, en `(profileId, fecha, franja, itemId)`.
  - Una franja está completa cuando todos sus alimentos están marcados.
- **Reglas del plan:**
  - Comodín proteico: 1 al día.
  - AOVE: máximo 14 cucharadas por semana y persona.
  - 2 ingestas libres por semana.
  - Agua: 2-3 L al día.
- **Chat:** un hilo privado por persona con la nutricionista, solo de añadir y sin IA. Se puede anclar a una comida. Detrás de `brand.features.chat`.
- **Cuentas:** una cuenta, un perfil, y lo asigna la nutricionista. El usuario viaja por dentro como `usuario@brand.auth.userDomain`; ese correo **no es un buzón**, así que no hay recuperar contraseña ni avisos por correo.
- **Calendario:** la semana empieza en lunes. Zona horaria `Europe/Madrid`.
- No inventar alimentos, cantidades ni equivalencias.

## Estilo

- El nombre y los colores de la marca salen de `brand.ts` y los tokens. Nunca se escriben a mano en componentes, HTML ni manifest.
- **Tipografía:** Montserrat autoalojada (`@fontsource`). 700/800 en franjas y días, 500 en alimentos.
- **Tarjetas de día:** alternan neutro y amarillo suave (martes, jueves y sábado en amarillo).
- **Etiqueta de franja:** bloque marino con texto blanco e icono.
- **Mayúsculas:** solo en franjas y días. Los alimentos van en minúscula con inicial mayúscula.
- **Temas:** claro, oscuro y sistema. Contraste AA en los dos temas.
- **Accesibilidad:** objetivos táctiles ≥ 44 px. Respetar `prefers-reduced-motion`.
- **Textos:** en español, en voz activa y cortos.
- **Tamaño de la etiqueta de franja:** usar `text-(length:--text-slot)`, nunca `text-slot`. `text-slot` choca con `--color-slot` y pinta el texto de marino.
- **`--color-danger` en oscuro:** se corrige en `src/styles/app.css`.

## No hacer

- `localStorage` para datos de dominio.
- Recursos de terceros (CDN, fuentes, scripts): son datos de salud.
- Librerías de componentes completas.
- Tocar `data/plans/*.json`, salvo en tareas de extracción.
- Commits.
