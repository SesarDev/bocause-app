# Bocause Dieta — contexto para Claude Code

PWA para seguir la dieta que marca la nutricionista. La unidad es el **hogar**: una o
varias personas que comparten casa, comparten comida y cena, y cada una lleva lo suyo.
Hoy el hogar es Cristina y Andrés; la v2 (ver `docs/PLAN.md`) añade el rol de
nutricionista, que gestiona varios hogares desde la misma app.

Se usa sobre todo en Android, de pie en la cocina o en el súper: pantallas pequeñas, una
mano, a veces sin cobertura.

## Decisiones de la v2 (resumen; el detalle está en `docs/PLAN.md`)

- **Una app por consulta.** Cada consulta tiene su despliegue y su Supabase. No hay tabla
  de organizaciones: lo que cambia entre clones vive en `src/config/brand.ts` y se explica
  en `docs/CLONAR.md`.
- **Dieta viva por hogar**, no plan mensual: cada publicación crea una versión nueva en
  `plans`, con `valid_from` en lunes, y cierra la anterior.
- **Los cambios del cliente sobreviven a la publicación**, salvo en las celdas que la
  nutricionista haya tocado.
- **Roles:** cliente (perfil de un hogar) y nutricionista (`staff_members`), que lo ve todo.

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
  app/         Composición de proveedores (QueryClient persistido, ThemeProvider)
  config/      brand.ts: lo que cambia al clonar la app para otra consulta
  domain/      Lógica pura sin React ni Supabase: esquemas, resolveWeek, swap, compra, adherencia
  data/        Cliente Supabase, queries, mutations, suscripciones Realtime
               scope.ts (hogar activo) y keys.ts (claves de caché)
  features/    Una carpeta por funcionalidad (week, checklist, swap, editor, shopping, ...)
  components/  Primitivas de UI reutilizables (Sheet, Chip, Checkbox, Toast...)
  stores/      Estado de interfaz con Zustand (tema, pestaña, perfil activo)
  styles/      tokens.css y estilos globales
  sw.ts        Service worker propio (injectManifest)
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

## Reglas de datos (fase 12)

Son las que evitan que lo que hoy funciona con un hogar se rompa en silencio con varios.

1. **Toda consulta filtra por hogar de forma explícita. No se confía en RLS.** RLS es la
   última defensa, no el filtro: en cuanto una nutricionista pueda ver varios hogares, una
   consulta sin filtro los mezcla sin dar ningún error. `plans`, `profiles` y
   `shopping_items` por `household_id`; `checks` y `daily_logs` por los `profile_id` del
   hogar (no tienen columna de hogar); `blocks`, `template_cells` y `week_overrides` por
   `plan_id`, que ya es más estrecho porque un plan pertenece a un solo hogar.
2. **Las claves de consulta llevan el hogar en la raíz** (`['bocause', <hogar>, ...]`), vía
   `keysFor()` en `src/data/keys.ts`. Dentro de React se usa
   `keysFor(useActiveHousehold())`, para que la consulta se rehaga al cambiar de hogar.
   Lo comprueba `src/data/keys.test.ts`.
3. **Las claves de _mutación_ NO llevan el hogar.** Identifican qué función ejecutar, no
   sobre qué datos, y son lo que permite reanudar una mutación guardada sin cobertura. Si
   llevaran el hogar, una mutación pendiente dejaría de reconocerse y no se ejecutaría.
4. **Los ids nuevos usan `crypto.randomUUID()` entero**, nunca recortado. `blocks.id` es
   clave primaria global y se escribe con `upsert`: una colisión sobrescribiría el bloque
   de otro hogar sin error.
5. **La caché de IndexedDB se separa por usuario.** Sobrevive al cambio de sesión, así que
   sin separar, quien entre después en ese móvil vería los datos del anterior. Al cerrar
   sesión se borra _antes_ de cerrarla, que es cuando todavía se sabe de quién es.
6. **Las suscripciones de Realtime llevan `filter`.** Sin él llegan los cambios de todas
   las casas: refrescos constantes y actividad ajena a la vista.

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
- **Cuidado con `text-slot`:** `tokens.css` define `--color-slot` y `--text-slot`, y Tailwind
  genera la misma clase para las dos. Gana el color, así que usar `text-slot` para el tamaño
  pinta el texto de marino (invisible sobre la etiqueta). Para el tamaño:
  `text-(length:--text-slot)`. El resto de tamaños (`text-day`, `text-dish`, `text-item`,
  `text-measure`) no chocan con ningún color.
- **`--color-danger` en oscuro se corrige en `src/styles/app.css`:** `tokens.css` no lo
  redefine para el tema oscuro y el rojo original daba 2,56:1 sobre la tarjeta, por debajo
  de AA. Al tocar colores, comprobar el contraste de los dos temas, no solo del claro.

## No hacer

- No usar `localStorage` para datos de dominio (IndexedDB vía TanStack persist).
- No cargar recursos de terceros (tipografías, scripts, CDN): la Montserrat va autoalojada
  con `@fontsource` y precacheada. Son datos de salud; nadie más tiene por qué ver quién
  abre la app ni desde dónde.
- No escribir el nombre ni los colores de la marca a mano en componentes, HTML o manifest:
  salen de `src/config/brand.ts`.
- No añadir librerías de componentes completas (MUI, Chakra...). Primitivas propias.
- No modificar `data/plans/*.json` salvo que la tarea sea explícitamente de extracción.
- No inventar alimentos, cantidades ni equivalencias nutricionales: solo lo que dice el plan
  o lo que el usuario edita.
- No hacer commits; el humano revisa y commitea al final de cada fase.
