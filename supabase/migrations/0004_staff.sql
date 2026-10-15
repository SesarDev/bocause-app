-- Bocause Dieta · rol de nutricionista
--
-- Hasta ahora solo existía un rol: el cliente, miembro de un hogar. Esta migración añade el
-- de nutricionista (`staff_members`), que ve y edita todos los hogares, y de paso **cierra**
-- un permiso que estaba demasiado abierto: la 0001 dejaba escribir en `plans` a cualquier
-- miembro del hogar. A partir de aquí la dieta la publica ella.
--
-- Criterio al tocar las políticas: **añadir** políticas para staff en vez de reescribir las
-- que ya funcionan. Las políticas permisivas se suman (basta con que una deje pasar), así
-- que el acceso del cliente queda exactamente igual que antes y es más difícil romperlo sin
-- querer. La única que se reescribe es la de escritura en `plans`, porque ahí el objetivo es
-- justamente quitar permiso.
--
-- Lo comprueba `supabase/tests/rls.test.sql` con pgTAP.

-- ─────────────────────────── Quién es staff ───────────────────────────

create table if not exists staff_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  role text not null default 'nutricionista' check (role in ('nutricionista')),
  created_at timestamptz not null default now()
);

alter table staff_members enable row level security;

create or replace function is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from staff_members where user_id = auth.uid())
$$;

revoke execute on function is_staff() from public;
grant execute on function is_staff() to authenticated;

-- Staff se ve a sí mismo y a sus compañeras. Y nada más: **no hay política de INSERT,
-- UPDATE ni DELETE**, así que nadie puede ascenderse desde la app. Darse de alta solo
-- ocurre con la clave service_role, desde `npm run staff:add`.
drop policy if exists "read staff" on staff_members;
create policy "read staff" on staff_members for select using ((select is_staff()));

-- ─────────────────────────── Ración por persona ───────────────────────────
--
-- Cuánto come esta persona respecto a la ración base de la biblioteca (fase 15).

alter table profiles add column if not exists portion_multiplier numeric not null default 1
  check (portion_multiplier > 0);

comment on column profiles.portion_multiplier is
  'Multiplicador sobre la ración base al instanciar un bloque de la biblioteca.';

-- ─────────────────────────── Lectura: staff lo ve todo ───────────────────────────
--
-- `(select is_staff())` y no `is_staff()`: envuelto en un subselect, Postgres lo evalúa una
-- vez por consulta en lugar de una vez por fila.

drop policy if exists "staff reads households" on households;
create policy "staff reads households" on households for select using ((select is_staff()));

drop policy if exists "staff reads profiles" on profiles;
create policy "staff reads profiles" on profiles for select using ((select is_staff()));

drop policy if exists "staff reads plans" on plans;
create policy "staff reads plans" on plans for select using ((select is_staff()));

drop policy if exists "staff reads checks" on checks;
create policy "staff reads checks" on checks for select using ((select is_staff()));

drop policy if exists "staff reads logs" on daily_logs;
create policy "staff reads logs" on daily_logs for select using ((select is_staff()));

drop policy if exists "staff reads notes" on meal_notes;
create policy "staff reads notes" on meal_notes for select using ((select is_staff()));

drop policy if exists "staff reads shopping" on shopping_items;
create policy "staff reads shopping" on shopping_items for select using ((select is_staff()));

-- ─────────────────────────── Escritura de la dieta ───────────────────────────
--
-- La nutricionista edita la dieta de cualquier hogar, sea miembro o no. El cliente sigue
-- con lo suyo: compartidos los dos, individuales cada uno (`can_edit_scope` de la 0001).

drop policy if exists "staff writes blocks" on blocks;
create policy "staff writes blocks" on blocks for all
  using ((select is_staff())) with check ((select is_staff()));

drop policy if exists "staff writes template" on template_cells;
create policy "staff writes template" on template_cells for all
  using ((select is_staff())) with check ((select is_staff()));

drop policy if exists "staff writes overrides" on week_overrides;
create policy "staff writes overrides" on week_overrides for all
  using ((select is_staff())) with check ((select is_staff()));

-- El registro diario NO se toca: marcar comidas y beber agua es del cliente. Staff lo lee
-- (políticas de arriba) pero no escribe por él. El seguimiento de la fase 17 es solo lectura.

-- ─────────────────────────── Planes: solo staff publica ───────────────────────────
--
-- Esta es la única política que se quita. La 0001 tenía `write plans ... for all` para
-- cualquier miembro del hogar, lo que significaba que un cliente podía reescribir o borrar
-- su propia dieta, incluido el documento original que se supone inmutable.
-- `read plans` sigue en pie, así que los clientes la siguen viendo igual.

drop policy if exists "write plans" on plans;

drop policy if exists "staff writes plans" on plans;
create policy "staff writes plans" on plans for all
  using ((select is_staff())) with check ((select is_staff()));

-- ─────────────────────────── Altas de hogares y perfiles ───────────────────────────
--
-- Por función y no por política, a propósito. La 0002 limitó la escritura de `profiles` a
-- la columna `theme` con un permiso **por columna** (`grant update (theme) ... to
-- authenticated`), que es lo que impide que alguien se cambie el `slug` o el `claim_email`.
-- Ese candado alcanza también a la nutricionista, porque también es `authenticated`, y
-- ninguna política RLS puede devolverle el permiso: las políticas dicen qué filas, no qué
-- columnas. Con `security definer` se le da exactamente lo que necesita sin aflojar el
-- candado para todos los demás.

create or replace function staff_create_household(p_name text)
returns households
language plpgsql security definer set search_path = public as $$
declare
  creada households;
begin
  if not is_staff() then
    raise exception 'Solo la nutricionista puede crear hogares' using errcode = '42501';
  end if;

  insert into households (name) values (p_name) returning * into creada;
  return creada;
end;
$$;

create or replace function staff_upsert_profile(
  p_household_id uuid,
  p_slug text,
  p_display_name text,
  p_claim_email text default null,
  p_portion_multiplier numeric default 1
)
returns profiles
language plpgsql security definer set search_path = public as $$
declare
  guardado profiles;
begin
  if not is_staff() then
    raise exception 'Solo la nutricionista puede crear o editar perfiles' using errcode = '42501';
  end if;

  insert into profiles (household_id, slug, display_name, claim_email, portion_multiplier)
  values (p_household_id, p_slug, p_display_name, p_claim_email, p_portion_multiplier)
  on conflict (household_id, slug) do update
    set display_name = excluded.display_name,
        claim_email = excluded.claim_email,
        portion_multiplier = excluded.portion_multiplier
  returning * into guardado;

  return guardado;
end;
$$;

revoke execute on function staff_create_household(text) from public;
revoke execute on function staff_upsert_profile(uuid, text, text, text, numeric) from public;
grant execute on function staff_create_household(text) to authenticated;
grant execute on function staff_upsert_profile(uuid, text, text, text, numeric) to authenticated;
