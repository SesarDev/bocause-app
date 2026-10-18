-- Bocause Dieta · quién es quién, sin elegirlo uno mismo
--
-- Hasta la 0010, entrar y decir "soy Cristina" eran dos pasos: el enlace mágico te
-- identificaba y luego tú elegías perfil de una lista. Eso tenía dos problemas: cualquiera
-- que entrase podía ocupar un perfil libre, y la propia idea de elegir quién eres no se
-- sostiene fuera de una casa con dos personas de confianza.
--
-- A partir de aquí **el perfil lo asigna la nutricionista al crear la cuenta**. No hay nada
-- que elegir, y por eso las funciones de reclamar perfil desaparecen.

begin;

create extension if not exists pgtap with schema extensions;

select plan(10);

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
   'authenticated', 'authenticated', 'cristina@bocause.local', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '33333333-3333-4333-8333-333333333333',
   'authenticated', 'authenticated', 'nutri1@bocause.local', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '44444444-4444-4444-8444-444444444444',
   'authenticated', 'authenticated', 'recienllegado@bocause.local', now(), now());

insert into households (id, name) values
  ('cccccccc-0000-4000-8000-000000000001', 'Casa de prueba');

insert into profiles (id, user_id, household_id, slug, display_name) values
  ('cccccccc-1111-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
   'cccccccc-0000-4000-8000-000000000001', 'cristina', 'Cristina');

insert into staff_members (user_id, display_name) values
  ('33333333-3333-4333-8333-333333333333', 'Nutri 1');

-- ─────────────────── Ya no se puede elegir perfil ───────────────────

select hasnt_function(
  'public', 'claim_profile', array['uuid'],
  'nadie puede ocupar un perfil: lo asigna la nutricionista'
);

select hasnt_function(
  'public', 'available_profiles', array[]::text[],
  'ya no hay lista de perfiles libres que ofrecer'
);

select hasnt_function(
  'public', 'release_my_profile', array[]::text[],
  'soltar el perfil tampoco: dejaría la cuenta sin dueño y sin forma de recuperarla'
);

-- ─────────────────── Una cuenta recién creada no ve nada ───────────────────

select test_como('44444444-4444-4444-8444-444444444444', 'recienllegado@bocause.local');

select is(
  (select count(*) from profiles),
  0::bigint,
  'quien entra sin perfil asignado no ve a nadie, ni para elegir'
);

select is(
  (select count(*) from households),
  0::bigint,
  'ni ningún hogar'
);

-- ─────────────────── Enlazar cuenta y perfil es cosa de staff ───────────────────

select throws_ok(
  $$select staff_upsert_profile(
      'cccccccc-0000-4000-8000-000000000001', 'intruso', 'Intruso',
      null, 1, '44444444-4444-4444-8444-444444444444')$$,
  '42501',
  null,
  'un cliente no puede crearse un perfil ni enlazárselo a su cuenta'
);

select test_como('33333333-3333-4333-8333-333333333333', 'nutri1@bocause.local');

select lives_ok(
  $$select staff_upsert_profile(
      'cccccccc-0000-4000-8000-000000000001', 'marta', 'Marta',
      null, 0.75, '44444444-4444-4444-8444-444444444444')$$,
  'la nutricionista crea el perfil y lo deja enlazado a la cuenta'
);

select is(
  (select user_id from profiles where slug = 'marta'),
  '44444444-4444-4444-8444-444444444444'::uuid,
  'el perfil queda a nombre de esa cuenta, sin que nadie elija nada'
);

-- Dos perfiles para la misma cuenta serían dos vidas paralelas: los checks y el chat
-- cuelgan del perfil, y la app solo mira el primero que encuentra.
select throws_ok(
  $$select staff_upsert_profile(
      'cccccccc-0000-4000-8000-000000000001', 'otra', 'Otra',
      null, 1, '44444444-4444-4444-8444-444444444444')$$,
  '23505',
  null,
  'una cuenta no puede tener dos perfiles'
);

-- Editar un perfil sin tocar su cuenta: el enlace que ya tenía se conserva.
select staff_upsert_profile(
  'cccccccc-0000-4000-8000-000000000001', 'marta', 'Marta García', null, 0.8
);

select is(
  (select user_id from profiles where slug = 'marta'),
  '44444444-4444-4444-8444-444444444444'::uuid,
  'editar el perfil sin pasar cuenta no lo deja huérfano'
);

select * from finish();
rollback;
