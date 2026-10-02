/**
 * Lecturas. Todas pasan por el esquema Zod en los mappers, así que lo que sale de aquí ya
 * son tipos del dominio y se puede meter directo en resolveWeek y compañía.
 *
 * La caché se persiste en IndexedDB (ver queryClient.ts), así que al abrir sin cobertura
 * se ve lo último que había en vez de una pantalla vacía.
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

export const keys = {
  all: ['bocause'] as const,
  profiles: () => [...keys.all, 'profiles'] as const,
  plan: (onDate: string) => [...keys.all, 'plan', onDate] as const,
  blocks: (planId: string) => [...keys.all, 'blocks', planId] as const,
  templateCells: (planId: string) => [...keys.all, 'template-cells', planId] as const,
  weekOverrides: (planId: string, weekStart: string) =>
    [...keys.all, 'week-overrides', planId, weekStart] as const,
  checks: (weekStart: string) => [...keys.all, 'checks', weekStart] as const,
  dailyLogs: (weekStart: string) => [...keys.all, 'daily-logs', weekStart] as const,
  shoppingItems: (weekStart: string) => [...keys.all, 'shopping-items', weekStart] as const,
};

/* ─────────────────────── Perfiles del hogar ─────────────────────── */

export function useProfiles() {
  return useQuery({
    queryKey: keys.profiles(),
    queryFn: async (): Promise<Profile[]> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, user_id, household_id, slug, display_name')
        .order('display_name');
      if (error) throw error;
      return (data ?? []).map(toProfile);
    },
  });
}

/** Traductor slug ↔ UUID. Lo necesitan casi todas las demás consultas. */
export function useProfileDirectory(): ProfileDirectory | undefined {
  const { data } = useProfiles();
  return data ? buildProfileDirectory(data) : undefined;
}

/* ─────────────────────── Plan vigente ─────────────────────── */

/** El plan activo en una fecha. Al cambiar de mes, cada semana usa el suyo. */
export function usePlan(onDate: IsoDateString = todayIn()) {
  return useQuery({
    queryKey: keys.plan(onDate),
    queryFn: async (): Promise<Plan | null> => {
      const { data, error } = await supabase
        .from('plans')
        .select('*')
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
  return useQuery({
    queryKey: keys.blocks(planId ?? ''),
    enabled: Boolean(planId && scopes),
    queryFn: async () => {
      const { data, error } = await supabase.from('blocks').select('*').eq('plan_id', planId!);
      if (error) throw error;
      return (data ?? []).map((row) => toBlock(row, scopes!));
    },
  });
}

export function useTemplateCells(planId: string | undefined, scopes: ProfileDirectory | undefined) {
  return useQuery({
    queryKey: keys.templateCells(planId ?? ''),
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
  return useQuery({
    queryKey: keys.weekOverrides(planId ?? '', weekStart),
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

/* ─────────────────────── Registro diario ─────────────────────── */

function weekRange(weekStart: IsoDateString): { from: string; to: string } {
  const dates = isoWeekDates(weekStart);
  return { from: dates[0]!, to: dates[6]! };
}

/** Checks de toda la semana y de las dos personas: ambas ven lo de la otra. */
export function useWeekChecks(weekStart: IsoDateString, scopes: ProfileDirectory | undefined) {
  const { from, to } = weekRange(weekStart);

  return useQuery({
    queryKey: keys.checks(weekStart),
    enabled: Boolean(scopes),
    queryFn: async (): Promise<Check[]> => {
      const { data, error } = await supabase
        .from('checks')
        .select('*')
        .gte('date', from)
        .lte('date', to);
      if (error) throw error;
      return (data ?? []).map((row) => toCheck(row, scopes!));
    },
  });
}

export function useWeekDailyLogs(weekStart: IsoDateString, scopes: ProfileDirectory | undefined) {
  const { from, to } = weekRange(weekStart);

  return useQuery({
    queryKey: keys.dailyLogs(weekStart),
    enabled: Boolean(scopes),
    queryFn: async (): Promise<DailyLog[]> => {
      const { data, error } = await supabase
        .from('daily_logs')
        .select('*')
        .gte('date', from)
        .lte('date', to);
      if (error) throw error;
      return (data ?? []).map((row) => toDailyLog(row, scopes!));
    },
  });
}

export function useShoppingItems(weekStart: IsoDateString) {
  return useQuery({
    queryKey: keys.shoppingItems(weekStart),
    queryFn: async (): Promise<ShoppingItem[]> => {
      const { data, error } = await supabase
        .from('shopping_items')
        .select('*')
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
};

/**
 * Junta las tres capas y aplica resolveWeek. Es el puente entre la capa de datos y la UI
 * de las fases 5 y 6: la pantalla solo pide una semana y un perfil.
 */
export function useResolvedWeek(
  profileSlug: string | undefined,
  weekStart: IsoDateString,
): WeekData {
  const scopes = useProfileDirectory();
  const planQuery = usePlan(weekStart);
  const planId = planQuery.data?.id;

  const blocks = useEditedBlocks(planId, scopes);
  const templateCells = useTemplateCells(planId, scopes);
  const overrides = useWeekOverrides(planId, weekStart, scopes);

  const isLoading =
    planQuery.isLoading || blocks.isLoading || templateCells.isLoading || overrides.isLoading;
  const error = planQuery.error ?? blocks.error ?? templateCells.error ?? overrides.error;

  const plan = planQuery.data ?? null;
  const ready = plan !== null && profileSlug !== undefined && !isLoading;

  return {
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
  const scopes = useProfileDirectory();
  const planQuery = usePlan(weekStart);
  const planId = planQuery.data?.id;

  const blocks = useEditedBlocks(planId, scopes);
  const templateCells = useTemplateCells(planId, scopes);
  const overrides = useWeekOverrides(planId, weekStart, scopes);

  const plan = planQuery.data ?? null;
  const isLoading =
    planQuery.isLoading || blocks.isLoading || templateCells.isLoading || overrides.isLoading;

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
