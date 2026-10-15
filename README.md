# Bocause Dieta

PWA para seguir la dieta que marca la nutricionista. La unidad es el **hogar**: hoy,
Cristina y Andrés. Pensada para móvil: cocina, súper y a veces sin cobertura.

El contexto completo del proyecto está en [CLAUDE.md](CLAUDE.md) y el plan de trabajo por
fases en [docs/PLAN.md](docs/PLAN.md).

## Estructura

```
src/app/         Composición de proveedores (TanStack Query, tema)
src/config/      brand.ts: lo que cambia al clonar la app (ver docs/CLONAR.md)
src/domain/      Lógica pura (esquemas Zod, resolución de semana, intercambios, compra)
src/data/        Cliente de Supabase, queries, caché persistida, hogar activo y claves
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

## Estado: fase 14 completada (desplegada y en uso)

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

**Fase 10** pule el MVP: esqueletos de carga en vez de un texto de "cargando", aviso de sin
conexión que no tapa el contenido, errores de red con botón de reintentar, foco atrapado
dentro de las hojas inferiores y repaso de contraste de los dos temas (todos los pares de
tokens pasan AA). Añade además pruebas de extremo a extremo con Playwright de los cuatro
flujos críticos: entrar, marcar un alimento, intercambiar y deshacer, y generar la compra.

### Pruebas de extremo a extremo

```
npm run test:e2e
```

Van **contra el Supabase real**, porque no hay un proyecto de pruebas. No entran en
`npm test` por eso. Sin `SUPABASE_SERVICE_ROLE_KEY` en `.env.local` se saltan solas.

**Esto se ha quedado corto y conviene saberlo.** Se escribieron con las tablas vacías, y
hoy el hogar tiene semanas de uso real. Dos cosas cambiaron en la fase 12:

- Cada prueba **fotografía** la tabla antes de tocarla y la restaura al terminar, también si
  falla a mitad (`fotografiar` / `restaurar` en `e2e/fixtures.ts`). No vale con borrar lo
  creado: una prueba que escribe encima de una fila existente la deja cambiada, no creada,
  y borrarla perdería el dato de verdad.
- Las comprobaciones son **relativas a esa foto**, no cuentas absolutas. Contar "hay filas
  en `checks`" dejó de probar nada en cuanto hubo checks reales: se cumplía siempre, aunque
  la escritura fallara.

Aun así, **la prueba de la compra se salta casi siempre**: generar la lista haría `upsert`
sobre las líneas reales del hogar y restaurarlas no sería fiable. Mientras la suite apunte
al Supabase de casa, ese flujo no está cubierto. Lo que toca es un proyecto de Supabase de
pruebas con su propio hogar sembrado; `docs/CLONAR.md` explica cómo se levanta uno.

**Fase 11** llena la pestaña Más: protocolos de entreno con su pre/ETT/post (también se
abren tocando el chip de entreno de cada día), las opciones del comodín con sus cantidades,
las recetas del plan con la del cheat meal, las recomendaciones como tarjetas con iconos
propios, y cerrar sesión.

**Pendiente de la fase 11:** el editor de recetas. `docs/PLAN.md` lo pide, pero las recetas
viven dentro de `plans.data`, que es inmutable, y no hay tabla donde guardar las que
escribáis vosotros. Haría falta una migración nueva. Ahora mismo las recetas son de solo
lectura y el plan solo trae una, así que el editor no tendría nada que editar todavía.

Con esto la app ya se puede usar a diario, y desde octubre de 2026 está desplegada y en uso
en los dos móviles.

**Fase 12** abre la v2 (ver el `docs/PLAN.md` nuevo): no cambia nada visible, prepara la base
para varios hogares y para clonar la app por consulta.

| Qué                                      | Por qué                                                                                                                                                   |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/data/scope.ts` y `src/data/keys.ts` | El hogar activo, y claves de caché que cuelgan de él. Antes las consultas no filtraban por hogar: funcionaba porque RLS solo devuelve el tuyo.            |
| Filtros explícitos en `queries.ts`       | RLS es la última defensa, no el filtro. Con el rol de nutricionista (fase 13), una consulta sin filtro mezclaría hogares sin dar ningún error.            |
| `filter` en cada canal de Realtime       | Sin él llegan los cambios de todas las casas: refrescos constantes y actividad ajena a la vista.                                                          |
| Caché de IndexedDB por usuario           | Sobrevive al cambio de sesión. Sin separar, quien entre después en ese móvil restauraría los datos del anterior.                                          |
| `crypto.randomUUID()` entero             | Se recortaba a 8 caracteres. `blocks.id` es clave primaria **global** y se escribe con `upsert`: una colisión sobrescribiría el bloque de otro hogar.     |
| `0003_plan_versions.sql`                 | `version`, `published_at` y `published_by` para la dieta viva. Y un trigger que mantiene `updated_at`, que solo se rellenaba al insertar (ver más abajo). |
| `src/config/brand.ts` + `docs/CLONAR.md` | Clonar la app para otra consulta es cambiar datos, no buscar cadenas por el código.                                                                       |
| Montserrat autoalojada                   | Venía de Google Fonts: un tercero veía la IP de cada móvil en cada arranque, en una app de datos de salud. Ahora va en el bundle y precacheada.           |

**Fase 13** añade el rol de nutricionista y la zona `/admin`.

| Qué                                  | Por qué                                                                                                                                                    |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `supabase/tests/rls.test.sql`        | 17 comprobaciones con pgTAP, escritas **antes** de la migración y vistas fallar. Una prueba de seguridad que nunca ha estado en rojo no demuestra nada.    |
| `0004_staff.sql`                     | `staff_members`, `is_staff()`, y las políticas de lectura y escritura. Cierra además la escritura de `plans`, que cualquier miembro del hogar podía hacer. |
| `0005_plan_version_autoassign.sql`   | Arregla un fallo de la 0003: el índice único `(household_id, version)` existía pero nadie asignaba la versión, así que publicar la segunda dieta fallaba.  |
| `npm run staff:add -- correo`        | Ascender a nutricionista. No hay forma de hacerlo desde la app: la tabla no tiene políticas de escritura.                                                  |
| React Router y `src/features/admin/` | `/admin` con carga diferida. El chunk del cliente **no** incluye ese código.                                                                               |
| `vercel.json`                        | Reescritura a `index.html`. Sin ella `/admin` daba 404 en producción aunque funcionara en desarrollo.                                                      |
| `npm run seed:demo`                  | Hogar de demostración con datos ficticios, para enseñar la app sin exponer la dieta de nadie.                                                              |

**Fase 14** añade el registro de cambios, en Más → "Historial de cambios": quién movió qué y
cuándo, en frases legibles («Andrés intercambió la comida del lunes y del martes»), agrupado
por día, con "Restaurar original".

| Qué                            | Por qué                                                                                                                                              |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `0006_change_log.sql`          | Lo escriben **triggers de Postgres**, no la app: así se registra también lo que llega tarde al reanudarse una mutación sin cobertura, y nada escapa. |
| `tx_id`                        | Un intercambio escribe sus dos celdas en una sentencia. Agrupar por transacción es exacto; por marca de tiempo sería adivinar.                       |
| RPC `restore_cell`             | Restaurar era varias peticiones sueltas y podía quedarse a medias. Ahora es atómico, y además el registro puede marcarlo como `restaurar`.           |
| `src/domain/describeChange.ts` | Las frases, puras y con 16 tests. Los títulos entran por un `lookup`, así el dominio no sabe nada de Supabase.                                       |
| `ChangeLogList`                | Fuera de la vista Más: la ficha del hogar (fase 17) enseñará la misma lista.                                                                         |

Dos cosas que solo se vieron al mirar la pantalla con datos de verdad:

- **La mitad de los intercambios reales no se detectaban.** Si una de las dos celdas no
  tenía cambio previo, su fila es un `INSERT` y el `before` es nulo, así que ese lado del
  cruce no se puede comprobar. Ahora basta con que encajen los cruces que **sí** se conocen,
  y si no se conoce ninguno se dice "cambió 2 comidas", que es menos vistoso y cierto.
- **Los E2E le inventaban cambios al hogar.** El registro es de solo añadir, así que los
  intercambios de las pruebas se quedaban en vuestro historial como si hubieran pasado. La
  suite los borra ahora con la clave de servicio.

Tres cosas aprendidas en la fase 13, que están en [CLAUDE.md](CLAUDE.md):

- **RLS deniega los UPDATE en silencio**: no da error, simplemente no encuentra la fila. Una
  prueba que espere una excepción pasa sin comprobar nada.
- **Un permiso por columna alcanza también a la nutricionista**, porque también es
  `authenticated`. Por eso sus escrituras sobre perfiles van por función `security definer`.
- **Mejor añadir una política que reescribir la que ya funciona**: las permisivas se suman.

### Base de datos en local

```
npx supabase start      # levanta Supabase con Docker
npx supabase db reset   # aplica todas las migraciones desde cero
npx supabase test db    # pgTAP
```

`db reset` es, de momento, lo único que comprueba que las migraciones se pueden aplicar en
orden sobre una base vacía.

Dos hallazgos de la fase 12 que conviene recordar:

- **`updated_at` mentía.** Tenía `default now()`, que solo se aplica al INSERTAR, y la app
  nunca escribía esa columna: una fila modificada conservaba la fecha del primer día. Decía
  cuándo nació, no cuándo se tocó. La 0003 añade el trigger. Importa ya, porque el registro
  de cambios de la fase 14 y el "último cambio del cliente" de la 17 se apoyan en esa fecha.
- **Los E2E habían envejecido mal** con el uso real: ver la sección de pruebas.

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
- **Quién eres se lee de la sesión guardada, no con `supabase.auth.getUser()`**, que va a la
  red. Al desplegar apareció el fallo: sin cobertura, `getUser()` decía "no hay usuario",
  `useMyProfile` lo traducía a "esta persona no tiene perfil" y la app mandaba al selector de
  perfil a alguien que ya tenía el suyo, donde además no había nada que elegir. Regla
  general: **una consulta que falla no es una respuesta**, y el `Gate` de `App.tsx` ahora
  distingue los cuatro estados (cargando, pausada sin red, error y respuesta) en vez de
  tratar "sin datos" como "no tiene perfil".
