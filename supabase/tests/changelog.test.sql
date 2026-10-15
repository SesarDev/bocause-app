-- Bocause Dieta · pruebas del registro de cambios
--
-- El registro lo escribe Postgres con triggers, no la app: así queda constancia también de
-- lo que llega después de estar sin cobertura, y no hay forma de tocar la dieta sin dejar
-- rastro. Es **solo de añadir**: ni el cliente ni la nutricionista pueden editarlo.
--
-- Como el resto, corre contra el Supabase local y termina en ROLLBACK.

begin;

create extension if not exists pgtap with schema extensions;

select plan(12);

create or replace function test_como(p_uid uuid, p_email text) returns void
language plpgsql as $$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', p_uid, 'email', p_email, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';
end;
$$;

create or replace function test_como_montador() returns void
language plpgsql as $$
begin
  execute 'set local role postgres';
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- ─────────────────────────── Escenario ───────────────────────────

insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-4111-8111-111111111111',
   'authenticated', 'authenticated', 'cliente@ejemplo.test', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-4222-8222-222222222222',
   'authenticated', 'authenticated', 'otro@ejemplo.test', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '33333333-3333-4333-8333-333333333333',
   'authenticated', 'authenticated', 'nutri@ejemplo.test', now(), now());

insert into households (id, name) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'Casa de prueba'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'Otra casa');

insert into profiles (id, user_id, household_id, slug, display_name) values
  ('aaaaaaaa-1111-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
   'aaaaaaaa-0000-4000-8000-000000000001', 'andres', 'Andrés'),
  ('bbbbbbbb-1111-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222',
   'bbbbbbbb-0000-4000-8000-000000000002', 'otro', 'Otro');

insert into plans (id, household_id, name, valid_from, status, data) values
  ('plan-casa', 'aaaaaaaa-0000-4000-8000-000000000001', 'Plan de casa',
   '2026-10-12', 'active', '{}'::jsonb),
  ('plan-otra', 'bbbbbbbb-0000-4000-8000-000000000002', 'Plan de la otra casa',
   '2026-10-12', 'active', '{}'::jsonb);

insert into staff_members (user_id, display_name) values
  ('33333333-3333-4333-8333-333333333333', 'Nutricionista de prueba');

-- Lo que siembre el montador (service_role, sin auth.uid()) debe quedar como 'sistema'.
insert into template_cells (plan_id, day, slot, scope, block_id) values
  ('plan-casa', 0, 'comida', 'shared', 'bloque-lunes'),
  ('plan-casa', 1, 'comida', 'shared', 'bloque-martes'),
  ('plan-otra', 0, 'comida', 'shared', 'bloque-otra');

select is(
  (select count(*)::int from change_log where plan_id = 'plan-casa'),
  2, 'sembrar deja su rastro en el registro'
);

select is(
  (select distinct actor_role from change_log where plan_id = 'plan-casa'),
  'sistema', 'sin sesión, el actor es el sistema'
);

select is(
  (select distinct source from change_log where plan_id = 'plan-casa'),
  'app', 'el origen por defecto es la app'
);

-- ─────────────────────────── El cliente cambia su semana ───────────────────────────

select test_como('11111111-1111-4111-8111-111111111111', 'cliente@ejemplo.test');

-- Un intercambio: las dos celdas en la MISMA sentencia, como hace writeCellUpserts.
insert into week_overrides (plan_id, week_start, day, slot, scope, block_id) values
  ('plan-casa', '2026-10-12', 0, 'comida', 'shared', 'bloque-martes'),
  ('plan-casa', '2026-10-12', 1, 'comida', 'shared', 'bloque-lunes');

select is(
  (select count(*)::int from change_log where table_name = 'week_overrides'),
  2, 'el intercambio deja dos entradas'
);

select is(
  (select count(distinct tx_id)::int from change_log where table_name = 'week_overrides'),
  1, 'las dos entradas del intercambio comparten transacción (se pueden agrupar)'
);

select is(
  (select distinct actor_role from change_log where table_name = 'week_overrides'),
  'cliente', 'el actor es el cliente'
);

select is(
  (select distinct actor_user_id from change_log where table_name = 'week_overrides'),
  '11111111-1111-4111-8111-111111111111'::uuid,
  'queda registrado QUIÉN lo hizo'
);

select is(
  (select cell->>'slot' from change_log where table_name = 'week_overrides' limit 1),
  'comida', 'la entrada sabe de qué celda habla'
);

-- Nadie reescribe la historia.
--
-- Sin `throws_ok`: RLS deniega los UPDATE y los DELETE **en silencio**, sin error, porque
-- simplemente no encuentra filas que tocar. Esperar una excepción daría la prueba por buena
-- sin comprobar nada. Lo que hay que mirar es que las filas siguen como estaban.
update change_log set actor_role = 'sistema';

select is(
  (select count(*)::int from change_log where actor_role = 'cliente'),
  2, 'un cliente NO puede reescribir el registro (el update no toca ninguna fila)'
);

delete from change_log;

select is(
  (select count(*)::int from change_log),
  4, 'un cliente NO puede borrar el registro (el delete no se lleva nada)'
);

-- ─────────────────────────── Aislamiento entre hogares ───────────────────────────

select test_como('22222222-2222-4222-8222-222222222222', 'otro@ejemplo.test');

select is(
  (select count(*)::int from change_log where plan_id = 'plan-casa'),
  0, 'el cliente de otro hogar NO ve este registro'
);

-- ─────────────────────────── La nutricionista ───────────────────────────

select test_como('33333333-3333-4333-8333-333333333333', 'nutri@ejemplo.test');

update template_cells set block_id = 'bloque-nuevo'
 where plan_id = 'plan-casa' and day = 0 and slot = 'comida' and scope = 'shared';

select is(
  (select actor_role from change_log
    where table_name = 'template_cells' and op = 'UPDATE'
    order by created_at desc limit 1),
  'nutricionista', 'cuando cambia ella, queda como nutricionista'
);

select * from finish();

rollback;
