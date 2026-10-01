/**
 * Intercambio de bloques entre días (CLAUDE.md, regla 4).
 *
 * Solo se intercambian celdas de la misma franja y el mismo scope: la comida del lunes con
 * la del jueves, sí; la comida con la cena, no. El bloque viaja entero (platos, pan y
 * postre), porque la unidad de intercambio es la celda de la tabla, no el plato.
 *
 * Al ser una sola fila por celda compartida, intercambiar una comida cambia la de los dos
 * automáticamente: no hay nada que duplicar.
 */
import type { IsoDateString } from './dates';
import { weekStartOf } from './dates';
import type { CellKey, TemplateCell, WeekOverride } from './schema';

export type SwapLevel = 'week' | 'template';

/** Celda tal como está ahora mismo, ya resuelta. */
export type SwapCell = {
  cell: CellKey;
  blockId: string | null;
  /** La marca de ingesta libre se queda en el día, no viaja con el bloque. */
  isFree?: boolean;
};

export type SwapError = 'misma-celda' | 'franja-distinta' | 'scope-distinto' | 'ambas-vacias';

export const SWAP_ERROR_TEXT: Record<SwapError, string> = {
  'misma-celda': 'Es la misma celda.',
  'franja-distinta': 'Solo se puede intercambiar dentro de la misma franja.',
  'scope-distinto': 'No se puede intercambiar entre una comida compartida y una individual.',
  'ambas-vacias': 'Las dos celdas están vacías.',
};

export type CellUpsert =
  { level: 'template'; row: TemplateCell } | { level: 'week'; row: WeekOverride };

export type SwapOptions = { level: 'week'; weekStart: IsoDateString } | { level: 'template' };

export type SwapResult =
  | { ok: true; upserts: CellUpsert[]; affectsBothProfiles: boolean }
  | { ok: false; reason: SwapError };

/** Comprueba si dos celdas se pueden intercambiar. null = sí se puede. */
export function swapValidation(a: SwapCell, b: SwapCell): SwapError | null {
  if (a.cell.slot !== b.cell.slot) return 'franja-distinta';
  if (a.cell.scope !== b.cell.scope) return 'scope-distinto';
  if (a.cell.day === b.cell.day) return 'misma-celda';
  if (a.blockId === null && b.blockId === null) return 'ambas-vacias';
  return null;
}

export function canSwap(a: SwapCell, b: SwapCell): boolean {
  return swapValidation(a, b) === null;
}

/**
 * Devuelve las filas a guardar para que a y b queden intercambiadas. Si una está vacía,
 * el intercambio equivale a mover el bloque a esa celda y dejar vacía la de origen.
 */
export function swapCells(a: SwapCell, b: SwapCell, options: SwapOptions): SwapResult {
  const reason = swapValidation(a, b);
  if (reason !== null) return { ok: false, reason };

  const upserts: CellUpsert[] =
    options.level === 'template'
      ? [toTemplateRow(a, b.blockId), toTemplateRow(b, a.blockId)]
      : [toWeekRow(a, b.blockId, options.weekStart), toWeekRow(b, a.blockId, options.weekStart)];

  return { ok: true, upserts, affectsBothProfiles: a.cell.scope === 'shared' };
}

function toTemplateRow(target: SwapCell, blockId: string | null): CellUpsert {
  return {
    level: 'template',
    row: { day: target.cell.day, slot: target.cell.slot, scope: target.cell.scope, blockId },
  };
}

function toWeekRow(target: SwapCell, blockId: string | null, weekStart: IsoDateString): CellUpsert {
  return {
    level: 'week',
    row: {
      weekStart: weekStartOf(weekStart),
      day: target.cell.day,
      slot: target.cell.slot,
      scope: target.cell.scope,
      blockId,
      isFree: target.isFree ?? false,
    },
  };
}
