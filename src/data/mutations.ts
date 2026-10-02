/**
 * Escrituras, todas optimistas: la pantalla cambia al tocar y la red va detrás.
 *
 * Las mutaciones se registran como `mutationDefaults` en vez de pasar la función a cada
 * `useMutation`. Es lo que permite que una mutación hecha sin cobertura sobreviva a cerrar
 * la app: al persistir la caché solo se guarda la clave y las variables, así que al volver
 * a abrir el cliente necesita encontrar la función por su clave para reanudarla.
 */
import { useMutation, type QueryClient } from '@tanstack/react-query';
import type { Block, Check, DailyLog, TemplateCell, WeekOverride } from '../domain/schema';
import type { CellUpsert } from '../domain/swap';
import type { RestorePlan } from '../domain/edit';
import { supabase } from './supabase';
import {
  buildProfileDirectory,
  fromBlock,
  fromTemplateCell,
  fromWeekOverride,
  type Profile,
  type ProfileDirectory,
} from './mappers';
import { keys } from './queries';

export const mutationKeys = {
  setCheck: [...keys.all, 'mutation', 'set-check'] as const,
  updateDailyLog: [...keys.all, 'mutation', 'update-daily-log'] as const,
  applyCells: [...keys.all, 'mutation', 'apply-cells'] as const,
  restoreCell: [...keys.all, 'mutation', 'restore-cell'] as const,
  saveBlock: [...keys.all, 'mutation', 'save-block'] as const,
};

/** El directorio sale de la caché, que está persistida: también funciona sin red. */
function directoryFrom(queryClient: QueryClient): ProfileDirectory {
  const profiles = queryClient.getQueryData<Profile[]>(keys.profiles());
  if (!profiles) throw new Error('Todavía no se han cargado los perfiles del hogar');
  return buildProfileDirectory(profiles);
}

/* ─────────────────────── Variables ─────────────────────── */

export type SetCheckVars = {
  weekStart: string;
  profileSlug: string;
  date: string;
  slot: Check['slot'];
  itemId: string;
  checked: boolean;
};

export type UpdateDailyLogVars = {
  weekStart: string;
  profileSlug: string;
  date: string;
  patch: Partial<Pick<DailyLog, 'waterMl' | 'aoveSpoons' | 'comodinDone' | 'comodinOptionId'>>;
};

export type OverrideKey = { weekStart: string; day: number; slot: string; scope: string };

export type ApplyCellsVars = {
  planId: string;
  weekStart: string;
  upserts: CellUpsert[];
  /**
   * Overrides a borrar. Hace falta para deshacer bien: si la celda no tenía override antes
   * del cambio, volver a escribirlo dejaría la celda marcada como "modificada esta semana"
   * cuando en realidad venía del plan original.
   */
  deleteOverrides?: OverrideKey[];
};

export type RestoreCellVars = {
  planId: string;
  weekStart: string;
  plan: RestorePlan;
};

export type SaveBlockVars = {
  planId: string;
  weekStart: string;
  block: Block;
  /** Dónde engancharlo: la celda pasa a apuntar al bloque nuevo. */
  upserts: CellUpsert[];
};

/* ─────────────────────── Registro ─────────────────────── */

export function registerMutationDefaults(queryClient: QueryClient): void {
  /* Check por alimento */
  queryClient.setMutationDefaults(mutationKeys.setCheck, {
    mutationFn: async (vars: SetCheckVars) => {
      const scopes = directoryFrom(queryClient);
      const { error } = await supabase.from('checks').upsert(
        {
          profile_id: scopes.toDbScope(vars.profileSlug),
          date: vars.date,
          slot: vars.slot,
          item_id: vars.itemId,
          checked: vars.checked,
        },
        { onConflict: 'profile_id,date,slot,item_id' },
      );
      if (error) throw error;
    },
    onMutate: async (vars: SetCheckVars) => {
      const key = keys.checks(vars.weekStart);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Check[]>(key);

      queryClient.setQueryData<Check[]>(key, (current = []) => {
        const rest = current.filter(
          (check) =>
            !(
              check.profileId === vars.profileSlug &&
              check.date === vars.date &&
              check.slot === vars.slot &&
              check.itemId === vars.itemId
            ),
        );
        return [
          ...rest,
          {
            profileId: vars.profileSlug,
            date: vars.date,
            slot: vars.slot,
            itemId: vars.itemId,
            checked: vars.checked,
          },
        ];
      });

      return { previous, key };
    },
    onError: (_error, _vars, context) => {
      const ctx = context as { previous?: Check[]; key?: readonly unknown[] } | undefined;
      if (ctx?.key) queryClient.setQueryData(ctx.key, ctx.previous);
    },
    onSettled: (_data, _error, vars: SetCheckVars) => {
      void queryClient.invalidateQueries({ queryKey: keys.checks(vars.weekStart) });
    },
  });

  /* Agua, aceite y comodín */
  queryClient.setMutationDefaults(mutationKeys.updateDailyLog, {
    mutationFn: async (vars: UpdateDailyLogVars) => {
      const scopes = directoryFrom(queryClient);
      const current = queryClient
        .getQueryData<DailyLog[]>(keys.dailyLogs(vars.weekStart))
        ?.find((log) => log.profileId === vars.profileSlug && log.date === vars.date);

      const merged = { ...emptyLog(vars.profileSlug, vars.date), ...current, ...vars.patch };
      const { error } = await supabase.from('daily_logs').upsert(
        {
          profile_id: scopes.toDbScope(vars.profileSlug),
          date: vars.date,
          comodin_option_id: merged.comodinOptionId,
          comodin_done: merged.comodinDone,
          water_ml: merged.waterMl,
          aove_spoons: merged.aoveSpoons,
        },
        { onConflict: 'profile_id,date' },
      );
      if (error) throw error;
    },
    onMutate: async (vars: UpdateDailyLogVars) => {
      const key = keys.dailyLogs(vars.weekStart);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<DailyLog[]>(key);

      queryClient.setQueryData<DailyLog[]>(key, (current = []) => {
        const existing = current.find(
          (log) => log.profileId === vars.profileSlug && log.date === vars.date,
        );
        const next = { ...emptyLog(vars.profileSlug, vars.date), ...existing, ...vars.patch };
        return [...current.filter((log) => log !== existing), next];
      });

      return { previous, key };
    },
    onError: (_error, _vars, context) => {
      const ctx = context as { previous?: DailyLog[]; key?: readonly unknown[] } | undefined;
      if (ctx?.key) queryClient.setQueryData(ctx.key, ctx.previous);
    },
    onSettled: (_data, _error, vars: UpdateDailyLogVars) => {
      void queryClient.invalidateQueries({ queryKey: keys.dailyLogs(vars.weekStart) });
    },
  });

  /* Intercambios e ingestas libres: filas de plantilla o de semana */
  queryClient.setMutationDefaults(mutationKeys.applyCells, {
    mutationFn: async (vars: ApplyCellsVars) => {
      await deleteOverrideRows(queryClient, vars.planId, vars.deleteOverrides ?? []);
      await writeCellUpserts(queryClient, vars.planId, vars.upserts);
    },
    onMutate: (vars: ApplyCellsVars) => applyCellsOptimistically(queryClient, vars),
    onError: (_error, _vars, context) => rollback(queryClient, context),
    onSettled: (_data, _error, vars: ApplyCellsVars) => {
      void queryClient.invalidateQueries({ queryKey: keys.templateCells(vars.planId) });
      void queryClient.invalidateQueries({
        queryKey: keys.weekOverrides(vars.planId, vars.weekStart),
      });
    },
  });

  /* Restaurar original */
  queryClient.setMutationDefaults(mutationKeys.restoreCell, {
    mutationFn: async (vars: RestoreCellVars) => {
      const scopes = directoryFrom(queryClient);

      for (const key of vars.plan.deleteOverrides) {
        const { error } = await supabase
          .from('week_overrides')
          .delete()
          .eq('plan_id', vars.planId)
          .eq('week_start', key.weekStart)
          .eq('day', key.day)
          .eq('slot', key.slot)
          .eq('scope', scopes.toDbScope(key.scope));
        if (error) throw error;
      }

      if (vars.plan.templateCells.length > 0) {
        const rows = vars.plan.templateCells.map((cell) =>
          fromTemplateCell(cell, vars.planId, scopes, null),
        );
        const { error } = await supabase
          .from('template_cells')
          .upsert(rows, { onConflict: 'plan_id,day,slot,scope' });
        if (error) throw error;
      }
    },
    onSettled: (_data, _error, vars: RestoreCellVars) => {
      void queryClient.invalidateQueries({ queryKey: keys.templateCells(vars.planId) });
      void queryClient.invalidateQueries({
        queryKey: keys.weekOverrides(vars.planId, vars.weekStart),
      });
    },
  });

  /* Guardar un bloque copiado (copy-on-write) y apuntar la celda a él */
  queryClient.setMutationDefaults(mutationKeys.saveBlock, {
    mutationFn: async (vars: SaveBlockVars) => {
      const scopes = directoryFrom(queryClient);
      const { data: userData } = await supabase.auth.getUser();
      const me = queryClient
        .getQueryData<Profile[]>(keys.profiles())
        ?.find((profile) => profile.userId === userData.user?.id);

      const { error } = await supabase
        .from('blocks')
        .upsert(fromBlock(vars.block, scopes, me?.id ?? null));
      if (error) throw error;

      await writeCellUpserts(queryClient, vars.planId, vars.upserts);
    },
    onSettled: (_data, _error, vars: SaveBlockVars) => {
      void queryClient.invalidateQueries({ queryKey: keys.blocks(vars.planId) });
      void queryClient.invalidateQueries({ queryKey: keys.templateCells(vars.planId) });
      void queryClient.invalidateQueries({
        queryKey: keys.weekOverrides(vars.planId, vars.weekStart),
      });
    },
  });
}

function emptyLog(profileId: string, date: string): DailyLog {
  return {
    profileId,
    date,
    comodinOptionId: null,
    comodinDone: false,
    waterMl: 0,
    aoveSpoons: 0,
  };
}

async function deleteOverrideRows(
  queryClient: QueryClient,
  planId: string,
  keys: readonly OverrideKey[],
): Promise<void> {
  if (keys.length === 0) return;
  const scopes = directoryFrom(queryClient);

  for (const key of keys) {
    const { error } = await supabase
      .from('week_overrides')
      .delete()
      .eq('plan_id', planId)
      .eq('week_start', key.weekStart)
      .eq('day', key.day)
      .eq('slot', key.slot)
      .eq('scope', scopes.toDbScope(key.scope));
    if (error) throw error;
  }
}

async function writeCellUpserts(
  queryClient: QueryClient,
  planId: string,
  upserts: CellUpsert[],
): Promise<void> {
  const scopes = directoryFrom(queryClient);

  const templateRows = upserts
    .filter((upsert) => upsert.level === 'template')
    .map((upsert) => fromTemplateCell(upsert.row as TemplateCell, planId, scopes, null));

  const weekRows = upserts
    .filter((upsert) => upsert.level === 'week')
    .map((upsert) => fromWeekOverride(upsert.row as WeekOverride, planId, scopes, null));

  if (templateRows.length > 0) {
    const { error } = await supabase
      .from('template_cells')
      .upsert(templateRows, { onConflict: 'plan_id,day,slot,scope' });
    if (error) throw error;
  }

  if (weekRows.length > 0) {
    const { error } = await supabase
      .from('week_overrides')
      .upsert(weekRows, { onConflict: 'plan_id,week_start,day,slot,scope' });
    if (error) throw error;
  }
}

type CellSnapshot = {
  templateKey: readonly unknown[];
  weekKey: readonly unknown[];
  template?: TemplateCell[];
  week?: WeekOverride[];
};

function applyCellsOptimistically(queryClient: QueryClient, vars: ApplyCellsVars): CellSnapshot {
  const templateKey = keys.templateCells(vars.planId);
  const weekKey = keys.weekOverrides(vars.planId, vars.weekStart);
  const snapshot: CellSnapshot = {
    templateKey,
    weekKey,
    template: queryClient.getQueryData<TemplateCell[]>(templateKey),
    week: queryClient.getQueryData<WeekOverride[]>(weekKey),
  };

  const sameCell =
    (a: { day: number; slot: string; scope: string }) =>
    (b: { day: number; slot: string; scope: string }) =>
      a.day === b.day && a.slot === b.slot && a.scope === b.scope;

  for (const key of vars.deleteOverrides ?? []) {
    queryClient.setQueryData<WeekOverride[]>(weekKey, (current = []) =>
      current.filter(
        (row) => !(row.day === key.day && row.slot === key.slot && row.scope === key.scope),
      ),
    );
  }

  for (const upsert of vars.upserts) {
    if (upsert.level === 'template') {
      queryClient.setQueryData<TemplateCell[]>(templateKey, (current = []) => [
        ...current.filter((cell) => !sameCell(upsert.row)(cell)),
        upsert.row,
      ]);
    } else {
      queryClient.setQueryData<WeekOverride[]>(weekKey, (current = []) => [
        ...current.filter((row) => !sameCell(upsert.row)(row)),
        upsert.row,
      ]);
    }
  }

  return snapshot;
}

function rollback(queryClient: QueryClient, context: unknown): void {
  const snapshot = context as CellSnapshot | undefined;
  if (!snapshot) return;
  queryClient.setQueryData(snapshot.templateKey, snapshot.template);
  queryClient.setQueryData(snapshot.weekKey, snapshot.week);
}

/* ─────────────────────── Hooks ─────────────────────── */

export const useSetCheck = () =>
  useMutation<void, Error, SetCheckVars>({ mutationKey: mutationKeys.setCheck });
export const useUpdateDailyLog = () =>
  useMutation<void, Error, UpdateDailyLogVars>({ mutationKey: mutationKeys.updateDailyLog });
export const useApplyCells = () =>
  useMutation<void, Error, ApplyCellsVars>({ mutationKey: mutationKeys.applyCells });
export const useRestoreCell = () =>
  useMutation<void, Error, RestoreCellVars>({ mutationKey: mutationKeys.restoreCell });
export const useSaveBlock = () =>
  useMutation<void, Error, SaveBlockVars>({ mutationKey: mutationKeys.saveBlock });
