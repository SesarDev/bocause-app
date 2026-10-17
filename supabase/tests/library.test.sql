-- Bocause Dieta · permisos del catálogo, la biblioteca y las equivalencias
--
-- Son tablas de la consulta, no de un hogar: cualquiera que haya entrado puede leerlas
-- (el cliente las necesita para sustituir alimentos y para el chat), pero solo la
-- nutricionista las escribe. Si un cliente pudiera tocarlas, cambiaría las equivalencias
-- que gobiernan su propia dieta.

begin;

create extension if not exists pgtap with schema extensions;

select plan(9);

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

insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-4111-8111-111111111111',
   'authenticated', 'authenticated', 'cliente@ejemplo.test', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '33333333-3333-4333-8333-333333333333',
   'authenticated', 'authenticated', 'nutri@ejemplo.test', now(), now());

insert into staff_members (user_id, display_name) values
  ('33333333-3333-4333-8333-333333333333', 'Nutricionista de prueba');

insert into foods (key, name, section, unit) values
  ('lentejas', 'Lentejas', 'despensa', 'g'),
  ('garbanzos', 'Garbanzos', 'despensa', 'g');

insert into equivalence_groups (id, name, members) values
  ('cccccccc-0000-4000-8000-000000000001', 'Legumbres',
   '[{"foodKey":"lentejas","factor":1},{"foodKey":"garbanzos","factor":1}]'::jsonb);

insert into library_blocks (id, name, slots, content) values
  ('dddddddd-0000-4000-8000-000000000001', 'Lentejas con verduras', '{comida}',
   '{"sections":[]}'::jsonb);

-- ─────────────────────────── El cliente lee, no escribe ───────────────────────────

select test_como('11111111-1111-4111-8111-111111111111', 'cliente@ejemplo.test');

-- Se cuentan SOLO las filas de esta prueba, nunca la tabla entera: `supabase test db` corre
-- contra la base local tal como esté, y en cuanto se siembra el catálogo (71 alimentos) una
-- cuenta absoluta falla sin que nada esté roto. Mismo error que ya apareció en los E2E.
select is(
  (select count(*)::int from foods where key in ('lentejas', 'garbanzos')),
  2, 'el cliente ve el catálogo'
);
select is(
  (select count(*)::int from equivalence_groups
    where id = 'cccccccc-0000-4000-8000-000000000001'),
  1, 'el cliente ve las equivalencias'
);
select is(
  (select count(*)::int from library_blocks where id = 'dddddddd-0000-4000-8000-000000000001'),
  1, 'el cliente ve la biblioteca'
);

select throws_ok(
  $$insert into foods (key, name) values ('colado', 'Colado')$$,
  '42501',
  null,
  'un cliente NO puede añadir alimentos al catálogo'
);

select throws_ok(
  $$insert into equivalence_groups (name) values ('Mías')$$,
  '42501',
  null,
  'un cliente NO puede inventarse grupos de equivalencia'
);

-- RLS deniega los UPDATE en silencio: hay que mirar el dato, no esperar excepción.
update equivalence_groups set members = '[]'::jsonb;

select is(
  (select jsonb_array_length(members) from equivalence_groups
    where id = 'cccccccc-0000-4000-8000-000000000001'),
  2, 'un cliente NO puede cambiar las equivalencias de su propia dieta'
);

-- ─────────────────────────── La nutricionista sí ───────────────────────────

select test_como('33333333-3333-4333-8333-333333333333', 'nutri@ejemplo.test');

select lives_ok(
  $$insert into foods (key, name, section) values ('quinoa', 'Quinoa', 'despensa')$$,
  'la nutricionista SÍ puede añadir alimentos'
);

select lives_ok(
  $$update equivalence_groups set description = 'Intercambiables en seco'
     where id = 'cccccccc-0000-4000-8000-000000000001'$$,
  'la nutricionista SÍ puede editar un grupo'
);

select lives_ok(
  $$insert into library_blocks (name, slots, content)
    values ('Tortilla', '{cena}', '{"sections":[]}'::jsonb)$$,
  'la nutricionista SÍ puede guardar en la biblioteca'
);

select * from finish();

rollback;
