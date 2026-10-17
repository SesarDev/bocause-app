/**
 * Lecturas. Todas pasan por el esquema Zod en los mappers, así que lo que sale de aquí ya
 * son tipos del dominio y se puede meter directo en resolveWeek y compañía.
 *
 * La caché se persiste en IndexedDB (ver queryClient.ts), así que al abrir sin cobertura
 * se ve lo último que había en vez de una pantalla vacía.
 *
 * **Todas filtran por hogar de forma explícita.** Antes no lo hacían: bastaba con que RLS
 * devolviera solo el hogar de quien pregunta. Ese atajo deja de valer en cuanto exista el
 * rol de nutricionista, que ve todos los hogares, porque las mismas consultas empezarían a
 * mezclarlos sin dar ningún error. Ver `scope.ts`.
 *
 * `blocks`, `template_cells` y `week_overrides` se filtran por `plan_id` y no por hogar:
 * un plan pertenece a un único hogar, así que el filtro por plan ya es explícito y más
 * estrecho. Lo que hay que asegurar es que el `planId` venga de `usePlan`, que sí filtra.
 */
import { useQuery } from '@tanstack/react-query';
import { isoWeekDates, todayIn, type IsoDateString } from '../domain/dates';
import { resolveWeek, type ResolvedWeek } from '../domain/resolve';
import type { Check, DailyLog, Plan, ShoppingItem } from '../domain/schema';
import { supabase } from './supabase';
import {
  buildProfileDirectory,
  toBlock,
  toCheck,
  toDailyLog,
  toPlan,
  toProfile,
  toShoppingItem,
  toTemplateCell,
  toWeekOverride,
  type Profile,
  type ProfileDirectory,
} from './mappers';
import { keysFor } from './keys';
import { useActiveHousehold } from './scope';

/* ─────────────────────── Perfiles del hogar ─────────────────────── */

export function useProfiles() {
  const householdId = useActiveHousehold();

  return useQuery({
    queryKey: keysFor(householdId).profiles(),
    enabled: householdId !== null,
    queryFn: async (): Promise<Profile[]> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, user_id, household_id, slug, display_name, portion_multiplier')
        .eq('household_id', householdId!)
        .order('display_name');
      if (error) throw error;
      return (data ?? []).map(toProfile);
    },
  });
}

/** Los ids de perfil del hogar. `checks` y `daily_logs` cuelgan de ahí, no del hogar. */
function useHouseholdProfileIds(): string[] {
  const { data } = useProfiles();
  return (data ?? []).map((profile) => profile.id);
}

/** Traductor slug ↔ UUID. Lo necesitan casi todas las demás consultas. */
export function useProfileDirectory(): ProfileDirectory | undefined {
  const { data } = useProfiles();
  return data ? buildProfileDirectory(data) : undefined;
}

/* ─────────────────────── Plan vigente ─────────────────────── */

/** El plan activo en una fecha. Al cambiar de mes, cada semana usa el suyo. */
export function usePlan(onDate: IsoDateString = todayIn()) {
  const householdId = useActiveHousehold();

  return useQuery({
    queryKey: keysFor(householdId).plan(onDate),
    enabled: householdId !== null,
    queryFn: async (): Promise<Plan | null> => {
      const { data, error } = await supabase
        .from('plans')
        .select('*')
        .eq('household_id', householdId!)
        .eq('status', 'active')
        .lte('valid_from', onDate)
        .or(`valid_to.is.null,valid_to.gte.${onDate}`)
        .order('valid_from', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data ? toPlan(data) : null;
    },
  });
}

/* ─────────────────────── Capas editables ─────────────────────── */

export function useEditedBlocks(planId: string | undefined, scopes: ProfileDirectory | undefined) {
  const householdId = useActiveHousehold();

  return useQuery({
    queryKey: keysFor(householdId).blocks(planId ?? ''),
    enabled: Boolean(planId && scopes),
    queryFn: async () => {
      const { data, error } = await supabase.from('blocks').select('*').eq('plan_id', planId!);
      if (error) throw error;
      return (data ?? []).map((row) => toBlock(row, scopes!));
    },
  });
}

export function useTemplateCells(planId: string | undefined, scopes: ProfileDirectory | undefined) {
  const householdId = useActiveHousehold();

  return useQuery({
    queryKey: keysFor(householdId).templateCells(planId ?? ''),
    enabled: Boolean(planId && scopes),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('template_cells')
        .select('*')
        .eq('plan_id', planId!);
      if (error) throw error;
      return (data ?? []).map((row) => toTemplateCell(row, scopes!));
    },
  });
}

export function useWeekOverrides(
  planId: string | undefined,
  weekStart: IsoDateString,
  scopes: ProfileDirectory | undefined,
) {
  const householdId = useActiveHousehold();

  return useQuery({
    queryKey: keysFor(householdId).weekOverrides(planId ?? '', weekStart),
    enabled: Boolean(planId && scopes),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('week_overrides')
        .select('*')
        .eq('plan_id', planId!)
        .eq('week_start', weekStart);
      if (error) throw error;
      return (data ?? []).map((row) => toWeekOverride(row, scopes!));
    },
  });
}

/**
 * Todos los overrides desde una semana en adelante, no solo los de una.
 *
 * Lo necesita la publicación: `carryOver` arrastra los ajustes del cliente de **todas** las
 * semanas futuras, y dándole solo los de una se perdían los demás sin que nadie lo viera.
 * `useWeekOverrides` sigue existiendo para la app del cliente, que mira una semana cada vez.
 */
export function useOverridesFrom(
  planId: string | undefined,
  fromWeek: IsoDateString,
  scopes: ProfileDirectory | undefined,
) {
  const householdId = useActiveHousehold();

  return useQuery({
    queryKey: [...keysFor(householdId).all, 'overrides-from', planId ?? '', fromWeek] as const,
    enabled: Boolean(planId && scopes),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('week_overrides')
        .select('*')
        .eq('plan_id', planId!)
        .gte('week_start', fromWeek);
      if (error) throw error;
      return (data ?? []).map((row) => toWeekOverride(row, scopes!));
    },
  });
}

/* ─────────────────────── Registro diario ─────────────────────── */

function weekRange(weekStart: IsoDateString): { from: string; to: string } {
  const dates = isoWeekDates(weekStart);
  return { from: dates[0]!, to: dates[6]! };
}

/** Checks de toda la semana y de las dos personas: ambas ven lo de la otra. */
export function useWeekChecks(weekStart: IsoDateString, scopes: ProfileDirectory | undefined) {
  const { from, to } = weekRange(weekStart);
  const householdId = useActiveHousehold();
  const profileIds = useHouseholdProfileIds();

  return useQuery({
    queryKey: keysFor(householdId).checks(weekStart),
    enabled: Boolean(scopes) && profileIds.length > 0,
    queryFn: async (): Promise<Check[]> => {
      const { data, error } = await supabase
        .from('checks')
        .select('*')
        .in('profile_id', profileIds)
        .gte('date', from)
        .lte('date', to);
      if (error) throw error;
      return (data ?? []).map((row) => toCheck(row, scopes!));
    },
  });
}

export function useWeekDailyLogs(weekStart: IsoDateString, scopes: ProfileDirectory | undefined) {
  const { from, to } = weekRange(weekStart);
  const householdId = useActiveHousehold();
  const profileIds = useHouseholdProfileIds();

  return useQuery({
    queryKey: keysFor(householdId).dailyLogs(weekStart),
    enabled: Boolean(scopes) && profileIds.length > 0,
    queryFn: async (): Promise<DailyLog[]> => {
      const { data, error } = await supabase
        .from('daily_logs')
        .select('*')
        .in('profile_id', profileIds)
        .gte('date', from)
        .lte('date', to);
      if (error) throw error;
      return (data ?? []).map((row) => toDailyLog(row, scopes!));
    },
  });
}

export function useShoppingItems(weekStart: IsoDateString) {
  const householdId = useActiveHousehold();

  return useQuery({
    queryKey: keysFor(householdId).shoppingItems(weekStart),
    enabled: householdId !== null,
    queryFn: async (): Promise<ShoppingItem[]> => {
      const { data, error } = await supabase
        .from('shopping_items')
        .select('*')
        .eq('household_id', householdId!)
        .eq('week_start', weekStart);
      if (error) throw error;
      return (data ?? []).map(toShoppingItem);
    },
  });
}

/* ─────────────────────── Composición ─────────────────────── */

export type WeekData = {
  plan: Plan | null;
  week: ResolvedWeek | null;
  isLoading: boolean;
  error: unknown;
  /** Se expone para poder reintentar desde el mensaje de error. */
  planQuery: ReturnType<typeof usePlan>;
};

/**
 * Junta las tres capas y aplica resolveWeek. Es el puente entre la capa de datos y la UI
 * de las fases 5 y 6: la pantalla solo pide una semana y un perfil.
 */
export function useResolvedWeek(
  profileSlug: string | undefined,
  weekStart: IsoDateString,
): WeekData {
  const householdId = useActiveHousehold();
  const scopes = useProfileDirectory();
  const planQuery = usePlan(weekStart);
  const planId = planQuery.data?.id;

  const blocks = useEditedBlocks(planId, scopes);
  const templateCells = useTemplateCells(planId, scopes);
  const overrides = useWeekOverrides(planId, weekStart, scopes);

  // Sin hogar todavía, las consultas están desactivadas: `isLoading` sería false y la
  // pantalla diría "no hay plan" en vez de esperar. Mientras no se sepa, está cargando.
  const isLoading =
    householdId === null ||
    planQuery.isLoading ||
    blocks.isLoading ||
    templateCells.isLoading ||
    overrides.isLoading;
  const error = planQuery.error ?? blocks.error ?? templateCells.error ?? overrides.error;

  const plan = planQuery.data ?? null;
  const ready = plan !== null && profileSlug !== undefined && !isLoading;

  return {
    planQuery,
    plan,
    week: ready
      ? resolveWeek({
          plan,
          profileId: profileSlug,
          weekStart,
          blocks: blocks.data ?? [],
          templateCells: templateCells.data ?? [],
          overrides: overrides.data ?? [],
        })
      : null,
    isLoading,
    error,
  };
}

/** Las dos semanas del hogar, que es lo que necesitan la compra y la vista "Casa". */
export function useHouseholdWeeks(weekStart: IsoDateString): {
  weeks: ResolvedWeek[];
  plan: Plan | null;
  isLoading: boolean;
} {
  const householdId = useActiveHousehold();
  const scopes = useProfileDirectory();
  const planQuery = usePlan(weekStart);
  const planId = planQuery.data?.id;

  const blocks = useEditedBlocks(planId, scopes);
  const templateCells = useTemplateCells(planId, scopes);
  const overrides = useWeekOverrides(planId, weekStart, scopes);

  const plan = planQuery.data ?? null;
  const isLoading =
    householdId === null ||
    planQuery.isLoading ||
    blocks.isLoading ||
    templateCells.isLoading ||
    overrides.isLoading;

  const weeks =
    plan === null || isLoading
      ? []
      : plan.profiles.map((profile) =>
          resolveWeek({
            plan,
            profileId: profile.profileId,
            weekStart,
            blocks: blocks.data ?? [],
            templateCells: templateCells.data ?? [],
            overrides: overrides.data ?? [],
          }),
        );

  return { weeks, plan, isLoading };
}
