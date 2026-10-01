-- Bocause Dieta · esquema inicial
-- Modelo: plan original inmutable (jsonb) + capas editables (bloques copiados,
-- plantilla viva y overrides semanales) + registro diario.

create extension if not exists "pgcrypto";

-- ─────────────────────────── Hogar y perfiles ───────────────────────────

create table households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete set null,
  household_id uuid not null references households(id) on delete cascade,
  slug text not null,                       -- "cristina" | "andres" (enlaza con el seed)
  display_name text not null,
  theme text not null default 'system' check (theme in ('system','light','dark')),
  unique (household_id, slug)
);

-- Helpers para RLS
create or replace function my_profile_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from profiles where user_id = auth.uid()
$$;

create or replace function is_household_member(h uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where household_id = h and user_id = auth.uid())
$$;

create or replace function profile_household(p uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select household_id from profiles where id = p
$$;

-- ─────────────────────────── Planes ───────────────────────────

create table plans (
  id text primary key,                      -- "2026-09"
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  valid_from date not null,
  valid_to date,
  status text not null default 'active' check (status in ('draft','active','archived')),
  data jsonb not null,                      -- documento Plan original (Zod), NUNCA se modifica
  created_at timestamptz not null default now()
);

-- Bloques editados (copy-on-write). Los originales viven en plans.data.blocks.
create table blocks (
  id text primary key,
  plan_id text not null references plans(id) on delete cascade,
  slot text not null,
  scope text not null,                      -- 'shared' | profiles.id::text
  origin_block_id text,
  content jsonb not null,                   -- { sections: Section[] }
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- Plantilla viva: cambios "para todo el plan". Se inicializa desde plans.data.template.
create table template_cells (
  plan_id text not null references plans(id) on delete cascade,
  day smallint not null check (day between 0 and 6),
  slot text not null,
  scope text not null,
  block_id text,                            -- null = celda vacía
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now(),
  primary key (plan_id, day, slot, scope)
);

-- Cambios "solo esta semana".
create table week_overrides (
  plan_id text not null references plans(id) on delete cascade,
  week_start date not null check (extract(isodow from week_start) = 1),
  day smallint not null check (day between 0 and 6),
  slot text not null,
  scope text not null,
  block_id text,
  is_free boolean not null default false,
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now(),
  primary key (plan_id, week_start, day, slot, scope)
);

-- ─────────────────────────── Registro diario ───────────────────────────

create table checks (
  profile_id uuid not null references profiles(id) on delete cascade,
  date date not null,
  slot text not null,
  item_id text not null,
  checked boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (profile_id, date, slot, item_id)
);

create table daily_logs (
  profile_id uuid not null references profiles(id) on delete cascade,
  date date not null,
  comodin_option_id text,
  comodin_done boolean not null default false,
  water_ml integer not null default 0 check (water_ml >= 0),
  aove_spoons smallint not null default 0 check (aove_spoons >= 0),
  updated_at timestamptz not null default now(),
  primary key (profile_id, date)
);

create table meal_notes (
  profile_id uuid not null references profiles(id) on delete cascade,
  date date not null,
  slot text not null,
  hunger smallint check (hunger between 1 and 5),
  text text check (char_length(text) <= 500),
  updated_at timestamptz not null default now(),
  primary key (profile_id, date, slot)
);

-- ─────────────────────────── Compra ───────────────────────────

create table shopping_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  week_start date not null,
  source text not null check (source in ('auto','manual')),
  food_key text,
  label text not null,
  quantity_text text,
  section text not null default 'otros',
  checked boolean not null default false,
  in_pantry boolean not null default false,
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (household_id, week_start, source, food_key)
);

-- ─────────────────────────── Notificaciones ───────────────────────────

create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  endpoint text not null unique,
  keys jsonb not null,
  created_at timestamptz not null default now()
);

create table reminder_settings (
  profile_id uuid primary key references profiles(id) on delete cascade,
  enabled boolean not null default false,
  slot_times jsonb not null default '{}'::jsonb,   -- { "desayuno": "08:00", ... }
  comodin_reminder time,
  water_every_minutes integer
);

-- ─────────────────────────── RLS ───────────────────────────

alter table households        enable row level security;
alter table profiles          enable row level security;
alter table plans             enable row level security;
alter table blocks            enable row level security;
alter table template_cells    enable row level security;
alter table week_overrides    enable row level security;
alter table checks            enable row level security;
alter table daily_logs        enable row level security;
alter table meal_notes        enable row level security;
alter table shopping_items    enable row level security;
alter table push_subscriptions enable row level security;
alter table reminder_settings enable row level security;

-- Lectura: todo el hogar ve todo.
create policy "read household" on households for select using (is_household_member(id));
create policy "read profiles"  on profiles  for select using (is_household_member(household_id));
create policy "read plans"     on plans     for select using (is_household_member(household_id));
create policy "write plans"    on plans     for all    using (is_household_member(household_id))
                                                        with check (is_household_member(household_id));

-- Celdas y bloques: compartidos editables por ambos; individuales solo por su dueño.
create or replace function can_edit_scope(plan text, sc text) returns boolean
language sql stable security definer set search_path = public as $$
  select is_household_member((select household_id from plans where id = plan))
     and (sc = 'shared' or sc = my_profile_id()::text)
$$;

create policy "read blocks"  on blocks for select
  using (is_household_member((select household_id from plans where id = plan_id)));
create policy "write blocks" on blocks for all
  using (can_edit_scope(plan_id, scope)) with check (can_edit_scope(plan_id, scope));

create policy "read template"  on template_cells for select
  using (is_household_member((select household_id from plans where id = plan_id)));
create policy "write template" on template_cells for all
  using (can_edit_scope(plan_id, scope)) with check (can_edit_scope(plan_id, scope));

create policy "read overrides"  on week_overrides for select
  using (is_household_member((select household_id from plans where id = plan_id)));
create policy "write overrides" on week_overrides for all
  using (can_edit_scope(plan_id, scope)) with check (can_edit_scope(plan_id, scope));

-- Registro diario: ambos leen, cada uno escribe lo suyo.
create policy "read checks"  on checks for select using (is_household_member(profile_household(profile_id)));
create policy "write checks" on checks for all
  using (profile_id = my_profile_id()) with check (profile_id = my_profile_id());

create policy "read logs"  on daily_logs for select using (is_household_member(profile_household(profile_id)));
create policy "write logs" on daily_logs for all
  using (profile_id = my_profile_id()) with check (profile_id = my_profile_id());

create policy "read notes"  on meal_notes for select using (is_household_member(profile_household(profile_id)));
create policy "write notes" on meal_notes for all
  using (profile_id = my_profile_id()) with check (profile_id = my_profile_id());

-- Compra: totalmente compartida.
create policy "shopping" on shopping_items for all
  using (is_household_member(household_id)) with check (is_household_member(household_id));

-- Notificaciones: privadas.
create policy "own push" on push_subscriptions for all
  using (profile_id = my_profile_id()) with check (profile_id = my_profile_id());
create policy "own reminders" on reminder_settings for all
  using (profile_id = my_profile_id()) with check (profile_id = my_profile_id());

-- ─────────────────────────── Realtime ───────────────────────────

alter publication supabase_realtime add table
  template_cells, week_overrides, blocks, checks, daily_logs, shopping_items;
