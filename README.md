# Bocause Dieta

PWA para seguir los planes nutricionales mensuales de Bocause entre dos personas
(Cristina y Andrés). Pensada para móvil: cocina, súper y a veces sin cobertura.

El contexto completo del proyecto está en [CLAUDE.md](CLAUDE.md) y el plan de trabajo por
fases en [docs/PLAN.md](docs/PLAN.md).

## Estructura

```
src/app/         Composición de proveedores (TanStack Query, tema)
src/domain/      Lógica pura (esquemas Zod, resolución de semana, intercambios, compra)
src/data/        Cliente de Supabase, queries y caché persistida
src/features/    Una carpeta por funcionalidad (shell, theme, week, checklist...)
src/components/  Primitivas de UI propias
src/stores/      Estado de interfaz con Zustand (tema, pestaña, perfil activo)
src/styles/      tokens.css con la paleta y tipografía de marca
src/sw.ts        Service worker propio (precaché ahora, Web Push en la fase 15)
docs/pdfs/       Planes originales en PDF (fuente de la extracción de la fase 3)
supabase/        Migraciones de Postgres
```

## Comandos

| Comando                 | Qué hace                                        |
| ----------------------- | ----------------------------------------------- |
| `npm run dev`           | Servidor de desarrollo en http://localhost:5173 |
| `npm run build`         | Compila TypeScript y genera `dist/`             |
| `npm run preview`       | Sirve el build de producción                    |
| `npm run typecheck`     | TypeScript en los tres proyectos                |
| `npm run lint`          | ESLint                                          |
| `npm run format`        | Prettier (escribe)                              |
| `npm run format:check`  | Prettier (solo comprueba)                       |
| `npm test`              | Vitest una pasada                               |
| `npm run test:watch`    | Vitest en modo vigilancia                       |
| `npm run test:coverage` | Vitest con cobertura (mínimo 90% en `domain/`)  |
| `npm run seed:validate` | Valida `data/plans/*.json` contra los esquemas  |
| `npm run seed`          | Crea el hogar en Supabase e inserta el plan     |

## Estado: fase 4 completada

**Fase 1** dejó el andamiaje: stack completo (Tailwind v4, TanStack Query con caché
persistida en IndexedDB, Zustand, Zod, Supabase, Vitest, vite-plugin-pwa), tema
claro/oscuro/sistema sin parpadeo al recargar, manifest instalable con iconos maskable y el
shell con cabecera y cuatro pestañas (Semana, Hoy, Compra, Más), todas con estado vacío.

**Fase 2** implementa toda la lógica de dominio en `src/domain/`, pura y con tests:

| Módulo         | Qué resuelve                                                  |
| -------------- | ------------------------------------------------------------- |
| `dates.ts`     | Semanas de lunes a domingo en Europe/Madrid                   |
| `resolve.ts`   | Qué come cada persona cada día: original → plantilla → semana |
| `swap.ts`      | Intercambio por fila, misma franja y mismo scope              |
| `edit.ts`      | Copia al escribir (`forkBlock`) y restauración                |
| `freeMeals.ts` | Cupo de ingestas libres por semana                            |
| `progress.ts`  | Checks por alimento, franjas completas y adherencia           |
| `shopping.ts`  | Lista de la compra sumando a las dos personas                 |
| `batch.ts`     | Sugerencias de batch cooking                                  |

**Fase 3** extrae los dos PDF a `data/plans/2026-09.json`: 42 bloques, 188 alimentos y un
catálogo de 71 entradas con su sección del súper. Las decisiones de extracción están en
[docs/extraccion-informe.md](docs/extraccion-informe.md) y se comprueban solas con
`npm run seed:validate` y con `src/domain/plan-real.test.ts`.

**Fase 4** conecta Supabase: cliente tipado, consultas y mutaciones optimistas con TanStack
Query, sincronización Realtime y las dos pantallas de entrada (magic link y "¿Quién eres?").

| Archivo                      | Qué hace                                                  |
| ---------------------------- | --------------------------------------------------------- |
| `src/data/database.types.ts` | Tipos de las tablas, escritos a partir de la migración    |
| `src/data/mappers.ts`        | Filas de Postgres ↔ tipos del dominio, validando con Zod  |
| `src/data/queries.ts`        | Lecturas y `useResolvedWeek`, el puente con la fase 5     |
| `src/data/mutations.ts`      | Escrituras optimistas que se reanudan al recuperar la red |
| `src/data/realtime.ts`       | Suscripción a las seis tablas que publica la migración    |
| `src/data/auth.ts`           | Sesión, magic link y vinculación con el perfil            |

**Fase 5** es la vista Semana y la vista Hoy, con datos reales: barra de días pegajosa con
anillo de progreso, siete tarjetas con el ritmo de colores del PDF (martes, jueves y sábado
en amarillo), etiquetas de franja marinas con icono, pan y postre como subsecciones, bloques
compartidos con su fondo y, el domingo, la tarjeta de las dos ingestas libres. El selector
de perfil permite ver el plan de la otra persona o el de "Casa", que enseña solo comida y
cena con las dos raciones y la suma para cocinar.

**Fase 6** añade el registro diario: check por alimento con la franja atenuada y marcada
"Hecho" al completarla (mantener pulsada la etiqueta marca la franja entera), avatar de
quién ya lo ha marcado en la vista Casa, y en Hoy las tarjetas de comodín proteico, aceite
con barra semanal hacia las 14 cucharadas y agua a golpe de vaso. Desde el menú de cada
franja se marca una ingesta libre, con el cupo de dos por semana.

Cada uno marca lo suyo: viendo el plan de la otra persona los checks se ven pero no se
tocan, igual que imponen las políticas de la base de datos.

**Fase 7** añade el intercambio: desde el menú de la franja se abre una hoja con un carrusel
de los siete días (scroll-snap, sin librerías), se elige destino y alcance ("Solo esta
semana" o "Todo el plan") y se confirma. Los platos compartidos avisan de que el cambio
afecta también a la otra persona. Después aparece un aviso "Intercambiado · Deshacer"
durante seis segundos, y las celdas que ya no vienen del plan original llevan el distintivo
"Modificado", con "Restaurar original" en su menú.

**Pendiente de la fase 7:** el modo de arrastrar con `@dnd-kit` en la vista Semana, que
`docs/PLAN.md` describe como alternativa al carrusel. El flujo principal está completo.

**Fase 8** es el editor de bloques, en hoja a pantalla casi completa: títulos de plato,
añadir, quitar y reordenar secciones y alimentos, autocompletado contra el catálogo de
alimentos y, en los platos compartidos, una columna por persona con "Copiar de…". Lo que
cambias se resalta mientras editas y, al guardar, nace una copia que apunta al original
(copy-on-write), aplicada a esta semana o a todo el plan. En las celdas vacías el menú
ofrece "Crear comida aquí".

**Fase 9** cierra el hito B con la lista de la compra: se genera sumando lo que comen los
dos, en los rangos "semana actual", "lo que queda" y "próxima semana", agrupada por sección
del súper en orden de recorrido. Cada línea se despliega con el desglose por persona y de
cuántos días viene. Regenerar **no pierde** lo ya marcado, "ya lo tengo" se guarda aparte de
"comprado", se pueden añadir cosas a mano y compartir la lista como texto.

Con esto la app ya se puede usar a diario. `docs/PLAN.md` sugiere desplegar aquí (fase 16) y
seguir iterando con la app en los móviles.

## Puesta en marcha

Hace falta una vez por proyecto de Supabase.

1. **Variables de entorno.** Copia `.env.example` a `.env.local` y rellena `VITE_SUPABASE_URL`
   y `VITE_SUPABASE_ANON_KEY` (Project Settings → API).
2. **Esquema.** Aplica en orden `supabase/migrations/0001_init.sql` y
   `0002_claim_profile.sql`. Lo más rápido es pegarlos en el SQL Editor del panel de
   Supabase; con la CLI sería `npx supabase db push`.
3. **Datos.** Añade a `.env.local` la clave `SUPABASE_SERVICE_ROLE_KEY` y, si queréis
   reservar cada perfil a un correo, `SEED_EMAIL_CRISTINA` y `SEED_EMAIL_ANDRES`. Luego
   `npm run seed`. Es repetible y no pisa lo que ya hayáis cambiado.
4. **Auth.** En Authentication → URL Configuration pon `http://localhost:5173` como Site URL
   y en Redirect URLs (y más adelante la URL de Vercel). El proveedor Email ya viene activo.

Después, `npm run dev`, entra con tu correo y elige perfil.

### Decisiones que conviene recordar

- **Linter**: ESLint + Prettier, como pide `docs/PLAN.md`. El template de Vite venía con
  Oxlint y se retiró.
- **El tema se guarda en `localStorage`**, no en IndexedDB, porque el script antiparpadeo de
  `index.html` tiene que leerlo de forma síncrona antes del primer pintado. Es preferencia de
  interfaz, no dato de dominio.
- **`src/domain/schema.ts` y `src/styles/tokens.css` están en `.prettierignore`**: vienen del
  kit con el formato cuidado a mano.
- **El dominio habla de "cristina" y "andres"; la base de datos, de UUIDs.** El plan sale del
  PDF con slugs y las políticas RLS comparan `scope = my_profile_id()::text`. La traducción
  vive en `src/data/mappers.ts` y es el único sitio donde se cruza esa frontera.
- **`0002_claim_profile.sql` existe porque faltaba una pieza en la migración original**: sin
  él, un usuario recién registrado no puede ni ver los perfiles para elegir el suyo.
