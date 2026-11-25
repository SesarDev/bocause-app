-- Bocause Dieta · quién puede ejecutar las funciones de la base de datos
--
-- Se escribe ANTES de la migración 0011 y empieza en rojo.
--
-- Postgres concede EXECUTE a PUBLIC en toda función nueva, y Supabase se lo concede además
-- a `anon` de forma explícita. Por eso `revoke ... from public` (lo que hacían la 0002 y
-- siguientes) no bastaba: `anon` seguía pudiendo llamar a todo, y `profile_household(uuid)`
-- le devolvía el hogar de cualquier perfil sin pedir sesión.
--
-- Sin sesión no hace falta ninguna función: entrar va por la API de Auth, no por RPC.

begin;

create extension if not exists pgtap with schema extensions;

select plan(5);

select is(
  (select count(*)::int
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and has_function_privilege('anon', p.oid, 'execute')),
  0,
  'sin sesión no se puede ejecutar ninguna función de public'
);

select ok(
  not has_function_privilege('anon', 'public.profile_household(uuid)', 'execute'),
  'sin sesión no se puede averiguar el hogar de un perfil'
);

-- Las políticas RLS llaman a estas funciones con el rol de quien consulta: si
-- `authenticated` las perdiera, nadie vería su propia dieta.
select ok(
  has_function_privilege('authenticated', 'public.is_household_member(uuid)', 'execute')
    and has_function_privilege('authenticated', 'public.profile_household(uuid)', 'execute')
    and has_function_privilege('authenticated', 'public.my_profile_id()', 'execute')
    and has_function_privilege('authenticated', 'public.is_staff()', 'execute'),
  'con sesión se siguen pudiendo ejecutar las funciones que usan las políticas'
);

-- Una función que se cree en una migración futura tampoco nace abierta.
create function public.test_funcion_nueva() returns int language sql as $$ select 1 $$;

select ok(
  not has_function_privilege('anon', 'public.test_funcion_nueva()', 'execute'),
  'una función nueva no es ejecutable sin sesión'
);

-- Y lo mismo visto desde fuera, como llegaría una petición sin JWT.
set local role anon;
select throws_ok(
  $$select public.profile_household(gen_random_uuid())$$,
  '42501',
  null,
  'llamar a profile_household sin sesión da permiso denegado'
);
reset role;

select * from finish();

rollback;
