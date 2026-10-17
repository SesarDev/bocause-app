-- Bocause Dieta · chat entre cliente y nutricionista
--
-- Un hilo por persona, privado. Lo que Cristina le pregunte a la nutricionista no lo puede
-- leer Andrés, aunque compartan casa y compartan la cena: lo que se habla aquí es cómo te
-- sientes, cómo te sienta algo o cuánto pesas, y eso no es del hogar, es tuyo.
--
-- El hilo es **solo de añadir**: nadie reescribe ni borra lo dicho, ni el cliente ni ella.
-- Un consejo de nutrición editado a posteriori es peor que no tenerlo.

begin;

create extension if not exists pgtap with schema extensions;

select plan(11);

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
   'authenticated', 'authenticated', 'cristina@ejemplo.test', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-4222-8222-222222222222',
   'authenticated', 'authenticated', 'andres@ejemplo.test', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '33333333-3333-4333-8333-333333333333',
   'authenticated', 'authenticated', 'nutri@ejemplo.test', now(), now());

insert into households (id, name) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'Casa de prueba');

insert into profiles (id, user_id, household_id, slug, display_name) values
  ('aaaaaaaa-1111-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
   'aaaaaaaa-0000-4000-8000-000000000001', 'cristina', 'Cristina'),
  ('aaaaaaaa-1111-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222',
   'aaaaaaaa-0000-4000-8000-000000000001', 'andres', 'Andrés');

insert into staff_members (user_id, display_name) values
  ('33333333-3333-4333-8333-333333333333', 'Nutricionista de prueba');

-- ─────────────────────────── Cristina escribe ───────────────────────────

select test_como('11111111-1111-4111-8111-111111111111', 'cristina@ejemplo.test');

select lives_ok(
  $$insert into chat_messages (profile_id, body)
    values ('aaaaaaaa-1111-4000-8000-000000000001', '¿La cena del martes me la puedo saltar?')$$,
  'una clienta puede escribirle a su nutricionista'
);

select is(
  (select author_role from chat_messages
    where profile_id = 'aaaaaaaa-1111-4000-8000-000000000001'),
  'cliente', 'queda claro quién lo dijo'
);

-- Escribir en el hilo de otra persona, ni aunque viva en tu casa.
select throws_ok(
  $$insert into chat_messages (profile_id, body)
    values ('aaaaaaaa-1111-4000-8000-000000000002', 'Firmo como Andrés')$$,
  '42501',
  null,
  'NO se puede escribir en el hilo de otra persona'
);

-- Lo dicho, dicho queda.
update chat_messages set body = 'Me retracto';

select is(
  (select body from chat_messages where profile_id = 'aaaaaaaa-1111-4000-8000-000000000001'),
  '¿La cena del martes me la puedo saltar?',
  'nadie reescribe lo que ya dijo (el update no toca ninguna fila)'
);

delete from chat_messages;

select is(
  (select count(*)::int from chat_messages
    where profile_id = 'aaaaaaaa-1111-4000-8000-000000000001'),
  1, 'ni lo borra'
);

-- ─────────────────────────── Andrés no se entera ───────────────────────────

select test_como('22222222-2222-4222-8222-222222222222', 'andres@ejemplo.test');

select is(
  (select count(*)::int from chat_messages
    where profile_id = 'aaaaaaaa-1111-4000-8000-000000000001'),
  0, 'quien comparte casa NO lee el hilo del otro'
);

-- ─────────────────────────── La nutricionista ───────────────────────────

select test_como('33333333-3333-4333-8333-333333333333', 'nutri@ejemplo.test');

select is(
  (select count(*)::int from chat_messages
    where profile_id = 'aaaaaaaa-1111-4000-8000-000000000001'),
  1, 'la nutricionista sí lee el hilo'
);

select lives_ok(
  $$insert into chat_messages (profile_id, body)
    values ('aaaaaaaa-1111-4000-8000-000000000001', 'Puedes, pero cena algo de proteína.')$$,
  'y puede responder'
);

-- Se busca por el texto y no por `order by created_at desc`: dentro de una transacción
-- `now()` es la misma para todas las filas, así que ordenar por fecha aquí no distingue.
select is(
  (select author_role from chat_messages
    where body = 'Puedes, pero cena algo de proteína.'),
  'nutricionista', 'su respuesta sale firmada como suya'
);

-- ─────────────────────────── Leído hasta ───────────────────────────

select lives_ok(
  $$insert into chat_reads (profile_id, role, last_read_at)
    values ('aaaaaaaa-1111-4000-8000-000000000001', 'nutricionista', now())
    on conflict (profile_id, role) do update set last_read_at = excluded.last_read_at$$,
  'puede marcar hasta dónde ha leído'
);

select test_como('11111111-1111-4111-8111-111111111111', 'cristina@ejemplo.test');

select throws_ok(
  $$insert into chat_reads (profile_id, role, last_read_at)
    values ('aaaaaaaa-1111-4000-8000-000000000002', 'cliente', now())$$,
  '42501',
  null,
  'nadie marca como leído el hilo de otra persona'
);

select * from finish();

rollback;
