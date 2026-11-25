-- Bocause Dieta · permisos del catálogo, la biblioteca y las equivalencias
--
-- Son tablas de la consulta, no de un hogar: las lee quien tiene perfil (el cliente las
-- necesita para sustituir alimentos y para el chat) y la nutricionista, pero solo ella las
-- escribe. Si un cliente pudiera tocarlas, cambiaría las equivalencias que gobiernan su
-- propia dieta.
--
-- Quien se registra por su cuenta con la clave pública (el registro sigue abierto porque el
-- alta de clientes desde /admin lo usa) no tiene perfil: no ve nada (0012).

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

insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-4111-8111-111111111111',
   'authenticated', 'authenticated', 'cliente@ejemplo.test', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-4222-8222-222222222222',
   'authenticated', 'authenticated', 'suelto@ejemplo.test', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '33333333-3333-4333-8333-333333333333',
   'authenticated', 'authenticated', 'nutri@ejemplo.test', now(), now());

insert into households (id, name) values
  ('cccccccc-0000-4000-8000-0000000000aa', 'Casa de prueba');

insert into profiles (id, user_id, household_id, slug, display_name) values
  ('cccccccc-1111-4000-8000-0000000000aa', '11111111-1111-4111-8111-111111111111',
   'cccccccc-0000-4000-8000-0000000000aa', 'cliente', 'Cliente');

insert into staff_members (user_id, display_name) values
  ('33333333-3333-4333-8333-333333333333', 'Nutricionista de prueba');

-- Claves propias: la base local puede tener el catálogo sembrado, y `lentejas` chocaría.
insert into foods (key, name, section, unit) values
  ('prueba-lentejas', 'Lentejas', 'despensa', 'g'),
  ('prueba-garbanzos', 'Garbanzos', 'despensa', 'g');

insert into equivalence_groups (id, name, members) values
  ('cccccccc-0000-4000-8000-000000000001', 'Legumbres',
   '[{"foodKey":"prueba-lentejas","factor":1},{"foodKey":"prueba-garbanzos","factor":1}]'::jsonb);

insert into library_blocks (id, name, slots, content) values
  ('dddddddd-0000-4000-8000-000000000001', 'Lentejas con verduras', '{comida}',
   '{"sections":[]}'::jsonb);

-- ─────────────────────────── El cliente lee, no escribe ───────────────────────────

select test_como('11111111-1111-4111-8111-111111111111', 'cliente@ejemplo.test');

-- Se cuentan SOLO las filas de esta prueba, nunca la tabla entera: `supabase test db` corre
-- contra la base local tal como esté, y con el catálogo sembrado una cuenta absoluta falla
-- sin que nada esté roto. Mismo error que ya apareció en los E2E.
select is(
  (select count(*)::int from foods where key in ('prueba-lentejas', 'prueba-garbanzos')),
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
  $$insert into foods (key, name) values ('prueba-colado', 'Colado')$$,
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

-- ─────────────────── Quien se registra por su cuenta no ve nada ───────────────────

select test_como('22222222-2222-4222-8222-222222222222', 'suelto@ejemplo.test');

select is(
  (select count(*)::int from foods where key in ('prueba-lentejas', 'prueba-garbanzos')),
  0, 'una cuenta sin perfil NO ve el catálogo'
);
select is(
  (select count(*)::int from equivalence_groups
    where id = 'cccccccc-0000-4000-8000-000000000001'),
  0, 'una cuenta sin perfil NO ve las equivalencias'
);
select is(
  (select count(*)::int from library_blocks where id = 'dddddddd-0000-4000-8000-000000000001'),
  0, 'una cuenta sin perfil NO ve la biblioteca'
);

-- ─────────────────────────── La nutricionista sí ───────────────────────────

select test_como('33333333-3333-4333-8333-333333333333', 'nutri@ejemplo.test');

select lives_ok(
  $$insert into foods (key, name, section) values ('prueba-quinoa', 'Quinoa', 'despensa')$$,
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
