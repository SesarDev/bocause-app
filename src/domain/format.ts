/**
 * Formateo de cantidades para la pantalla. Es lógica pura y se testea como tal: decidir
 * qué número se enseña y cuál se calla tiene más reglas de las que parece.
 */
import type { DayIndex, IsoDateString } from './dates';
import { dayIndexOf, DAY_NAMES } from './dates';
import { quantityOf, type Unit } from './shopping';
import type { FoodItem, Portion, ProfileId } from './schema';

export type FormattedPortion = {
  /** La cantidad medible: "80 g crudo / 160 g cocido", "100 ml". null si no la hay. */
  amount: string | null;
  /** La medida de casa: "3 lonchas finas". null si no la hay. */
  measure: string | null;
};

/**
 * Cuando la medida casera ya dice el número de unidades ("1 unidad mediana"), repetir
 * "1 ud" al lado sobra. La fase 3 dedujo `units` justo de ese texto, así que es el caso
 * normal en toda la fruta.
 */
function unitsAlreadyInMeasure(units: number, measure: string | undefined): boolean {
  if (!measure) return false;
  // "unidad" y "unidades": el singular no acaba en "e", así que el plural es "(es)?"
  // sobre "unidad", no una "s" opcional sobre "unidade".
  const match = /^\s*(\d+)\s*(?:unidad(?:es)?|uds?\.?)\b/i.exec(measure);
  return match !== null && Number(match[1]) === units;
}

export function formatPortion(portion: Portion): FormattedPortion {
  const measure = portion.measure ?? null;

  if (portion.rawG !== undefined && portion.cookedG !== undefined) {
    return { amount: `${portion.rawG} g crudo / ${portion.cookedG} g cocido`, measure };
  }
  if (portion.rawG !== undefined) return { amount: `${portion.rawG} g`, measure };
  if (portion.cookedG !== undefined) return { amount: `${portion.cookedG} g cocido`, measure };
  if (portion.ml !== undefined) return { amount: `${portion.ml} ml`, measure };

  if (portion.units !== undefined) {
    if (unitsAlreadyInMeasure(portion.units, portion.measure)) return { amount: null, measure };
    return { amount: `${portion.units} ud`, measure };
  }

  return { amount: null, measure };
}

/** Cantidad total de un alimento para cocinar entre varias personas. */
export function totalForProfiles(
  item: FoodItem,
  profileIds: readonly ProfileId[],
): { amount: number; unit: Unit } | null {
  let total = 0;
  let unit: Unit | null = null;

  for (const profileId of profileIds) {
    const portion = item.portions[profileId];
    if (!portion) continue;
    const quantity = quantityOf(portion);
    if (quantity === null) continue;
    // Si cada uno lo tiene en una unidad distinta no se pueden sumar.
    if (unit !== null && unit !== quantity.unit) return null;
    unit = quantity.unit;
    total += quantity.amount;
  }

  return unit === null ? null : { amount: total, unit };
}

export function formatTotal(amount: number, unit: Unit): string {
  const rounded = Math.round(amount * 100) / 100;
  return `${rounded.toLocaleString('es-ES')} ${unit === 'ud' ? 'ud' : unit}`;
}

/* ─────────────────────── Fechas para la cabecera del día ─────────────────────── */

/** "LUNES": en mayúsculas porque es seña de identidad de la marca (CLAUDE.md). */
export function dayNameOf(date: IsoDateString): string {
  return (DAY_NAMES[dayIndexOf(date)] ?? '').toLocaleUpperCase('es-ES');
}

const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

/** "28 de septiembre". Sin año: en la vista semana sobra. */
export function shortDateOf(date: IsoDateString): string {
  const [, month, day] = date.split('-');
  const monthName = MONTHS[Number(month) - 1] ?? '';
  return `${Number(day)} de ${monthName}`;
}

export function dayIndexFrom(date: IsoDateString): DayIndex {
  return dayIndexOf(date);
}
