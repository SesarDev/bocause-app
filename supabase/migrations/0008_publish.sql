-- Bocause Dieta · borradores y publicación
--
-- Publicar una dieta toca cinco tablas a la vez: cierra la versión vigente, crea la nueva,
-- escribe su plantilla, arrastra lo que el cliente había cambiado y borra el borrador. Si
-- eso se hiciera con cinco peticiones y fallara la tercera, el hogar se quedaría con dos
-- dietas vigentes o con una dieta sin plantilla. Por eso va en una sola transacción.
--
-- La traducción slug ↔ UUID **no se hace aquí**: el plan guarda "cristina" y las celdas
-- guardan el id del perfil, y ese cruce vive en `src/data/mappers.ts`, que es el único sitio
-- donde debe estar (CLAUDE.md). Esta función recibe las celdas ya traducidas.

/* ─────────────────────────── Borrador ─────────────────────────── */
--
-- Uno por hogar: la nutricionista trabaja sobre la dieta de alguien, no sobre dietas
-- sueltas. Al publicar se borra.

create table if not exists diet_drafts (
  household_id uuid primary key references households(id) on delete cascade,
  base_plan_id text references plans(id) on delete set null,
  data jsonb not null,                        -- documento con forma de Plan
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table diet_drafts enable row level security;

-- Solo staff: un borrador es trabajo a medias y el cliente no tiene por qué verlo.
drop policy if exists "staff drafts" on diet_drafts;
create policy "staff drafts" on diet_drafts for all
  using ((select is_staff())) with check ((select is_staff()));

drop trigger if exists touch_diet_drafts on diet_drafts;
create trigger touch_diet_drafts before update on diet_drafts
  for each row execute function touch_updated_at();

/* ─────────────────────────── Publicar ─────────────────────────── */

create or replace function publish_plan(
  p_household uuid,
  p_plan_id text,
  p_plan jsonb,
  p_valid_from date,
  p_cells jsonb default '[]'::jsonb,   -- [{day, slot, scope, block_id}] de la dieta nueva
  p_carry jsonb default '{}'::jsonb    -- {blocks:[], cells:[], overrides:[]} ya traducido
)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_row jsonb;
  v_vigente text;
begin
  if not is_staff() then
    raise exception 'Solo la nutricionista puede publicar una dieta' using errcode = '42501';
  end if;

  -- Las semanas empiezan en lunes (regla 10 de CLAUDE.md). Publicar a media semana dejaría
  -- la resolución de overrides a caballo entre dos planes.
  if extract(isodow from p_valid_from) <> 1 then
    raise exception 'La dieta nueva tiene que empezar en lunes' using errcode = '22023';
  end if;

  -- Lo que escriba esto se marca como publicación en el registro de cambios (0006).
  perform set_config('app.change_source', 'publicacion', true);

  /* 1. Cerrar la dieta vigente el día anterior. */
  select id into v_vigente
    from plans
   where household_id = p_household
     and status = 'active'
     and valid_from < p_valid_from
     and (valid_to is null or valid_to >= p_valid_from)
   order by valid_from desc
   limit 1;

  if v_vigente is not null then
    update plans set valid_to = p_valid_from - 1 where id = v_vigente;
  end if;

  /* 2. La versión nueva. `version` la numera sola el trigger de la 0005. */
  insert into plans (id, household_id, name, valid_from, valid_to, status, data,
                     published_at, published_by)
  values (p_plan_id, p_household, coalesce(p_plan ->> 'name', 'Dieta'), p_valid_from, null,
          'active', p_plan, now(), auth.uid());

  /* 3. Su plantilla. */
  for v_row in select * from jsonb_array_elements(p_cells) loop
    insert into template_cells (plan_id, day, slot, scope, block_id, updated_by)
    values (p_plan_id, (v_row ->> 'day')::smallint, v_row ->> 'slot', v_row ->> 'scope',
            v_row ->> 'block_id', null);
  end loop;

  /* 4. Lo que el cliente había cambiado y sigue valiendo (ver src/domain/carryOver.ts). */

  for v_row in select * from jsonb_array_elements(coalesce(p_carry -> 'blocks', '[]'::jsonb)) loop
    insert into blocks (id, plan_id, slot, scope, origin_block_id, content, created_by)
    values (v_row ->> 'id', p_plan_id, v_row ->> 'slot', v_row ->> 'scope',
            v_row ->> 'origin_block_id', v_row -> 'content', null);
  end loop;

  for v_row in select * from jsonb_array_elements(coalesce(p_carry -> 'cells', '[]'::jsonb)) loop
    insert into template_cells (plan_id, day, slot, scope, block_id, updated_by)
    values (p_plan_id, (v_row ->> 'day')::smallint, v_row ->> 'slot', v_row ->> 'scope',
            v_row ->> 'block_id', null)
    on conflict (plan_id, day, slot, scope) do update set block_id = excluded.block_id;
  end loop;

  for v_row in select * from jsonb_array_elements(coalesce(p_carry -> 'overrides', '[]'::jsonb)) loop
    insert into week_overrides (plan_id, week_start, day, slot, scope, block_id, is_free, updated_by)
    values (p_plan_id, (v_row ->> 'week_start')::date, (v_row ->> 'day')::smallint,
            v_row ->> 'slot', v_row ->> 'scope', v_row ->> 'block_id',
            coalesce((v_row ->> 'is_free')::boolean, false), null)
    on conflict (plan_id, week_start, day, slot, scope) do update
      set block_id = excluded.block_id, is_free = excluded.is_free;
  end loop;

  /* 5. El borrador ya no hace falta. */
  delete from diet_drafts where household_id = p_household;

  return p_plan_id;
end;
$$;

revoke execute on function publish_plan(uuid, text, jsonb, date, jsonb, jsonb) from public;
grant execute on function publish_plan(uuid, text, jsonb, date, jsonb, jsonb) to authenticated;

/* ─────────────────────────── Archivar ─────────────────────────── */
--
-- Archivar, no borrar (decisión 7 de PLAN.md): una dieta publicada es el registro de lo que
-- alguien comió durante semanas.

create or replace function archive_plan(p_plan_id text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_staff() then
    raise exception 'Solo la nutricionista puede archivar una dieta' using errcode = '42501';
  end if;

  update plans set status = 'archived' where id = p_plan_id;
end;
$$;

revoke execute on function archive_plan(text) from public;
grant execute on function archive_plan(text) to authenticated;
