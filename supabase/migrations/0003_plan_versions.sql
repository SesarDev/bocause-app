-- Bocause Dieta · versiones de plan
--
-- Prepara `plans` para la "dieta viva" de la v2 (decisión 2 de docs/PLAN.md): la
-- nutricionista publica cambios y cada publicación crea una versión nueva, inmutable,
-- con `valid_from` siempre en lunes, cerrando la anterior con `valid_to`.
--
-- Esta migración solo añade las columnas. Quién puede publicar (staff) se cierra en la
-- 0004, y la RPC `publish_plan` llega en la 0007: hoy la escritura en `plans` sigue
-- abierta a cualquier miembro del hogar, que es lo que hay en 0001.
--
-- Es aditiva y no bloquea: las tres columnas admiten nulo o tienen valor por defecto, así
-- que se puede aplicar con la app en uso.

alter table plans add column if not exists version int not null default 1;
alter table plans add column if not exists published_at timestamptz;
alter table plans add column if not exists published_by uuid references auth.users(id);

comment on column plans.version is
  'Número de publicación dentro del hogar. La primera versión de cada dieta es la 1.';
comment on column plans.published_at is
  'Cuándo se publicó esta versión. Null en los borradores.';
comment on column plans.published_by is
  'Usuario que publicó. Null en los planes sembrados antes de que existiera el rol de staff.';

-- Los planes que ya existen se consideran publicados cuando se crearon.
update plans set published_at = created_at where published_at is null;

-- Dos versiones de la misma dieta no pueden compartir número dentro de un hogar.
create unique index if not exists plans_household_version_idx on plans (household_id, version);

-- ─────────────────────── updated_at de verdad ───────────────────────
--
-- `updated_at` tenía `default now()`, que solo se aplica al INSERTAR. La app nunca escribe
-- esa columna, así que al modificar una fila (un check que se desmarca, un intercambio que
-- cambia de bloque) la fecha se quedaba con el valor del primer día. O sea: decía cuándo
-- nació la fila, no cuándo se tocó por última vez.
--
-- Importa ya: el registro de cambios de la fase 14 y el "último cambio del cliente" de la
-- 17 se apoyan en esa fecha, y cualquier sincronización incremental también.

create or replace function touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'template_cells', 'week_overrides', 'checks', 'daily_logs', 'meal_notes', 'shopping_items'
  ] loop
    execute format('drop trigger if exists touch_%1$s on %1$I', t);
    execute format(
      'create trigger touch_%1$s before update on %1$I
       for each row execute function touch_updated_at()', t);
  end loop;
end $$;
