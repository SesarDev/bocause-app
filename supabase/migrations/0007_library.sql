-- Bocause Dieta · catálogo, biblioteca y equivalencias
--
-- Hasta ahora el catálogo de alimentos vivía dentro de `plans.data`, o sea dentro de cada
-- plan: no se podía corregir el nombre de un alimento sin tocar un documento que se supone
-- inmutable, y cada plan nuevo lo traía otra vez. Aquí sale a su propia tabla.
--
-- Las tres tablas son de la consulta, no de un hogar: la decisión 1 de docs/PLAN.md es una
-- app (y un Supabase) por consulta, así que no llevan `household_id`. Las lee cualquiera
-- que haya entrado, porque el cliente las necesita para sustituir un alimento (fase 18) y
-- para el chat (fase 19); escribirlas es cosa de la nutricionista.

/* ─────────────────────────── Catálogo ─────────────────────────── */

create table if not exists foods (
  key text primary key,                       -- "pechuga-pavo"
  name text not null,
  section text not null default 'otros',
  unit text not null default 'g' check (unit in ('g', 'ml', 'ud')),
  batchable boolean not null default false,
  keeps_days int,
  archived boolean not null default false,
  updated_at timestamptz not null default now()
);

comment on table foods is
  'Catálogo de alimentos de la consulta. Se siembra desde plan.foods y lo mantiene la nutricionista.';
comment on column foods.keeps_days is
  'Días que aguanta cocinado. Lo usa la sugerencia de batch cooking (fase 21).';

/* ─────────────────────────── Biblioteca de bloques ─────────────────────────── */
--
-- `content` guarda las secciones con **una ración base** por alimento, no una por persona:
-- el reparto se hace al usarlo, con el multiplicador de cada comensal. La forma la valida
-- Zod (`LibraryBlock` en src/domain/schema.ts) antes de entrar y al salir.

create table if not exists library_blocks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slots text[] not null default '{}',         -- en qué franjas tiene sentido ofrecerlo
  tags text[] not null default '{}',
  content jsonb not null,                     -- { sections: LibrarySection[] }
  notes text,
  archived boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create index if not exists library_blocks_slots_idx on library_blocks using gin (slots);
create index if not exists library_blocks_tags_idx on library_blocks using gin (tags);

/* ─────────────────────────── Equivalencias ─────────────────────────── */
--
-- Los grupos los define la nutricionista. La app NO inventa equivalencias ni cantidades
-- (regla de CLAUDE.md): aquí solo se guardan las que ella decide, con su factor.

create table if not exists equivalence_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  members jsonb not null default '[]'::jsonb, -- EquivalenceMember[]
  archived boolean not null default false,
  updated_at timestamptz not null default now()
);

/* ─────────────────────────── Permisos ─────────────────────────── */

alter table foods enable row level security;
alter table library_blocks enable row level security;
alter table equivalence_groups enable row level security;

do $$
declare t text;
begin
  foreach t in array array['foods', 'library_blocks', 'equivalence_groups'] loop
    -- Lee cualquiera que haya entrado: el cliente necesita el catálogo y las
    -- equivalencias para sustituir alimentos, y el chat para responder.
    execute format('drop policy if exists "read %1$s" on %1$I', t);
    execute format(
      'create policy "read %1$s" on %1$I for select to authenticated using (true)', t);

    -- Escribe solo la nutricionista.
    execute format('drop policy if exists "staff writes %1$s" on %1$I', t);
    execute format(
      'create policy "staff writes %1$s" on %1$I for all
       using ((select is_staff())) with check ((select is_staff()))', t);

    -- updated_at de verdad, como en la 0003.
    execute format('drop trigger if exists touch_%1$s on %1$I', t);
    execute format(
      'create trigger touch_%1$s before update on %1$I
       for each row execute function touch_updated_at()', t);
  end loop;
end $$;
