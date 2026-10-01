/**
 * Ingestas libres: el plan permite un número fijo por semana (CLAUDE.md, regla 9).
 * El contador es por persona, así que se calcula sobre una semana ya resuelta.
 */
import { allSlots, cellId, type ResolvedSlot, type ResolvedWeek } from './resolve';
import type { CellKey, Plan } from './schema';

type FreeMealRules = Pick<Plan['rules'], 'freeMealsPerWeek'>;

export function freeSlots(week: ResolvedWeek): ResolvedSlot[] {
  return allSlots(week).filter((slot) => slot.isFree);
}

export function countFreeMeals(week: ResolvedWeek): number {
  return freeSlots(week).length;
}

export function freeMealsLeft(week: ResolvedWeek, rules: FreeMealRules): number {
  return Math.max(0, rules.freeMealsPerWeek - countFreeMeals(week));
}

/**
 * ¿Se puede marcar esta celda como ingesta libre? Desmarcar siempre se puede, por eso una
 * celda que ya está libre devuelve true aunque se haya agotado el cupo.
 */
export function canMarkFree(week: ResolvedWeek, rules: FreeMealRules, cell?: CellKey): boolean {
  if (cell) {
    const key = cellId(cell);
    const yaLibre = freeSlots(week).some((slot) => cellId(slot.cell) === key);
    if (yaLibre) return true;
  }
  return countFreeMeals(week) < rules.freeMealsPerWeek;
}
