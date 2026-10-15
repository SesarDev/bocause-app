-- Bocause Dieta · asignar sola la versión del plan
--
-- Arregla un fallo de la 0003. Allí se añadió `version int not null default 1` y un índice
-- único `(household_id, version)`. El índice es correcto —dos versiones de la misma dieta
-- no pueden compartir número— pero **nadie asignaba la versión**: toda inserción se quedaba
-- con el 1 por defecto, así que el hogar solo podía tener un plan y publicar el segundo
-- fallaba con clave duplicada.
--
-- Que es exactamente lo contrario de lo que persigue la decisión 2 de docs/PLAN.md: una
-- dieta viva en la que cada publicación crea una versión nueva.
--
-- Lo encontró `supabase/tests/rls.test.sql` al comprobar que la nutricionista puede
-- publicar, antes de que esto llegara a producción.

-- Sin valor por defecto: si no se dice la versión, la pone el trigger. Un BEFORE INSERT
-- corre antes de comprobar el NOT NULL, así que rellenar ahí el nulo es válido.
alter table plans alter column version drop default;

create or replace function assign_plan_version() returns trigger
language plpgsql as $$
begin
  if new.version is null then
    select coalesce(max(version), 0) + 1
      into new.version
      from plans
     where household_id = new.household_id;
  end if;
  return new;
end;
$$;

drop trigger if exists assign_version on plans;
create trigger assign_version before insert on plans
  for each row execute function assign_plan_version();

comment on function assign_plan_version() is
  'Numera cada plan nuevo dentro de su hogar: 1, 2, 3… Solo al insertar; al actualizar un '
  'plan su versión no cambia, porque una versión publicada es una instantánea inmutable.';
