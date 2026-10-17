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
- `npm run migrate` aplica las migraciones que falten, cada una en su transacción
- `npm run staff:add -- correo@ejemplo.com` da de alta a una nutricionista
- `npm run seed:demo` siembra el "Hogar demo" con datos ficticios
- `npx supabase start` · `npx supabase db reset` · `npx supabase test db` (Supabase local)

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

## Roles y permisos (fase 13)

1. **Dos roles:** _cliente_ (perfil de un hogar) y _nutricionista_ (`staff_members`), que ve
   y edita todos los hogares. `is_staff()` lo decide la base de datos, no el cliente.
2. **Nadie se asciende solo.** `staff_members` **no tiene políticas de escritura**: solo se
   entra con la `service_role`, desde `npm run staff:add`. Al tocar esa tabla, comprobar que
   sigue sin políticas de INSERT, UPDATE ni DELETE.
3. **Las escrituras de staff sobre `profiles` y `households` van por RPC `security definer`**
   (`staff_upsert_profile`, `staff_create_household`), nunca por política. La 0002 limitó la
   escritura de `profiles` a la columna `theme` con un permiso **por columna**, y ese candado
   alcanza también a la nutricionista porque también es `authenticated`. Las políticas dicen
   qué filas, no qué columnas.
4. **`plans` solo lo escribe staff.** Hasta la 0004 podía hacerlo cualquier miembro del
   hogar, incluido borrar su propia dieta.
5. **`/admin` vive fuera del gate de perfil.** La nutricionista no tiene perfil en ningún
   hogar: pasar por el selector la dejaría encerrada con la lista vacía.
6. **Al añadir una política, preferir añadir una nueva a reescribir la que ya funciona.** Las
   permisivas se suman, así que el acceso del cliente queda intacto y es más difícil romperlo
   sin querer. Solo se reescribe cuando el objetivo es **quitar** permiso.
7. **RLS deniega los UPDATE y los DELETE en silencio:** no lanza error, simplemente no
   encuentra filas que tocar. Una prueba que espere una excepción pasa sin probar nada. Hay
   que comprobar **que el dato no cambió**. Con INSERT sí hay error (violación de
   `with check`). Esta regla ya estaba escrita y aun así volví a caer al escribir las
   pruebas del registro: `throws_ok` sobre un UPDATE o un DELETE **siempre** está mal.

## Registro de cambios (fase 14)

1. **Lo escriben triggers de Postgres, no la app.** Así queda registrado también lo que
   llega tarde, cuando una mutación guardada sin cobertura se reanuda, y no hay forma de
   tocar la dieta sin dejar rastro.
2. **Es solo de añadir:** `change_log` no tiene políticas de UPDATE ni DELETE, para nadie.
3. **Los cambios de una misma transacción se agrupan por `tx_id`.** Un intercambio escribe
   sus dos celdas en una sola sentencia; agruparlos por marca de tiempo sería adivinar.
4. **Restaurar va por la RPC `restore_cell`**, no por escrituras sueltas: así es atómico
   (antes podía quedarse a medias) y el registro puede marcarlo como `restaurar`. PostgREST
   abre una transacción por petición, así que `app.change_source` no se puede fijar desde
   fuera. `src/domain/edit.ts` sigue decidiendo _qué_ deshacer; la RPC solo lo escribe.
5. Las frases las construye `src/domain/describeChange.ts`, puro y con tests. Los títulos de
   los bloques entran por un `lookup`, para que el dominio no sepa nada de Supabase.

## Sustituciones (fase 18)

1. **La app no inventa equivalencias ni cantidades.** Solo existen los grupos que define la
   nutricionista; si un alimento no está en ninguno, no se ofrece cambiarlo.
2. **Cada persona convierte SU ración.** En un plato compartido no comen lo mismo, así que
   `substituteItem` recibe una función de conversión, no una cantidad ya calculada.
3. **"Solo para mí" parte el alimento en dos**: el original se queda con la ración de los
   demás y nace uno nuevo con la mía. Cambiar lo mío nunca toca el plato del otro.
4. **Toda sustitución pasa por `forkBlock`** (copy-on-write). Guardarla con el id del bloque
   original dejaría "Restaurar original" sin destino, y el plato de la nutricionista sería
   irrecuperable.
5. **`replaces` recuerda el alimento del plan, no el paso intermedio**, y desaparece si se
   vuelve al de partida: un "arroz en lugar de arroz" no dice nada.

## Constructor y publicación (fase 16)

1. **El constructor edita en su sitio: no hay intercambio entre días** (decisión 4 de
   PLAN.md). Mover comidas es cosa del cliente; para repetir un plato está "Copiar a otros
   días", que es explícito.
2. **Todo pasa por un borrador** (`diet_drafts`, uno por hogar, solo staff). Hasta publicar,
   el cliente no ve nada.
3. **Los cambios del cliente sobreviven a la publicación**, salvo donde ella haya tocado. Lo
   decide `src/domain/carryOver.ts`, que compara por **contenido y no por id**: entre dos
   versiones de un plan los ids cambian, y comparar identidad diría que todo cambió siempre.
4. **Un cambio del cliente que no se puede arrastrar SIEMPRE se avisa**, aunque ella no haya
   tocado esa celda. Perderlo en silencio es el peor fallo posible de esta pieza.
5. **Una celda vacía es una decisión, no una fila ausente.** Leerla con `??` las confunde, y
   entonces la publicación vuelve a llenar una celda que alguien había vaciado a propósito.
6. **Publicar va en una transacción** (`publish_plan`, 0008): toca cinco tablas, y a medias
   dejaría el hogar con dos dietas vigentes o con una dieta sin plantilla. Exige lunes.
7. La traducción slug ↔ UUID **no baja a SQL**: sigue en `mappers.ts`, su único sitio.

## Biblioteca y equivalencias (fase 15)

1. **La biblioteca guarda UNA ración base por alimento**, no una por persona. Al colocar un
   bloque se reparte con el `portion_multiplier` de cada comensal (`instantiate` en
   `src/domain/library.ts`).
2. **Se redondea a cantidades que se pueden pesar**: gramos y mililitros a múltiplos de 5,
   unidades a medias. Y nunca a cero: una ración pequeña escalada hacia abajo sigue siendo
   algo, no "no comas".
3. **La medida casera no se multiplica.** "1/3 de bandeja" o "2 rebanadas" se conservan tal
   cual y se marcan para repasar si el multiplicador no es 1. Multiplicarlas sería inventar
   cantidades.
4. **Las equivalencias las define la nutricionista.** La app nunca las deduce; el seed no
   crea ninguna a propósito. El factor dice cuánto cunde cada alimento dentro del grupo.
5. **Catálogo, biblioteca y equivalencias son de la consulta, no de un hogar**: hay un
   Supabase por consulta, así que esas tablas no llevan `household_id`. Sus claves de caché
   son `consultaKeys` en `src/data/keys.ts`.
6. **Archivar, no borrar** (decisión 7 de PLAN.md): lo que está dentro de una dieta ya
   publicada no puede desaparecer sin dejar raciones sin referencia.

## Pruebas de base de datos

- `npx supabase start` levanta un Supabase local con Docker; `npx supabase db reset` aplica
  todas las migraciones desde cero (lo único que comprueba que se pueden aplicar en orden).
- `npx supabase test db` ejecuta `supabase/tests/*.test.sql` con pgTAP.
- Las pruebas de permisos se escriben **antes** que la migración y se ven fallar. Una prueba
  de seguridad que nunca ha estado en rojo no demuestra nada.
- Nada de esto toca el proyecto de producción.
- **Nunca asertar cuentas absolutas de una tabla.** Ni en pgTAP ni en los E2E: ambos corren
  contra una base que ya tiene datos (local sembrada, o el hogar de verdad). Hay que contar
  solo lo que la prueba crea, filtrando por sus claves, o comparar contra una foto previa.
  Este error ha aparecido ya tres veces y siempre igual: la prueba pasa el día que se
  escribe, con la base vacía, y falla —o peor, deja de probar nada— cuando hay datos.

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
