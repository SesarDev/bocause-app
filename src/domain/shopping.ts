/**
 * Lista de la compra: suma lo que comen los dos en un rango de fechas.
 *
 * Cada semana resuelta viene filtrada a su persona, así que sumar las dos semanas da el
 * total del hogar sin contar dos veces los platos compartidos: de la comida del lunes se
 * coge la ración de Cristina en su semana y la de Andrés en la suya.
 *
 * Qué cantidad se usa, por orden: crudo → cocido → ml → unidades. Lo que no tiene cantidad
 * numérica ("al gusto") o no tiene foodKey no se puede sumar, así que va a una lista aparte
 * en vez de inventarse un número.
 */
import { isSameOrAfter, isBefore, type IsoDateString } from './dates';
import type { ResolvedWeek } from './resolve';
import type { Food, FoodItem, Portion, ProfileId, SupermarketSection } from './schema';

export type { SupermarketSection };
export type Unit = Food['unit'];

export const SECTION_LABEL: Record<SupermarketSection, string> = {
  fruteria: 'Frutería',
  verduleria: 'Verdulería',
  carniceria: 'Carnicería',
  charcuteria: 'Charcutería',
  pescaderia: 'Pescadería',
  lacteos_huevos: 'Lácteos y huevos',
  panaderia: 'Panadería',
  despensa: 'Despensa',
  congelados: 'Congelados',
  suplementos: 'Suplementos',
  otros: 'Otros',
};

/** Orden de recorrido del súper por defecto (configurable en la fase 9). */
export const SECTION_ORDER: readonly SupermarketSection[] = [
  'fruteria',
  'verduleria',
  'carniceria',
  'charcuteria',
  'pescaderia',
  'lacteos_huevos',
  'panaderia',
  'despensa',
  'congelados',
  'suplementos',
  'otros',
];

export type ShoppingLine = {
  foodKey: string;
  label: string;
  section: SupermarketSection;
  unit: Unit;
  total: number;
  /** Desglose por persona, para el detalle al expandir la línea. */
  perProfile: Record<ProfileId, number>;
  dates: IsoDateString[];
};

/** Lo que no se puede sumar: sin foodKey o con medida no numérica. */
export type LooseLine = {
  label: string;
  section: SupermarketSection;
  measures: string[];
  dates: IsoDateString[];
};

export type ShoppingGroup = {
  section: SupermarketSection;
  label: string;
  lines: ShoppingLine[];
};

export type ShoppingList = {
  from: IsoDateString;
  to: IsoDateString | undefined;
  groups: ShoppingGroup[];
  loose: LooseLine[];
};

export type BuildShoppingListInput = {
  /** Semanas ya resueltas, una por persona. */
  weeks: readonly ResolvedWeek[];
  foods: readonly Food[];
  from: IsoDateString;
  /** Exclusivo. Sin él, hasta el final de las semanas recibidas. */
  to?: IsoDateString;
};

/** Cantidad numérica de una ración, con la prioridad crudo → cocido → ml → unidades. */
export function quantityOf(portion: Portion): { amount: number; unit: Unit } | null {
  if (portion.rawG !== undefined) return { amount: portion.rawG, unit: 'g' };
  if (portion.cookedG !== undefined) return { amount: portion.cookedG, unit: 'g' };
  if (portion.ml !== undefined) return { amount: portion.ml, unit: 'ml' };
  if (portion.units !== undefined) return { amount: portion.units, unit: 'ud' };
  return null;
}

export function formatQuantity(total: number, unit: Unit): string {
  const rounded = Math.round(total * 100) / 100;
  const text = rounded.toLocaleString('es-ES');
  return unit === 'ud' ? `${text} ud` : `${text} ${unit}`;
}

export function buildShoppingList(input: BuildShoppingListInput): ShoppingList {
  const { weeks, foods, from, to } = input;
  const foodByKey = new Map(foods.map((food) => [food.key, food]));

  const lines = new Map<string, ShoppingLine>();
  const loose = new Map<string, LooseLine>();

  for (const week of weeks) {
    const profileId = week.profileId;

    for (const day of week.days) {
      for (const slot of day.slots) {
        if (slot.block === null) continue;
        // Una ingesta libre se come fuera del plan: no se compra.
        if (slot.isFree) continue;
        if (!isSameOrAfter(slot.date, from)) continue;
        if (to !== undefined && !isBefore(slot.date, to)) continue;

        for (const section of slot.block.sections) {
          for (const item of section.items) {
            addItem(item, profileId, slot.date, foodByKey, lines, loose);
          }
        }
      }
    }
  }

  const groups = SECTION_ORDER.map((section): ShoppingGroup => ({
    section,
    label: SECTION_LABEL[section],
    lines: [...lines.values()]
      .filter((line) => line.section === section)
      .sort((a, b) => a.label.localeCompare(b.label, 'es')),
  })).filter((group) => group.lines.length > 0);

  return {
    from,
    to,
    groups,
    loose: [...loose.values()].sort((a, b) => a.label.localeCompare(b.label, 'es')),
  };
}

function addItem(
  item: FoodItem,
  profileId: ProfileId,
  date: IsoDateString,
  foodByKey: Map<string, Food>,
  lines: Map<string, ShoppingLine>,
  loose: Map<string, LooseLine>,
): void {
  const portion = item.portions[profileId];
  if (portion === undefined) return;

  const food = item.foodKey === undefined ? undefined : foodByKey.get(item.foodKey);
  const section = food?.section ?? 'otros';
  const quantity = quantityOf(portion);

  if (item.foodKey === undefined || quantity === null) {
    const key = `${item.label}|${section}`;
    const existing = loose.get(key) ?? { label: item.label, section, measures: [], dates: [] };
    if (portion.measure !== undefined && !existing.measures.includes(portion.measure)) {
      existing.measures.push(portion.measure);
    }
    if (!existing.dates.includes(date)) existing.dates.push(date);
    loose.set(key, existing);
    return;
  }

  // La unidad entra en la clave: 2 plátanos y 200 g de plátano no se pueden sumar.
  const key = `${item.foodKey}|${quantity.unit}`;
  const existing = lines.get(key) ?? {
    foodKey: item.foodKey,
    label: food?.name ?? item.label,
    section,
    unit: quantity.unit,
    total: 0,
    perProfile: {},
    dates: [],
  };

  existing.total += quantity.amount;
  existing.perProfile[profileId] = (existing.perProfile[profileId] ?? 0) + quantity.amount;
  if (!existing.dates.includes(date)) existing.dates.push(date);
  lines.set(key, existing);
}

/** Busca una línea concreta, sobre todo para los tests y el detalle de la UI. */
export function findLine(list: ShoppingList, foodKey: string): ShoppingLine | undefined {
  return list.groups.flatMap((group) => group.lines).find((line) => line.foodKey === foodKey);
}
