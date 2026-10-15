/**
 * Operaciones sobre el borrador que se está editando. Son funciones puras que devuelven un
 * bloque nuevo: nada muta el original, que es la regla de copy-on-write del proyecto.
 *
 * Viven en features/ y no en domain/ porque son del editor, no del plan: el dominio no sabe
 * que existe una pantalla con botones de subir y bajar.
 */
import type {
  Block,
  FoodItem,
  Portion,
  ProfileId,
  Section,
  SectionKind,
} from '../../domain/schema';

export const SECTION_KINDS: { kind: SectionKind; label: string }[] = [
  { kind: 'plato', label: 'Plato' },
  { kind: 'pan', label: 'Pan' },
  { kind: 'postre', label: 'Postre' },
  { kind: 'bebida', label: 'Bebida' },
  { kind: 'extra', label: 'Extra' },
];

/**
 * Ids nuevos con un prefijo reconocible: ayuda a leer el JSON cuando algo va mal.
 *
 * El UUID va entero. Antes se recortaba a 8 caracteres, y `blocks.id` es clave primaria
 * **global**, no por hogar: 32 bits bastan con un hogar, pero con los de una consulta
 * entera dos bloques pueden coincidir, y como se guardan con `upsert` la colisión
 * sobrescribiría el bloque de otro cliente sin dar ningún error.
 */
export function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function replaceSection(block: Block, sectionId: string, update: (section: Section) => Section) {
  return {
    ...block,
    sections: block.sections.map((section) =>
      section.id === sectionId ? update(section) : section,
    ),
  };
}

export function setSectionTitle(block: Block, sectionId: string, title: string): Block {
  return replaceSection(block, sectionId, (section) => {
    const next = { ...section };
    if (title.trim() === '') delete next.title;
    else next.title = title;
    return next;
  });
}

export function addSection(block: Block, kind: SectionKind): Block {
  return {
    ...block,
    sections: [...block.sections, { id: newId('sec'), kind, items: [] }],
  };
}

export function removeSection(block: Block, sectionId: string): Block {
  return { ...block, sections: block.sections.filter((section) => section.id !== sectionId) };
}

export function moveSection(block: Block, sectionId: string, delta: number): Block {
  const index = block.sections.findIndex((section) => section.id === sectionId);
  const target = index + delta;
  if (index < 0 || target < 0 || target >= block.sections.length) return block;

  const sections = [...block.sections];
  const [moved] = sections.splice(index, 1);
  sections.splice(target, 0, moved!);
  return { ...block, sections };
}

export function addItem(block: Block, sectionId: string, profileIds: ProfileId[]): Block {
  const portions: Record<ProfileId, Portion> = {};
  for (const profileId of profileIds) portions[profileId] = {};

  return replaceSection(block, sectionId, (section) => ({
    ...section,
    items: [...section.items, { id: newId('item'), label: '', portions }],
  }));
}

export function removeItem(block: Block, sectionId: string, itemId: string): Block {
  return replaceSection(block, sectionId, (section) => ({
    ...section,
    items: section.items.filter((item) => item.id !== itemId),
  }));
}

export function moveItem(block: Block, sectionId: string, itemId: string, delta: number): Block {
  return replaceSection(block, sectionId, (section) => {
    const index = section.items.findIndex((item) => item.id === itemId);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= section.items.length) return section;

    const items = [...section.items];
    const [moved] = items.splice(index, 1);
    items.splice(target, 0, moved!);
    return { ...section, items };
  });
}

export function updateItem(
  block: Block,
  sectionId: string,
  itemId: string,
  update: (item: FoodItem) => FoodItem,
): Block {
  return replaceSection(block, sectionId, (section) => ({
    ...section,
    items: section.items.map((item) => (item.id === itemId ? update(item) : item)),
  }));
}

export type PortionField = 'rawG' | 'cookedG' | 'ml' | 'units';

/** Un campo vacío borra la clave: el esquema no admite `undefined` explícito ni ceros. */
export function setPortionNumber(
  item: FoodItem,
  profileId: ProfileId,
  field: PortionField,
  raw: string,
): FoodItem {
  const portion = { ...(item.portions[profileId] ?? {}) };
  const value = Number(raw.replace(',', '.'));

  if (raw.trim() === '' || !Number.isFinite(value) || value <= 0) delete portion[field];
  else portion[field] = value;

  return { ...item, portions: { ...item.portions, [profileId]: portion } };
}

export function setPortionMeasure(item: FoodItem, profileId: ProfileId, measure: string): FoodItem {
  const portion = { ...(item.portions[profileId] ?? {}) };
  if (measure.trim() === '') delete portion.measure;
  else portion.measure = measure;

  return { ...item, portions: { ...item.portions, [profileId]: portion } };
}

/** Quien no tiene ración, no come ese alimento (así lo entiende resolveWeek). */
export function toggleEater(item: FoodItem, profileId: ProfileId, eats: boolean): FoodItem {
  const portions = { ...item.portions };
  if (eats) portions[profileId] = portions[profileId] ?? {};
  else delete portions[profileId];
  return { ...item, portions };
}

export function copyPortion(item: FoodItem, from: ProfileId, to: ProfileId): FoodItem {
  const source = item.portions[from];
  if (!source) return item;
  return { ...item, portions: { ...item.portions, [to]: { ...source } } };
}

/** Bloque vacío para una celda que no tenía nada. */
export function emptyBlock(
  planId: string,
  slot: Block['slot'],
  scope: Block['scope'],
  profileIds: ProfileId[],
): Block {
  const portions: Record<ProfileId, Portion> = {};
  for (const profileId of profileIds) portions[profileId] = {};

  return {
    id: newId('bloque'),
    planId,
    slot,
    scope,
    isOriginal: false,
    sections: [
      { id: newId('sec'), kind: 'plato', items: [{ id: newId('item'), label: '', portions }] },
    ],
  };
}
