-- Bocause Dieta · publicación de una dieta
--
-- Publicar toca cinco tablas a la vez. Lo que se comprueba aquí es que solo puede hacerlo
-- la nutricionista, que la dieta vieja se cierra el día justo, que la nueva se numera sola
-- y que lo que se arrastra del cliente llega entero.

begin;

create extension if not exists pgtap with schema extensions;

select plan(13);

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

insert into households (id, name) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'Casa de prueba');

insert into profiles (id, user_id, household_id, slug, display_name) values
  ('aaaaaaaa-1111-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
   'aaaaaaaa-0000-4000-8000-000000000001', 'andres', 'Andrés');

insert into staff_members (user_id, display_name) values
  ('33333333-3333-4333-8333-333333333333', 'Nutricionista de prueba');

-- La dieta vigente, abierta (sin valid_to).
insert into plans (id, household_id, name, valid_from, status, data) values
  ('dieta-1', 'aaaaaaaa-0000-4000-8000-000000000001', 'Dieta de octubre',
   '2026-10-05', 'active', '{"name":"Dieta de octubre"}'::jsonb);

insert into diet_drafts (household_id, base_plan_id, data) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'dieta-1', '{"name":"Dieta de noviembre"}'::jsonb);

-- ─────────────────────────── Un cliente no publica ───────────────────────────

select test_como('11111111-1111-4111-8111-111111111111', 'cliente@ejemplo.test');

select throws_ok(
  $$select publish_plan('aaaaaaaa-0000-4000-8000-000000000001', 'colada',
      '{"name":"Mía"}'::jsonb, '2026-11-02'::date)$$,
  '42501',
  null,
  'un cliente NO puede publicar una dieta'
);

select is(
  (select count(*)::int from diet_drafts),
  0, 'un cliente tampoco ve los borradores'
);

-- ─────────────────────────── La nutricionista sí ───────────────────────────

select test_como('33333333-3333-4333-8333-333333333333', 'nutri@ejemplo.test');

select throws_ok(
  $$select publish_plan('aaaaaaaa-0000-4000-8000-000000000001', 'dieta-2',
      '{"name":"Dieta de noviembre"}'::jsonb, '2026-11-04'::date)$$,
  '22023',
  null,
  'una dieta no puede empezar a media semana'
);

select lives_ok(
  $$select publish_plan(
      'aaaaaaaa-0000-4000-8000-000000000001',
      'dieta-2',
      '{"name":"Dieta de noviembre"}'::jsonb,
      '2026-11-02'::date,
      '[{"day":0,"slot":"comida","scope":"shared","block_id":"b-nuevo"}]'::jsonb,
      '{"cells":[{"day":1,"slot":"comida","scope":"shared","block_id":"b-cliente"}],
        "overrides":[{"week_start":"2026-11-09","day":2,"slot":"cena","scope":"shared",
                      "block_id":"b-cliente","is_free":false}]}'::jsonb
    )$$,
  'la nutricionista SÍ puede publicar'
);

select is(
  (select valid_to from plans where id = 'dieta-1'),
  '2026-11-01'::date,
  'la dieta vieja se cierra el día antes de que empiece la nueva'
);

select is(
  (select version from plans where id = 'dieta-2'),
  2, 'la dieta nueva se numera sola como versión 2'
);

select is(
  (select published_by from plans where id = 'dieta-2'),
  '33333333-3333-4333-8333-333333333333'::uuid,
  'queda registrado quién la publicó'
);

select is(
  (select count(*)::int from template_cells where plan_id = 'dieta-2'),
  2, 'se escriben su plantilla y lo arrastrado del cliente'
);

select is(
  (select block_id from template_cells
    where plan_id = 'dieta-2' and day = 1 and slot = 'comida'),
  'b-cliente', 'el cambio del cliente llega a la dieta nueva'
);

select is(
  (select count(*)::int from week_overrides where plan_id = 'dieta-2'),
  1, 'y también sus cambios de semanas futuras'
);

select is(
  (select count(*)::int from diet_drafts
    where household_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  0, 'el borrador desaparece al publicar'
);

-- El registro de cambios (0006) debe saber que esto fue una publicación, no un cambio
-- cualquiera del cliente.
select is(
  (select count(distinct source)::int from change_log where plan_id = 'dieta-2'),
  1, 'todo lo escrito al publicar comparte origen'
);

select is(
  (select distinct source from change_log where plan_id = 'dieta-2'),
  'publicacion', 'y ese origen es "publicacion"'
);

select * from finish();

rollback;
