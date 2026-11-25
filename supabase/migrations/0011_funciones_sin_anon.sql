-- Bocause Dieta · ninguna función se ejecuta sin sesión
--
-- Postgres concede EXECUTE a PUBLIC en cada función que se crea, y Supabase se lo concede
-- además a `anon` de forma explícita. Las migraciones anteriores hacían
-- `revoke ... from public` creyendo que con eso `anon` quedaba fuera, y no: tenía su propio
-- permiso. Con la clave pública (que va en el bundle) se podía llamar a las 14 funciones.
--
-- No había una puerta abierta grave, porque las que escriben comprueban `is_staff()` o
-- `auth.uid()` por dentro. Pero `profile_household(uuid)` devolvía el hogar de cualquier
-- perfil sin pedir nada, y depender de que cada función se defienda sola es frágil.
--
-- Sin sesión no hace falta ninguna: entrar va por la API de Auth, no por RPC. Las políticas
-- RLS llaman a estas funciones con el rol de quien consulta, así que `authenticated` las
-- conserva todas. Los triggers no dependen de este permiso: se comprueba al crearlos.
--
-- Pruebas: supabase/tests/permisos.test.sql.

begin;

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;

-- Y las que se creen a partir de ahora nacen igual de cerradas. Son dos niveles: el EXECUTE
-- a PUBLIC es el valor por defecto GLOBAL de Postgres (no se quita con `in schema`), y el de
-- `anon` lo añade Supabase solo en el esquema public.
alter default privileges for role postgres
  revoke execute on functions from public;
alter default privileges for role postgres in schema public
  revoke execute on functions from anon;
alter default privileges for role postgres in schema public
  grant execute on functions to authenticated, service_role;

commit;
