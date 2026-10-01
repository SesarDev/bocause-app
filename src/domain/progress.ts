/**
 * Progreso y adherencia a partir de los checks por alimento (CLAUDE.md, regla 8).
 *
 * Una franja está completa cuando están marcados todos SUS alimentos, es decir los de esa
 * persona: el pan que solo come Andrés no cuenta para Cristina. Como la semana resuelta ya
 * viene filtrada por persona, aquí basta con contar lo que hay.
 *
 * Las ingestas libres no entran en el denominador: están previstas por el plan, así que ni
 * suman ni restan adherencia.
 */
import type { ResolvedDay, ResolvedSlot, ResolvedWeek } from './resolve';
import type { Check, ProfileId, SlotKey } from './schema';

export type Progress = {
  total: number;
  done: number;
  /** Proporción 0-1. Una franja sin alimentos vale 0 y no se cuenta como completa. */
  ratio: number;
  complete: boolean;
};

const EMPTY: Progress = { total: 0, done: 0, ratio: 0, complete: false };

function progressOf(total: number, done: number): Progress {
  return {
    total,
    done,
    ratio: total === 0 ? 0 : done / total,
    complete: total > 0 && done === total,
  };
}

/** Índice de checks marcados, para no recorrer el array en cada alimento. */
export class CheckIndex {
  private readonly marked: Set<string>;

  constructor(checks: readonly Check[], profileId: ProfileId) {
    this.marked = new Set(
      checks
        .filter((check) => check.profileId === profileId && check.checked)
        .map((check) => `${check.date}|${check.slot}|${check.itemId}`),
    );
  }

  has(date: string, slot: SlotKey, itemId: string): boolean {
    return this.marked.has(`${date}|${slot}|${itemId}`);
  }
}

export function itemIdsOf(slot: ResolvedSlot): string[] {
  return slot.block?.sections.flatMap((section) => section.items.map((item) => item.id)) ?? [];
}

export function slotProgress(slot: ResolvedSlot, index: CheckIndex): Progress {
  if (slot.isFree) return EMPTY;
  const ids = itemIdsOf(slot);
  const done = ids.filter((itemId) => index.has(slot.date, slot.cell.slot, itemId)).length;
  return progressOf(ids.length, done);
}

export function dayProgress(day: ResolvedDay, index: CheckIndex): Progress {
  let total = 0;
  let done = 0;
  for (const slot of day.slots) {
    const progress = slotProgress(slot, index);
    total += progress.total;
    done += progress.done;
  }
  return progressOf(total, done);
}

export type WeekAdherence = {
  overall: Progress;
  byDay: Progress[];
  bySlot: Partial<Record<SlotKey, Progress>>;
  /** Días con todos sus alimentos marcados, para la racha. */
  completeDays: number;
  freeMeals: number;
};

export function weekAdherence(week: ResolvedWeek, checks: readonly Check[]): WeekAdherence {
  const index = new CheckIndex(checks, week.profileId);

  const byDay = week.days.map((day) => dayProgress(day, index));

  const slotTotals = new Map<SlotKey, { total: number; done: number }>();
  let total = 0;
  let done = 0;
  let freeMeals = 0;

  for (const day of week.days) {
    for (const slot of day.slots) {
      if (slot.isFree) {
        freeMeals += 1;
        continue;
      }
      const progress = slotProgress(slot, index);
      if (progress.total === 0) continue;

      total += progress.total;
      done += progress.done;

      const acc = slotTotals.get(slot.cell.slot) ?? { total: 0, done: 0 };
      acc.total += progress.total;
      acc.done += progress.done;
      slotTotals.set(slot.cell.slot, acc);
    }
  }

  const bySlot: Partial<Record<SlotKey, Progress>> = {};
  for (const [slot, acc] of slotTotals) bySlot[slot] = progressOf(acc.total, acc.done);

  return {
    overall: progressOf(total, done),
    byDay,
    bySlot,
    completeDays: byDay.filter((progress) => progress.complete).length,
    freeMeals,
  };
}
