-- Bocause Dieta · el catálogo, la biblioteca y las equivalencias, solo para quien tiene perfil
--
-- El registro con la clave pública sigue abierto porque el alta de clientes desde /admin lo
-- usa (`signUp` en src/data/builder.ts). Con eso, cualquiera puede crearse una cuenta, y la
-- 0007 dejaba leer estas tres tablas a todo `authenticated` (`using (true)`).
--
-- Una cuenta así no tiene perfil ni es staff, y no hay nada que deba ver. Quien sí lo
-- necesita es el cliente (sustituciones, "cambiar por otro de la biblioteca", el chat), que
-- tiene perfil, y la nutricionista. La escritura no cambia: sigue siendo solo de staff.
--
-- Se reescribe la política porque es para quitar permiso (supabase/CLAUDE.md).
-- Pruebas: supabase/tests/library.test.sql.

begin;

do $$
declare t text;
begin
  foreach t in array array['foods', 'library_blocks', 'equivalence_groups'] loop
    execute format('drop policy if exists "read %1$s" on %1$I', t);
    execute format(
      'create policy "read %1$s" on %1$I for select to authenticated
       using ((select my_profile_id()) is not null or (select is_staff()))', t);
  end loop;
end;
$$;

commit;
