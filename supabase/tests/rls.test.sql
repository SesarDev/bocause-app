-- Bocause Dieta · pruebas de las políticas RLS
--
-- Se escriben ANTES de la migración 0004 y empiezan en rojo, a propósito: lo que se está
-- probando aquí es quién puede ver y tocar los datos de quién, y eso no se comprueba a ojo.
--
-- Todo ocurre dentro de una transacción que acaba en ROLLBACK: los hogares, los usuarios y
-- los planes de mentira no sobreviven a la prueba. Y corre contra el Supabase LOCAL
-- (`supabase test db`), nunca contra el de casa.
--
-- La identidad se simula como lo hace PostgREST: poniendo el rol `authenticated` y los
-- claims del JWT, que es de donde `auth.uid()` saca el usuario.

begin;

create extension if not exists pgtap with schema extensions;

select plan(17);

-- ─────────────────────────── Identidades de mentira ───────────────────────────

/** Ponerse en la piel de un usuario, igual que haría PostgREST con su JWT. */
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

/** Volver a ser quien monta el escenario (superusuario, sin RLS). */
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
   'authenticated', 'authenticated', 'andres@ejemplo.test', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-4222-8222-222222222222',
   'authenticated', 'authenticated', 'clientedemo@ejemplo.test', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '33333333-3333-4333-8333-333333333333',
   'authenticated', 'authenticated', 'nutri@ejemplo.test', now(), now());

insert into households (id, name) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'Casa de prueba'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'Hogar demo de prueba');

insert into profiles (id, user_id, household_id, slug, display_name) values
  ('aaaaaaaa-1111-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
   'aaaaaaaa-0000-4000-8000-000000000001', 'andres', 'Andrés'),
  ('bbbbbbbb-1111-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222',
   'bbbbbbbb-0000-4000-8000-000000000002', 'cliente-a', 'Cliente A');

insert into plans (id, household_id, name, valid_from, status, data) values
  ('plan-casa', 'aaaaaaaa-0000-4000-8000-000000000001', 'Plan de casa',
   '2026-10-12', 'active', '{}'::jsonb),
  ('plan-demo', 'bbbbbbbb-0000-4000-8000-000000000002', 'Plan demo',
   '2026-10-12', 'active', '{}'::jsonb);

insert into template_cells (plan_id, day, slot, scope, block_id) values
  ('plan-casa', 0, 'comida', 'shared', 'bloque-casa'),
  ('plan-demo', 0, 'comida', 'shared', 'bloque-demo');

insert into checks (profile_id, date, slot, item_id, checked) values
  ('aaaaaaaa-1111-4000-8000-000000000001', '2026-10-12', 'comida', 'item-casa', true);

-- La nutricionista no tiene perfil en ningún hogar: ese es justo el caso.
insert into staff_members (user_id, display_name) values
  ('33333333-3333-4333-8333-333333333333', 'Nutricionista de prueba');

-- ─────────────────────────── Un cliente ve lo suyo y solo lo suyo ───────────────────────────

select test_como('11111111-1111-4111-8111-111111111111', 'andres@ejemplo.test');

select is(
  (select count(*)::int from households where id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  1, 'el cliente ve su hogar'
);

select is(
  (select count(*)::int from households where id = 'bbbbbbbb-0000-4000-8000-000000000002'),
  0, 'el cliente NO ve el otro hogar'
);

select is(
  (select count(*)::int from plans where id = 'plan-demo'),
  0, 'el cliente NO ve el plan del otro hogar'
);

select is(
  (select count(*)::int from template_cells where plan_id = 'plan-demo'),
  0, 'el cliente NO ve las celdas del otro hogar'
);

select is((select is_staff()), false, 'el cliente no es staff');

-- Escribir en `plans` queda cerrado a staff: hasta 0004 lo podía hacer cualquier miembro.
select throws_ok(
  $$insert into plans (id, household_id, name, valid_from, status, data)
    values ('plan-colado', 'aaaaaaaa-0000-4000-8000-000000000001', 'Colado',
            '2026-10-12', 'active', '{}'::jsonb)$$,
  '42501',
  null,
  'un cliente NO puede crear planes'
);

-- Ojo con esta: RLS **no lanza error** al denegar un UPDATE, simplemente no encuentra la
-- fila y actualiza cero. Esperar una excepción daría la prueba por buena sin probar nada.
-- Lo que hay que comprobar es que el dato no ha cambiado.
update plans set name = 'Mío' where id = 'plan-casa';

select is(
  (select name from plans where id = 'plan-casa'),
  'Plan de casa',
  'un cliente NO puede modificar su plan (el update no toca ninguna fila)'
);

-- Lo más importante de todo: que nadie se ascienda solo.
select throws_ok(
  $$insert into staff_members (user_id, display_name)
    values ('11111111-1111-4111-8111-111111111111', 'Yo mismo')$$,
  '42501',
  null,
  'un cliente NO puede hacerse staff'
);

select is(
  (select count(*)::int from template_cells where plan_id = 'plan-casa'),
  1, 'el cliente sí ve las celdas de su hogar'
);

-- ─────────────────────────── El cliente del otro hogar, al revés ───────────────────────────

select test_como('22222222-2222-4222-8222-222222222222', 'clientedemo@ejemplo.test');

select is(
  (select count(*)::int from households where id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  0, 'el cliente demo NO ve la casa de verdad'
);

select is(
  (select count(*)::int from checks where item_id = 'item-casa'),
  0, 'el cliente demo NO ve los checks de la casa de verdad'
);

-- ─────────────────────────── La nutricionista lo ve todo ───────────────────────────

select test_como('33333333-3333-4333-8333-333333333333', 'nutri@ejemplo.test');

select is((select is_staff()), true, 'la nutricionista es staff');

select is(
  (select count(*)::int from households
    where id in ('aaaaaaaa-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000002')),
  2, 'la nutricionista ve los dos hogares'
);

select is(
  (select count(*)::int from plans where id in ('plan-casa', 'plan-demo')),
  2, 'la nutricionista ve los dos planes'
);

select lives_ok(
  $$insert into plans (id, household_id, name, valid_from, status, data)
    values ('plan-nuevo', 'aaaaaaaa-0000-4000-8000-000000000001', 'Publicado por ella',
            '2026-10-19', 'active', '{}'::jsonb)$$,
  'la nutricionista SÍ puede publicar planes'
);

-- La segunda versión de la dieta de un hogar tiene que numerarse sola. Sin esto, el índice
-- único (household_id, version) de la 0003 impedía publicar más de una vez (ver 0005).
select is(
  (select version from plans where id = 'plan-nuevo'),
  2,
  'el plan nuevo se numera solo como versión 2 del hogar'
);

-- Y editar la dieta de un hogar del que no es miembro, que es su trabajo.
select lives_ok(
  $$update template_cells set block_id = 'bloque-cambiado'
     where plan_id = 'plan-demo' and day = 0 and slot = 'comida' and scope = 'shared'$$,
  'la nutricionista SÍ puede editar la dieta de un hogar ajeno'
);

select * from finish();

rollback;
