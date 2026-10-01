/**
 * Edición de bloques con copia al escribir (CLAUDE.md, regla 6) y restauración.
 *
 * Editar nunca modifica un bloque existente: crea uno nuevo que apunta al original con
 * `originBlockId`. Así "Restaurar original" siempre tiene a dónde volver, y el plan que
 * mandó la nutricionista queda intacto.
 */
import type { IsoDateString } from './dates';
import { weekStartOf } from './dates';
import { cellId } from './resolve';
import type { Block, CellKey, Section, TemplateCell } from './schema';

export type BlockChanges = {
  sections?: Section[];
};

/**
 * Copia el bloque con los cambios aplicados. Al bifurcar una copia, `originBlockId` sigue
 * apuntando al original de verdad, no a la copia intermedia: si no, restaurar devolvería
 * a una versión editada.
 */
export function forkBlock(block: Block, changes: BlockChanges, newId: string): Block {
  const sections = changes.sections ?? block.sections;
  const fork: Block = {
    ...block,
    id: newId,
    sections,
    isOriginal: false,
    originBlockId: block.originBlockId ?? block.id,
  };
  return fork;
}

/** Id del bloque original del que desciende este, o el suyo propio si ya es original. */
export function originOf(block: Block): string {
  return block.originBlockId ?? block.id;
}

export function isModifiedBlock(block: Block): boolean {
  return !block.isOriginal || block.originBlockId !== undefined;
}

export type RestoreLevel = 'week' | 'template';

export type RestoreOptions =
  { level: 'week'; weekStart: IsoDateString } | { level: 'template'; weekStart?: IsoDateString };

/** Claves de las filas a borrar y de las que hay que devolver a su valor original. */
export type RestorePlan = {
  deleteOverrides: { weekStart: IsoDateString; day: number; slot: string; scope: string }[];
  templateCells: TemplateCell[];
};

/**
 * Deshace los cambios de una celda.
 *
 * - "solo esta semana" borra el override y deja ver lo que diga la plantilla.
 * - "todo el plan" borra además el cambio de plantilla, devolviendo la celda al bloque que
 *   traía el plan original. Si también había override de esta semana, se borra: si no, el
 *   cambio semanal seguiría tapando la restauración.
 */
export function restoreCell(
  cell: CellKey,
  originalTemplate: readonly TemplateCell[],
  options: RestoreOptions,
): RestorePlan {
  const key = cellId(cell);
  const original = originalTemplate.find((row) => cellId(row) === key);

  const deleteOverrides =
    options.weekStart === undefined
      ? []
      : [
          {
            weekStart: weekStartOf(options.weekStart),
            day: cell.day,
            slot: cell.slot,
            scope: cell.scope,
          },
        ];

  if (options.level === 'week') {
    return { deleteOverrides, templateCells: [] };
  }

  return {
    deleteOverrides,
    templateCells: [
      { day: cell.day, slot: cell.slot, scope: cell.scope, blockId: original?.blockId ?? null },
    ],
  };
}
