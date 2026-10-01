# Bocause Dieta — contexto para Claude Code

PWA para dos personas (Cristina y Andrés) que comparten casa y siguen planes nutricionales
mensuales de Bocause. Se usa sobre todo en Android, de pie en la cocina o en el súper:
pantallas pequeñas, una mano, a veces sin cobertura.

## Stack (no cambiar sin preguntar)

- Vite + React 19 + TypeScript (`strict: true`, `noUncheckedIndexedAccess: true`)
- Tailwind CSS v4 (tokens en `src/styles/tokens.css` vía `@theme`; no hardcodear colores)
- `vite-plugin-pwa` (estrategia `injectManifest`, service worker propio para Web Push)
- Estado de servidor: TanStack Query + `persistQueryClient` en IndexedDB (offline-first,
  mutaciones optimistas que se reanudan al reconectar)
- Estado de UI: Zustand (perfil activo, vista, modo intercambio, tema)
- Backend: Supabase (Postgres, Auth magic link, Realtime, Edge Functions)
- Validación: Zod. Todo dato que entra (seed, Supabase, import) pasa por `src/domain/schema.ts`
- Tests: Vitest para `src/domain/**` (lógica pura), Playwright para flujos críticos
- Drag & drop: `@dnd-kit/core` solo en el modo intercambio. Carruseles con CSS scroll-snap

## Comandos

- `npm run dev` · `npm run build` · `npm run lint` · `npm run typecheck` · `npm test`
- `npm run seed:validate` valida `data/plans/*.json` contra los esquemas Zod
- `npx supabase db push` aplica migraciones

Antes de dar una tarea por terminada: `typecheck`, `lint`, `test` y `build` en verde.

## Arquitectura

```
src/
  domain/      Lógica pura sin React ni Supabase: esquemas, resolveWeek, swap, compra, adherencia
  data/        Cliente Supabase, queries, mutations, suscripciones Realtime
  features/    Una carpeta por funcionalidad (week, checklist, swap, editor, shopping, ...)
  components/  Primitivas de UI reutilizables (Sheet, Chip, Checkbox, Toast...)
  styles/      tokens.css y estilos globales
data/plans/    Planes mensuales en JSON (fuente original, solo lectura)
```

Regla: `features/` puede importar de `domain/` y `data/`; `domain/` no importa nada del proyecto.

## Reglas del dominio (importantes)

1. **Plan mensual = plantilla de 7 días.** Cada mes llega un plan nuevo. Los planes son
   versionados; el original nunca se modifica.
2. **Franjas por persona.** Cristina: desayuno, snack, snack2, comida, cena.
   Andrés: desayuno, almuerzo, comida, cena. Pan y postre NO son franjas: son secciones
   dentro del bloque de comida o cena.
3. **Comida y cena son compartidas** (`scope: "shared"`): mismo plato, pero raciones por
   persona (`portions[profileId]`). Una persona puede no tener un alimento (p. ej. pan).
   Desayunos y snacks son individuales (`scope: <profileId>`).
4. **Intercambio por fila:** solo entre días de la misma franja y el mismo scope. El bloque
   viaja entero (platos + pan + postre). Un intercambio compartido afecta a los dos.
   Se puede intercambiar con una celda vacía (domingo), lo que mueve la comida.
5. **Flexibilidad en dos niveles:** un cambio puede aplicarse "solo esta semana"
   (`week_overrides`) o "todo el plan" (`template_cells`). Resolución:
   `override de semana ?? celda de plantilla ?? vacío`.
6. **Copy-on-write al editar:** editar un bloque crea un bloque nuevo con
   `originBlockId`; nunca se muta uno original. "Restaurar" borra overrides/copias.
7. **Permisos:** cada persona edita sus bloques individuales; ambas editan los compartidos.
   Ambas pueden VER todo (incluidos los checks de la otra).
8. **Checks por alimento**, guardados por `(profileId, fecha, franja, itemId)`. Una franja
   está completa cuando todos sus alimentos (de esa persona) están marcados.
9. **Reglas del plan:** comodín proteico obligatorio 1/día; AOVE máx. 14 cucharadas/semana
   por persona; 2 ingestas libres por semana; agua 2-3 L/día.
10. Las semanas empiezan en lunes. Zona horaria `Europe/Madrid`.

## Estilo visual (Bocause)

- Colores de marca: amarillo `#FACC15`, marino `#121E2C`, pizarra `#2F3742`, agua `#E5F2F2`.
- Tipografía: Montserrat (700/800 para títulos de franja y día, 500 para alimentos).
- Seña de identidad: las tarjetas de día alternan fondo neutro / amarillo suave como la
  tabla del PDF (martes, jueves y sábado amarillos). Etiqueta de franja = bloque marino con
  texto blanco e icono, como la columna izquierda del PDF.
- Mayúsculas SOLO en etiquetas de franja y nombres de día (identidad de marca). Los alimentos
  en minúscula con mayúscula inicial: en móvil las mayúsculas del PDF se leen mal.
- Modo claro, oscuro y "sistema". Contraste AA mínimo en ambos.
- Objetivos táctiles ≥ 44 px. Respetar `prefers-reduced-motion`.
- Textos de interfaz en español, voz activa, frases cortas ("Intercambiar", "Restaurar original").

## No hacer

- No usar `localStorage` para datos de dominio (IndexedDB vía TanStack persist).
- No añadir librerías de componentes completas (MUI, Chakra...). Primitivas propias.
- No modificar `data/plans/*.json` salvo que la tarea sea explícitamente de extracción.
- No inventar alimentos, cantidades ni equivalencias nutricionales: solo lo que dice el plan
  o lo que el usuario edita.
- No hacer commits; el humano revisa y commitea al final de cada fase.
