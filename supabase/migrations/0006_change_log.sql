-- Bocause Dieta · registro de cambios
--
-- Desde la 0004 hay dos personas que pueden tocar la misma dieta: el cliente, que la ajusta
-- a su semana, y la nutricionista, que publica. Sin registro, "¿quién cambió esto?" no
-- tiene respuesta. Y en la fase 16, cuando publicar empiece a arrastrar o pisar cambios del
-- cliente, deja de ser una curiosidad.
--
-- Se escribe **desde Postgres, con triggers**, y no desde la app, por dos razones:
--   1. También registra lo que llega tarde, cuando una mutación guardada sin cobertura se
--      reanuda al recuperar la red.
--   2. No hay forma de escribir en esas tablas sin dejar rastro, ni siquiera por error.
--
-- Es **solo de añadir**: no hay políticas de UPDATE ni DELETE, para nadie.

create table if not exists change_log (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  plan_id text not null references plans(id) on delete cascade,

  -- Transacción en la que ocurrió. Un intercambio escribe sus dos celdas en la misma
  -- sentencia, así que comparten este número y se pueden agrupar con certeza. Agrupar por
  -- marca de tiempo sería adivinar.
  tx_id bigint not null,

  actor_user_id uuid references auth.users(id) on delete set null,
  actor_role text not null check (actor_role in ('cliente', 'nutricionista', 'sistema')),

  table_name text not null,
  op text not null check (op in ('INSERT', 'UPDATE', 'DELETE')),

  -- De qué celda hablamos: {day, slot, scope, weekStart?}. `blocks` no tiene día, así que
  -- ahí vienen solo las claves que existen.
  cell jsonb,
  before jsonb,
  after jsonb,

  source text not null default 'app',
  created_at timestamptz not null default now()
);

create index if not exists change_log_household_idx on change_log (household_id, created_at desc);
create index if not exists change_log_tx_idx on change_log (tx_id);

comment on column change_log.tx_id is
  'Transacción de Postgres. Las celdas de un mismo intercambio la comparten.';
comment on column change_log.source is
  'app | publicacion | restaurar. Lo fija quien escribe, con app.change_source.';

-- ─────────────────────────── El trigger ───────────────────────────
--
-- Una sola función para las tres tablas: trabaja sobre `to_jsonb(NEW/OLD)` en vez de sobre
-- columnas concretas, que es lo que permite que valga igual para celdas y para bloques
-- aunque no tengan las mismas columnas.

create or replace function log_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_new jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  v_old jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  v_row jsonb := coalesce(v_new, v_old);
  v_plan text := v_row ->> 'plan_id';
  v_household uuid;
  v_actor uuid := auth.uid();
begin
  select household_id into v_household from plans where id = v_plan;

  insert into change_log (
    household_id, plan_id, tx_id, actor_user_id, actor_role,
    table_name, op, cell, before, after, source
  )
  values (
    v_household,
    v_plan,
    txid_current(),
    v_actor,
    case
      when v_actor is null then 'sistema'   -- seed o script con service_role
      when is_staff() then 'nutricionista'
      else 'cliente'
    end,
    tg_table_name,
    tg_op,
    jsonb_strip_nulls(jsonb_build_object(
      'day', v_row -> 'day',
      'slot', v_row ->> 'slot',
      'scope', v_row ->> 'scope',
      'weekStart', v_row ->> 'week_start'
    )),
    v_old,
    v_new,
    coalesce(nullif(current_setting('app.change_source', true), ''), 'app')
  );

  return null;  -- AFTER trigger: lo que devuelva da igual
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['template_cells', 'week_overrides', 'blocks'] loop
    execute format('drop trigger if exists log_%1$s on %1$I', t);
    execute format(
      'create trigger log_%1$s after insert or update or delete on %1$I
       for each row execute function log_change()', t);
  end loop;
end $$;

-- ─────────────────────────── Quién lo lee ───────────────────────────
--
-- El hogar ve su historia y la nutricionista la de todos. Nadie la edita ni la borra: no
-- hay políticas de UPDATE ni DELETE, igual que en staff_members. El trigger puede escribir
-- porque corre como dueño de la tabla, que está exento de RLS.

alter table change_log enable row level security;

drop policy if exists "read change log" on change_log;
create policy "read change log" on change_log for select
  using (is_household_member(household_id) or (select is_staff()));

-- ─────────────────────────── Restaurar, en una sola transacción ───────────────────────────
--
-- Antes la app restauraba con varias peticiones sueltas (un DELETE por override y luego un
-- UPSERT). Si fallaba a mitad, la celda quedaba a medias. Y al ser varias transacciones, el
-- registro lo contaría como varios cambios y no habría forma de marcarlo como 'restaurar':
-- PostgREST abre una transacción por petición, así que `set_config` desde otra llamada no
-- llegaría hasta aquí.
--
-- Es `security definer`, o sea que se salta RLS: por eso comprueba los permisos a mano,
-- celda por celda, con la misma regla que las políticas (`can_edit_scope`).

create or replace function restore_cell(
  p_plan_id text,
  p_week_start date,
  p_deletes jsonb default '[]'::jsonb,
  p_template jsonb default '[]'::jsonb
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_row jsonb;
  v_me uuid := my_profile_id();
begin
  perform set_config('app.change_source', 'restaurar', true);

  for v_row in select * from jsonb_array_elements(p_deletes) loop
    if not (can_edit_scope(p_plan_id, v_row ->> 'scope') or is_staff()) then
      raise exception 'No puedes restaurar esa celda' using errcode = '42501';
    end if;

    delete from week_overrides
     where plan_id = p_plan_id
       and week_start = p_week_start
       and day = (v_row ->> 'day')::smallint
       and slot = v_row ->> 'slot'
       and scope = v_row ->> 'scope';
  end loop;

  for v_row in select * from jsonb_array_elements(p_template) loop
    if not (can_edit_scope(p_plan_id, v_row ->> 'scope') or is_staff()) then
      raise exception 'No puedes restaurar esa celda' using errcode = '42501';
    end if;

    insert into template_cells (plan_id, day, slot, scope, block_id, updated_by)
    values (
      p_plan_id,
      (v_row ->> 'day')::smallint,
      v_row ->> 'slot',
      v_row ->> 'scope',
      v_row ->> 'block_id',
      v_me
    )
    on conflict (plan_id, day, slot, scope) do update
      set block_id = excluded.block_id,
          updated_by = excluded.updated_by;
  end loop;
end;
$$;

revoke execute on function restore_cell(text, date, jsonb, jsonb) from public;
grant execute on function restore_cell(text, date, jsonb, jsonb) to authenticated;
