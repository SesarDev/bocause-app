# Reglas de datos (multi-hogar)

Una consulta sin filtro mezcla hogares y no da ningún error.

- **Toda consulta filtra por hogar de forma explícita.** RLS es la última defensa, no el filtro.
  - `plans`, `profiles` y `shopping_items`: por `household_id`.
  - `checks` y `daily_logs`: por los `profile_id` del hogar.
  - `blocks`, `template_cells` y `week_overrides`: por `plan_id`.
- **Claves de consulta:** llevan el hogar en la raíz. En React se usa `keysFor(useActiveHousehold())`, para que la consulta se rehaga al cambiar de hogar. Lo comprueba `keys.test.ts`.
- **Catálogo, biblioteca y equivalencias:** son de la consulta, no de un hogar. Usan `consultaKeys` y no llevan `household_id`.
- **Claves de mutación:** NO llevan el hogar. Si lo llevaran, una mutación pendiente sin cobertura dejaría de reconocerse y no se ejecutaría.
- **Ids nuevos:** `crypto.randomUUID()` entero. `blocks.id` es clave global y se escribe con `upsert`: una colisión pisaría el bloque de otro hogar sin error.
- **Caché de IndexedDB:** se separa por usuario. Al cerrar sesión se borra _antes_ de cerrarla, que es cuando todavía se sabe de quién es.
- **Realtime:** las suscripciones siempre llevan `filter`.
- **Slug ↔ UUID:** la traducción solo vive en `mappers.ts`. No baja a SQL.
- **El id del plan es el de la fila, no el del JSON.** `plans.data` lleva dentro su propio id y puede no coincidir (el hogar demo es `demo-2026-09`). `toPlan` se queda con el de la fila y `saveBlock` escribe `plan_id` con el del hogar que se está editando. Con el de dentro, RLS devuelve un 403 y no se puede editar nada en ese hogar.
- **Chat:** el hilo cuelga del hogar activo, pero se pide por `profile_id`. El autor y su rol no se mandan: los firma un trigger.
- **Restaurar:** va por la RPC `restore_cell` (atómica). `domain/edit.ts` decide qué deshacer; la RPC solo lo escribe.
