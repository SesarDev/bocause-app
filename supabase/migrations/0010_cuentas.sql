-- Bocause Dieta · cuentas con usuario y contraseña, sin elegir perfil
--
-- Hasta aquí, entrar eran dos pasos: el enlace mágico decía quién eras para Supabase y
-- luego TÚ elegías tu perfil de una lista (0002_claim_profile.sql). Eso valía para una casa
-- con dos personas de confianza, pero no para una consulta: cualquiera que pidiese un
-- enlace podía ocupar un perfil libre, y "elige quién eres" es una pregunta que una app de
-- salud no debería hacer.
--
-- A partir de ahora **la nutricionista crea la cuenta y le asigna el perfil**. Quien entra
-- ya es alguien; no hay nada que elegir. Las tres funciones de reclamar perfil se van: no
-- basta con dejar de llamarlas desde la app, porque siguen siendo una puerta abierta para
-- quien sepa hacer una petición a mano.

begin;

/* ─────────────────────── Fuera el selector de perfil ─────────────────────── */

drop function if exists claim_profile(uuid);
drop function if exists available_profiles();
drop function if exists release_my_profile();

/*
 * Una cuenta, un perfil.
 *
 * Los checks, el chat y el registro cuelgan del perfil, y la app usa el primero que
 * encuentra para esa cuenta. Con dos, la persona tendría dos vidas paralelas y vería una u
 * otra según el orden que devolviese Postgres.
 *
 * Índice parcial: los perfiles sin cuenta (creados antes de dar el alta) siguen pudiendo
 * convivir, porque `null` no choca con nada.
 */
create unique index if not exists profiles_user_id_unico
  on profiles (user_id)
  where user_id is not null;

comment on column profiles.claim_email is
  'Correo interno de la cuenta de esta persona (usuario@dominio). Informativo: quién entra '
  'en qué perfil lo decide user_id, que pone la nutricionista al crear la cuenta.';

/* ─────────────────────── Crear perfil Y enlazarlo ─────────────────────── */

-- La firma cambia (un parámetro más), así que no vale `create or replace`: quedarían las
-- dos y cualquier llamada sería ambigua.
drop function if exists staff_upsert_profile(uuid, text, text, text, numeric);

create function staff_upsert_profile(
  p_household_id uuid,
  p_slug text,
  p_display_name text,
  p_claim_email text default null,
  p_portion_multiplier numeric default 1,
  p_user_id uuid default null
)
returns profiles
language plpgsql security definer set search_path = public as $$
declare
  guardado profiles;
begin
  if not is_staff() then
    raise exception 'Solo la nutricionista puede crear o editar perfiles' using errcode = '42501';
  end if;

  insert into profiles (household_id, slug, display_name, claim_email, portion_multiplier, user_id)
  values (p_household_id, p_slug, p_display_name, p_claim_email, p_portion_multiplier, p_user_id)
  on conflict (household_id, slug) do update
    set display_name = excluded.display_name,
        claim_email = coalesce(excluded.claim_email, profiles.claim_email),
        portion_multiplier = excluded.portion_multiplier,
        -- Sin cuenta nueva se conserva la que había: editar el nombre de alguien no puede
        -- dejarle el perfil huérfano y a esa persona sin poder entrar.
        user_id = coalesce(excluded.user_id, profiles.user_id)
  returning * into guardado;

  return guardado;
end;
$$;

revoke execute on function staff_upsert_profile(uuid, text, text, text, numeric, uuid) from public;
grant execute on function staff_upsert_profile(uuid, text, text, text, numeric, uuid) to authenticated;

commit;
