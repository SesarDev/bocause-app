/**
 * Comparación de un bloque editado con su original, para enseñar qué has cambiado antes de
 * guardar. Es lógica pura: compara contenido, no identidad de objeto.
 */
import type { Block, FoodItem, Portion, ProfileId, Section } from './schema';

export type ItemChange = 'igual' | 'nuevo' | 'cambiado';

export type BlockDiff = {
  /** Estado de cada alimento del bloque editado, por id. */
  items: Map<string, ItemChange>;
  /** Alimentos del original que ya no están. */
  removedItems: FoodItem[];
  /** Títulos de sección que han cambiado, por id de sección. */
  changedTitles: Set<string>;
  removedSections: Section[];
  newSections: Set<string>;
  hasChanges: boolean;
};

function samePortion(a: Portion | undefined, b: Portion | undefined): boolean {
  if (a === undefined || b === undefined) return a === b;
  return (
    a.rawG === b.rawG &&
    a.cookedG === b.cookedG &&
    a.ml === b.ml &&
    a.units === b.units &&
    (a.measure ?? '') === (b.measure ?? '')
  );
}

function samePortions(a: Record<ProfileId, Portion>, b: Record<ProfileId, Portion>): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if (!samePortion(a[key], b[key])) return false;
  }
  return true;
}

function sameItem(a: FoodItem, b: FoodItem): boolean {
  return (
    a.label === b.label &&
    (a.foodKey ?? '') === (b.foodKey ?? '') &&
    (a.note ?? '') === (b.note ?? '') &&
    samePortions(a.portions, b.portions)
  );
}

export function diffBlocks(original: Block | null, draft: Block): BlockDiff {
  const items = new Map<string, ItemChange>();
  const changedTitles = new Set<string>();
  const newSections = new Set<string>();

  const originalItems = new Map<string, FoodItem>();
  const originalSections = new Map<string, Section>();
  for (const section of original?.sections ?? []) {
    originalSections.set(section.id, section);
    for (const item of section.items) originalItems.set(item.id, item);
  }

  const seenItems = new Set<string>();
  const seenSections = new Set<string>();

  for (const section of draft.sections) {
    seenSections.add(section.id);
    const before = originalSections.get(section.id);
    if (!before) newSections.add(section.id);
    else if ((before.title ?? '') !== (section.title ?? '')) changedTitles.add(section.id);

    for (const item of section.items) {
      seenItems.add(item.id);
      const previous = originalItems.get(item.id);
      items.set(item.id, !previous ? 'nuevo' : sameItem(previous, item) ? 'igual' : 'cambiado');
    }
  }

  const removedItems = [...originalItems.entries()]
    .filter(([id]) => !seenItems.has(id))
    .map(([, item]) => item);

  const removedSections = [...originalSections.entries()]
    .filter(([id]) => !seenSections.has(id))
    .map(([, section]) => section);

  const hasChanges =
    removedItems.length > 0 ||
    removedSections.length > 0 ||
    changedTitles.size > 0 ||
    newSections.size > 0 ||
    [...items.values()].some((change) => change !== 'igual') ||
    // Reordenar también cuenta como cambio aunque el contenido sea el mismo.
    draft.sections.map((section) => section.id).join('|') !==
      (original?.sections ?? []).map((section) => section.id).join('|');

  return { items, removedItems, changedTitles, removedSections, newSections, hasChanges };
}

/** Un bloque no se puede guardar sin ningún alimento (PLAN.md, fase 8). */
export function blockIsEmpty(block: Block): boolean {
  return block.sections.every((section) => section.items.length === 0);
}
