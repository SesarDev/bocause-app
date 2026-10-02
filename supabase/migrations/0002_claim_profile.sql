-- Bocause Dieta · vinculación de usuario y perfil
--
-- Problema que resuelve: las políticas de 0001 dejan leer `profiles` solo a quien ya es
-- miembro del hogar (`is_household_member`), y no hay ninguna política de UPDATE sobre la
-- tabla. Un usuario que acaba de entrar con su magic link todavía no tiene perfil, así que
-- no puede ni ver la lista para elegir ni vincularse. Es el huevo y la gallina.
--
-- En vez de abrir la tabla entera, se exponen dos funciones `security definer` que hacen
-- exactamente lo justo: listar los perfiles que te corresponden y ocupar uno libre.

-- Correo autorizado a ocupar cada perfil. Si queda a null, cualquier usuario autenticado
-- puede ocuparlo; conviene rellenarlo antes de desplegar en público.
alter table profiles add column if not exists claim_email text;

comment on column profiles.claim_email is
  'Correo autorizado a vincularse a este perfil. Null = cualquiera autenticado.';

/**
 * Perfiles que este usuario puede ocupar, con su estado. Devuelve el nombre y si está
 * libre; nada más. No expone user_id ni ningún dato del hogar.
 */
create or replace function available_profiles()
returns table (id uuid, slug text, display_name text, taken boolean)
language sql stable security definer set search_path = public as $$
  select p.id, p.slug, p.display_name, p.user_id is not null
  from profiles p
  where auth.uid() is not null
    and (p.claim_email is null or lower(p.claim_email) = lower(auth.jwt() ->> 'email'))
  order by p.display_name;
$$;

/**
 * Ocupa un perfil libre. Falla si ya estaba ocupado, si el usuario ya tiene otro perfil o
 * si el perfil está reservado a otro correo.
 */
create or replace function claim_profile(p_profile_id uuid)
returns profiles
language plpgsql security definer set search_path = public as $$
declare
  claimed profiles;
begin
  if auth.uid() is null then
    raise exception 'Hay que iniciar sesión para elegir perfil';
  end if;

  if exists (select 1 from profiles where user_id = auth.uid()) then
    raise exception 'Este usuario ya tiene un perfil asignado';
  end if;

  update profiles
     set user_id = auth.uid()
   where id = p_profile_id
     and user_id is null
     and (claim_email is null or lower(claim_email) = lower(auth.jwt() ->> 'email'))
  returning * into claimed;

  if claimed.id is null then
    raise exception 'Ese perfil ya está ocupado o no está disponible para tu correo';
  end if;

  return claimed;
end;
$$;

-- Soltar el perfil que tengo (para corregir una elección equivocada).
create or replace function release_my_profile()
returns void
language sql security definer set search_path = public as $$
  update profiles set user_id = null where user_id = auth.uid();
$$;

-- Postgres concede EXECUTE a PUBLIC por defecto, y tanto anon como authenticated heredan
-- de PUBLIC: revocar solo de anon no serviría de nada.
revoke execute on function available_profiles() from public;
revoke execute on function claim_profile(uuid) from public;
revoke execute on function release_my_profile() from public;
grant execute on function available_profiles() to authenticated;
grant execute on function claim_profile(uuid) to authenticated;
grant execute on function release_my_profile() to authenticated;

-- Cada persona puede cambiar su propio tema.
--
-- La política RLS dice QUÉ FILA puede tocar, pero no qué columnas, así que por sí sola
-- dejaría que alguien se cambiase el `slug` (y rompiese el enlace con el plan) o el
-- `claim_email`. El permiso por columna lo limita a `theme`, que es lo único que debe poder
-- cambiar desde la app.
drop policy if exists "update own profile" on profiles;
create policy "update own profile" on profiles for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

revoke update on profiles from authenticated;
grant update (theme) on profiles to authenticated;
