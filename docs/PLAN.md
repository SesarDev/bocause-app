# Plan de acción v2 · Bocause Dieta

Este documento sustituye a la versión anterior de `docs/PLAN.md`.

## Estado

**Hecho (fases 0-11):** andamiaje y PWA, dominio con tests, extracción de los PDFs,
Supabase con RLS y Realtime, vistas Semana/Hoy/Casa, checklist y trackers, intercambio,
editor de bloques, lista de la compra, pulido, entreno, recetas y recomendaciones.

**Hecho (fases 12-19):** base para varios hogares, rol de nutricionista y zona `/admin`,
registro de cambios con triggers, catálogo + biblioteca + equivalencias, constructor de
dietas con publicación y arrastre, panel de hogares, sustituciones y chat interno.
Quedan sueltos los pendientes marcados dentro de cada fase (contenido de los bloques de
biblioteca, cambiar un bloque por otro de la biblioteca, arranque y Configuración del
constructor, Registro del panel, versiones anteriores y "Ver como cliente").

**Descartado:** el modo de arrastrar con `@dnd-kit`. El intercambio se queda con el
carrusel de scroll-snap: con una mano funciona mejor y la app se ahorra una librería.

**Objetivo de la v2:** que la nutricionista pueda crear y mantener dietas desde la app
con una biblioteca de bloques prehechos, que el cliente pueda editar la suya dejando
registro, y añadir sustituciones por equivalentes y un chat con la nutricionista.

**Fuera de alcance por ahora:** usuarios reales nuevos. Seguimos con Cristina, Andrés y
una cuenta de nutricionista de prueba. Todo lo necesario para abrirla a más gente está
al final, en el hito K, y no se empieza sin revisión legal.

## Cómo trabajar cada fase

1. Conversación nueva en Claude Code, en **modo plan** (Shift+Tab).
2. Mensaje: *"Lee CLAUDE.md y docs/PLAN.md. Vamos con la fase N. Propón el plan antes de
   escribir código."*
3. Revisa el plan, ajusta y aprueba.
4. Al terminar: `typecheck`, `lint`, `test`, `build` y `test:e2e` en verde.
5. Pídele que actualice `CLAUDE.md` con las reglas nuevas de esa fase.
6. Revisa los cambios y haz commit tú.

Si la app todavía no está desplegada en Vercel, hazlo antes de empezar (pasos de la
antigua fase 16, al final de este documento). Así cada fase se prueba en los móviles.

## Decisiones de diseño de la v2

Claude Code debe leerlas antes de cada fase.

1. **Una app por consulta.** Cada consulta tendrá su propio despliegue y su propio
   proyecto de Supabase (se clona la app). No hay tabla de organizaciones. Lo que cambia
   entre clones (nombre, colores, logo, textos legales, funciones activas) vive en un único
   archivo de configuración de marca.
2. **Dieta viva por hogar.** Un hogar tiene una dieta vigente que dura hasta que la
   nutricionista publique cambios; no es un plan mensual. Cada publicación crea una
   versión nueva en `plans` (instantánea inmutable) con `valid_from` siempre en lunes, y
   cierra la anterior con `valid_to`.
3. **Los cambios del cliente sobreviven a la publicación.** Al publicar, cada celda que la
   nutricionista no ha tocado conserva lo que tenía el cliente: bloques editados,
   intercambios de plantilla y overrides de semanas futuras. En las celdas que la
   nutricionista sí ha cambiado gana ella. Si el cliente también las había modificado, se
   lo muestra antes de publicar y puede decidir celda a celda.
4. **El constructor edita en su sitio.** La nutricionista rellena cada celda desde la
   biblioteca o a mano. No hay intercambio entre días en el constructor: solo "Copiar a
   otros días", que es explícito. El intercambio sigue existiendo en la app del cliente.
5. **Roles.** Hay *cliente* (perfil en un hogar) y *nutricionista* (tabla `staff_members`).
   Las nutricionistas ven y editan todo; todas ven a todos los clientes. El cliente edita
   su dieta como hasta ahora.
6. **Registro con triggers.** Todo cambio en `template_cells`, `week_overrides` y `blocks`
   queda en `change_log` desde Postgres, también lo que llega tras estar sin conexión. Es
   solo de añadir: nadie puede editarlo ni borrarlo.
7. **Archivar, no borrar.** Las dietas publicadas se archivan; solo los borradores se
   pueden eliminar.
8. **Biblioteca con ración base.** Un bloque de biblioteca lleva una ración base por
   alimento. Al usarlo, se instancia para cada persona aplicando su multiplicador
   (`portionMultiplier` del perfil, ajustable por celda) y redondeando.
9. **Equivalencias como datos.** Los grupos de equivalencia los define la nutricionista.
   La app nunca inventa equivalencias ni cantidades (regla ya presente en CLAUDE.md).
10. **Zona de administración separada.** Ruta `/admin` cargada de forma diferida (los
    clientes no descargan ese código), pensada para escritorio (≥1024 px), con los mismos
    tokens de diseño.
11. **Chat interno, sin IA.** Las dudas las contesta la nutricionista, no un modelo: un
    hilo privado por persona, solo de añadir (nadie puede editar ni borrar lo enviado) y
    anclable a una comida concreta. Nada sale de Supabase.

---

## Hito E · Base técnica

### Fase 12 · Preparación técnica

Nada visible para el usuario, pero deja la base lista para el resto.

```
Lee CLAUDE.md, docs/PLAN.md (decisiones de diseño) y la fase 12. Objetivo: preparar la
base para varios hogares y para clonar la app, sin cambiar el comportamiento visible.

1. Identificadores. Los ids de bloque del plan ("desayuno-0-cristina") solo son únicos
   dentro de un plan, y la tabla blocks tiene un id global. Verifica que forkBlock y
   cualquier otro bloque nuevo usan crypto.randomUUID(). Los planes nuevos usarán uuid
   como id (la columna sigue siendo text; "2026-09" sigue siendo válido). Añade a plans,
   en la migración 0003: version int, published_at, published_by.
2. Filtros explícitos. Hoy las consultas confían en que RLS solo devuelva un hogar.
   Cuando una nutricionista lo vea todo, eso mezclaría hogares. Añade filtros explícitos
   en src/data/queries.ts y src/data/realtime.ts: plans por household_id; checks y
   daily_logs por los profile_id del hogar; shopping_items por household_id; Realtime
   con filtro por plan o hogar. Incluye householdId en las query keys.
3. Caché por usuario. La clave del persister de IndexedDB debe incluir el user_id. Al
   cerrar sesión: queryClient.clear() y borrar la caché persistida.
4. Fuente autoalojada. Quita el @import de Google Fonts de tokens.css y usa
   @fontsource/montserrat (pesos 500-800, subset latin), precacheada por el service
   worker. Comprueba que en la pestaña de red no queda ninguna petición a Google.
5. Marca configurable. Crea src/config/brand.ts con appName, shortName, descripción,
   colores de marca (los de tokens.css), rutas de logo e iconos, URLs legales (vacías) y
   flags de funciones (chat: false, substitutions: true). El manifest de vite.config.ts,
   el <title> y la cabecera leen de ahí. Documenta en docs/CLONAR.md qué hay que cambiar
   para clonar la app.
6. Actualiza CLAUDE.md: describe la app como "hogares" (no "dos personas"), añade las
   decisiones de diseño de la v2 y las reglas nuevas.

Criterio de aceptación: la app funciona igual que antes; los tests unitarios y e2e
pasan; hay un test que comprueba que las query keys incluyen el hogar.
```

### Fase 13 · Rol de nutricionista y zona de administración

```
Lee CLAUDE.md y docs/PLAN.md, fase 13.

1. Tests de RLS PRIMERO. Configura pgTAP (supabase test db) en supabase/tests/ con tres
   usuarios: nutricionista, Cristina y un cliente de un "Hogar demo" con datos
   ficticios. Escribe los casos antes de la migración: la nutricionista ve y edita todo;
   Cristina ve su hogar y no ve el demo; el cliente demo no ve el vuestro; nadie salvo
   staff escribe en plans.
2. Migración 0004:
   - staff_members(user_id pk → auth.users, display_name, role 'nutricionista',
     created_at) y la función is_staff() security definer.
   - Todas las políticas de lectura pasan a: miembro del hogar OR is_staff().
   - Escritura en template_cells, week_overrides y blocks: la regla actual OR is_staff().
   - plans: escritura solo staff (hoy cualquier miembro puede: hay que cerrarlo).
   - households y profiles: alta y edición por staff (nombre, slug, claim_email,
     portionMultiplier). Añade profiles.portion_multiplier numeric default 1.
3. Script npm run staff:add -- <email> (service_role): busca el usuario de Auth por
   email (debe haber entrado una vez) y lo añade a staff_members.
4. Router. Añade React Router. La app de cliente actual queda en "/" con sus pestañas
   (Zustand) intactas. /admin/* se carga con lazy() y solo se monta si is_staff.
   Un cliente que entra en /admin ve "No tienes acceso" y un enlace a la app.
5. Shell de admin para escritorio: barra lateral (Hogares, Biblioteca, Alimentos,
   Equivalencias, Documentación, Registro) y área principal. Pantallas vacías con su
   estado vacío. Mismos tokens; tema claro y oscuro.
6. Script de seed del "Hogar demo" con dos perfiles ficticios ("Cliente A", "Cliente B")
   y una copia del plan actual. Servirá para demos sin datos reales.

Usa una cuenta distinta para la nutricionista de prueba (por ejemplo, un alias de
correo +nutri). Criterio: pgTAP en verde, el bundle del cliente no incluye /admin
(compruébalo con el informe de build).
```

### Fase 14 · Registro de cambios

```
Lee CLAUDE.md y docs/PLAN.md, fase 14.

1. Migración 0005: change_log(id, household_id, plan_id, actor_user_id, actor_role
   ('cliente'|'nutricionista'|'sistema'), table_name, op, cell jsonb {day, slot, scope,
   weekStart?}, before jsonb, after jsonb, source text, created_at). Índice
   (household_id, created_at desc).
2. Trigger AFTER INSERT/UPDATE/DELETE en template_cells, week_overrides y blocks con
   una función security definer que rellena actor desde auth.uid(). El campo source sale
   de current_setting('app.change_source', true) (valores: app, publicacion, restaurar),
   con 'app' por defecto.
3. RLS: lectura para miembros del hogar y staff; sin políticas de update ni delete.
   pgTAP: el trigger escribe; un cliente no puede borrar ni editar registros.
4. domain/describeChange.ts (puro, con tests): convierte una entrada en una frase
   legible, por ejemplo "Andrés cambió la cena del martes (solo esta semana): huevos
   rotos → pasta con boloñesa". Agrupa los cambios de un mismo intercambio.
5. UI cliente: Más → "Historial de cambios" del hogar, por días, con "Restaurar" en los
   que admiten restauración (usa domain/edit restore y source 'restaurar').
6. Componente reutilizable ChangeLogList para usarlo después en la ficha del hogar.
```

---

## Hito F · Herramientas de la nutricionista

### Fase 15 · Catálogo, biblioteca y equivalencias

```
Lee CLAUDE.md y docs/PLAN.md, fase 15.

1. Migración 0006:
   - foods(key pk, name, section, unit, batchable, keeps_days, archived). Sembrado
     desde plan.foods.
   - library_blocks(id uuid, name, slots text[], tags text[], content jsonb, notes,
     archived, created_by, updated_at).
   - equivalence_groups(id uuid, name, description, members jsonb, archived,
     updated_at).
   - RLS: lectura para cualquier miembro autenticado (el cliente las necesita para
     sustituir y para el chat); escritura solo staff.
2. Zod en src/domain/schema.ts: LibraryItem (como FoodItem pero con base: Portion en
   lugar de portions), LibrarySection, LibraryBlock, EquivalenceMember {foodKey,
   factor (positivo, por defecto 1), note?} y EquivalenceGroup.
3. Dominio puro con tests:
   - instantiate(libraryBlock, people: {profileId, multiplier}[]) → Section[] con
     portions por persona. Redondeo: gramos y ml a múltiplos de 5, unidades a 0,5; la
     medida casera se conserva tal cual y se marca como "revisar" si el multiplicador
     no es 1.
   - equivalentsFor(foodKey, portion, groups) → opciones con su cantidad calculada.
   - toLibraryBlock(block, profileId) para guardar un bloque existente en la biblioteca.
4. Script npm run library:seed: crea bloques de biblioteca a partir de los bloques
   distintos del plan actual (sin duplicados por contenido), con la ración de Cristina
   como base y nombre sacado del título de la sección. Genera un informe de lo creado.
   NO crees grupos de equivalencia: los rellena la nutricionista.
5. Admin:
   - Biblioteca: lista con búsqueda y filtros (franja, etiqueta); editor reutilizando
     BlockEditor/ItemEditor en modo "ración base"; duplicar; archivar.
   - Alimentos: tabla editable del catálogo (nombre, sección, unidad, batchable).
   - Equivalencias: editor de grupos con alimentos del catálogo, factor y nota, y una
     vista previa ("140 g de lentejas → 140 g de garbanzos").
```

### Fase 16 · Constructor de dietas y publicación

Es la fase más grande. Si se alarga, divídela en 16a (borrador y cuadrícula) y 16b
(publicación y arrastre de cambios).

```
Lee CLAUDE.md y docs/PLAN.md (decisiones 2, 3, 4 y 7) y la fase 16.

1. Migración 0007:
   - diet_drafts(household_id pk, base_plan_id, data jsonb con forma de Plan,
     updated_by, updated_at). Solo staff.
   - RPC publish_plan(p_household uuid, p_plan jsonb, p_valid_from date,
     p_carry jsonb), security definer, en una única transacción: comprueba is_staff y
     que valid_from es lunes, cierra el plan vigente (valid_to = valid_from - 1),
     inserta el plan nuevo con version + 1, inserta template_cells y lo arrastrado
     (blocks, cells, overrides), fija app.change_source = 'publicacion' y borra el
     borrador.
2. domain/carryOver.ts (puro; es la pieza crítica, con muchos tests):
   carryOver({prevPlan, prevEditedBlocks, prevTemplateCells, prevOverrides,
   nextPlan, validFrom}) → {blocks, cells, overrides, conflicts}.
   - Celda cuyo original no cambia entre versiones (usa diff.ts) → se conserva el
     estado del cliente; los bloques editados se copian con uuid nuevo y se remapean.
   - Celda que cambió la nutricionista → gana la nutricionista; si el cliente la
     había modificado, se añade a conflicts.
   - Overrides de semanas >= validFrom: misma regla. Las semanas anteriores siguen
     resolviéndose con el plan antiguo.
   - El constructor conserva los ids de bloque de las celdas que no se tocan, para
     que la comparación sea fiable.
3. Constructor en /admin/hogares/:id/dieta:
   - Empezar: "Partir de la dieta actual" (por defecto), "En blanco" o "Duplicar de
     otro hogar" (con un selector de qué persona corresponde a quién).
   - Cuadrícula: columnas lunes a domingo. Filas de franjas individuales por persona
     (Desayuno · Cristina, Desayuno · Andrés...) y filas compartidas (Comida, Cena)
     con las raciones de cada persona dentro de la celda.
   - Celda: resumen compacto. Al pulsarla, un panel lateral con el editor (reutiliza
     BlockEditor) y las acciones "Elegir de la biblioteca" (búsqueda, filtro por franja,
     vista previa y multiplicador por persona: ×0,75, ×1, ×1,25, ×1,5 o libre, por
     defecto el portion_multiplier del perfil), "Guardar en la biblioteca", "Vaciar" y
     "Copiar a otros días" (casillas de días). Nunca intercambia.
   - Pestaña Configuración: franjas de cada persona, entreno por día, suplementación,
     comodín, reglas (AOVE, ingestas libres, agua), recomendaciones y recetas.
   - Autoguardado del borrador (con debounce), validación Zod e indicador
     "Guardado"/"Sin guardar".
   - "Ver como Cristina": vista previa con los componentes de la app del cliente.
4. Publicar: elegir lunes de inicio (por defecto el próximo), resumen de celdas
   cambiadas, lista de conflictos con "Gana la nutricionista" por defecto y la opción
   "Mantener el cambio del cliente" en cada uno, confirmar, llamar a la RPC y mostrar el
   toast "Dieta publicada".
5. Archivar dieta: status archived. La app del cliente sin dieta vigente muestra "Tu
   nutricionista está preparando tu dieta".
6. App del cliente: la primera vez que se abre tras una publicación, aviso "Tu dieta se
   actualizó el …" con un enlace a "Ver cambios" (usa el registro).

Pruébalo con el Hogar demo, nunca con vuestro hogar hasta que funcione.
```

### Fase 17 · Panel de hogares

```
Lee CLAUDE.md y docs/PLAN.md, fase 17.

- /admin/hogares: tabla con hogar, personas, dieta vigente (desde), último cambio del
  cliente, adherencia de la semana (progress.ts) y búsqueda.
- Crear hogar y crear perfil (nombre, slug, claim_email, franjas y portion_multiplier).
  El perfil queda reservado a ese correo; no se envía ninguna invitación (eso es el
  hito K).
- Ficha del hogar con pestañas: Dieta (abre el constructor y muestra las versiones
  anteriores en solo lectura), Historial (ChangeLogList con filtros y "Restaurar") y
  Seguimiento (checks y trackers de la semana, solo lectura).
- "Ver como cliente": abre la app de cliente con ese perfil en modo solo lectura (flag
  en el store de UI que desactiva todas las mutaciones y muestra una banda "Vista de
  Cristina · solo lectura").
- Aviso fijo en "Crear hogar": "Usa solo datos de prueba hasta completar la revisión
  legal". Se retirará en el hito K.
```

---

## Hito G · Mejoras para el cliente

### Fase 18 · Sustituciones

```
Lee CLAUDE.md y docs/PLAN.md, fase 18. Solo si brand.features.substitutions.

1. "Sustituir por…" en el menú de cada alimento con foodKey que esté en algún grupo:
   hoja con las opciones del grupo y su cantidad calculada (equivalentsFor), nota del
   grupo y "Solo esta semana" / "Todo el plan" (el patrón actual).
   - Bloque individual: se sustituye el alimento.
   - Bloque compartido: "Para los dos" (por defecto) o "Solo para mí" (separa mi
     ración en un alimento nuevo y deja la del otro intacta).
   - El alimento muestra "En lugar de lentejas" y se puede restaurar.
2. "Cambiar por otro de la biblioteca" en el menú del bloque: bloques de la misma
   franja, instanciados con el portion_multiplier de cada persona.
3. Funciona sin conexión: biblioteca y grupos se persisten en la caché.
4. Todo pasa por forkBlock; el registro lo recoge el trigger.
5. Tests: la lista de la compra refleja la sustitución; "Solo para mí" no altera la
   ración del otro; restaurar devuelve el original.
```

### Fase 19 · Chat interno cliente ↔ nutricionista

Sustituye al chat de dudas con IA que había aquí antes. La duda de un cliente casi
siempre es sobre *su* dieta, y quien debe contestarla es quien la ha hecho: un modelo
respondiendo con documentación general habría sido una capa de más entre los dos.

```
Lee CLAUDE.md y docs/PLAN.md (decisión 11) y la fase 19.

1. Migración 0009:
   - chat_messages(id, household_id, profile_id, author_user_id, author_role
     ('cliente'|'nutricionista'), body, cell jsonb, created_at). Solo de añadir: un
     trigger firma el autor y su rol desde auth.uid() e is_staff(); no hay política de
     UPDATE ni de DELETE, así que un consejo no se puede reescribir después.
   - chat_reads(profile_id, role, last_read_at): hasta dónde ha leído cada parte.
   - RLS: el cliente solo su propio hilo (ni el de quien vive con él), staff todos.
   - Las dos tablas, en supabase_realtime.
2. domain/chat.ts (puro, con tests): anchorLabel, anchorFor, unreadCount (solo cuentan
   los mensajes de la otra parte), groupByDay y lastMessage.
3. data/chat.ts: useThread, useSendMessage, useMarkRead y useChatRealtime, con el filtro
   profile_id=eq.<id> en la suscripción.
4. Cliente: Más → "Tu nutricionista", con el número de mensajes sin leer, y
   "Preguntar sobre esto" en el menú de una franja, que abre el chat con la comida
   enganchada (día, franja y título).
5. Admin: sección Mensajes, una fila por persona con lo sin leer y un adelanto del
   último mensaje.
6. Decisiones: un hilo por persona (no por hogar: comparten cena, no sus dudas); aviso
   solo dentro de la app; texto, sin adjuntos.
```

---

## Hito H · Pendientes de la v1

### Fase 20 · Notas, adherencia y resumen

```
- Notas por franja: hambre 1-5 y texto corto (tabla meal_notes ya existe).
- Pantalla Progreso: adherencia semanal por franja y día, racha de días completos,
  comodín cumplido, AOVE y agua medios.
- Resumen imprimible (CSS print → "Guardar como PDF") y compartir.
- En la ficha del hogar (admin), la misma vista de Progreso.
```

### Fase 21 · Batch cooking

```
domain/batch.ts ya existe. Tarjeta en Hoy (domingos y cuando se detecte oportunidad):
"Puedes adelantar", con los platos aptos de los próximos 3 días, la cantidad total para
el hogar y los días de conservación (foods.keeps_days).
```

### Fase 22 · Notificaciones push

```
- Claves VAPID; suscripción desde Más, pidiendo permiso solo tras un gesto explícito.
- Service worker: push y notificationclick (abre Hoy en la franja).
- Edge Function send-reminders + pg_cron cada 15 min: recordatorios por franja según
  reminder_settings, comodín pendiente a las 20:00 y agua opcional.
- Aviso al cliente cuando la nutricionista publica una dieta nueva.
Probad en Android con la PWA instalada y sin ahorro de batería para Chrome.
```

---

## Hito K · Apertura a más usuarios

**No empezar sin la revisión legal.** Queda aquí como lista para cuando llegue el momento:

- Despliegue en cuentas de la consulta (Supabase en región UE, Vercel), creadas por ella;
  transferencia de proyectos desde las tuyas.
- Invitaciones por email desde la ficha del hogar; registro con email y contraseña además
  del enlace mágico.
- Aceptación versionada de la política de privacidad y términos (qué versión y cuándo).
  El chat es entre cliente y nutricionista, así que no necesita un consentimiento aparte,
  pero sí decir en la política cuánto se guarda y quién lo lee.
- Doble factor (TOTP de Supabase Auth) obligatorio para nutricionistas.
- Registro de accesos de staff a fichas de clientes (no solo de cambios).
- Exportar mis datos y solicitar baja (bloqueo y borrado según el plazo que indique el
  asesor).
- Textos legales enlazados desde brand.ts; retirar el aviso de "solo datos de prueba".
- Demo para otras consultas con el Hogar demo (datos ficticios).

---

## Anexo · Despliegue (si aún no está hecho)

1. Vercel: importar el repo, variables de entorno y dominio.
2. Añadir la URL a las redirecciones de Supabase Auth.
3. En cada móvil: Chrome → menú → "Instalar aplicación" → entrar con el enlace mágico.
4. QA en los dispositivos: modo avión (checks y compra se sincronizan al volver),
   intercambio compartido visto en el otro móvil en menos de 2 s, tema oscuro del
   sistema.

## Consejos

- La fase 16 es la de más riesgo: pide a Claude Code que empiece por `carryOver.ts` y sus
  tests, y no pases a la interfaz hasta que estén en verde.
- Antes de cada migración, `npx supabase db dump` como copia; prueba primero en una rama
  de Supabase o en un proyecto de pruebas.
- Cuando descubras una regla nueva, añádela a CLAUDE.md para que no se repita el error.
- Commit por fase; una rama por hito si quieres revisar con PR.
