import type { IconName } from '../../components/Icon';
import type { SlotKey } from '../../domain/schema';

/** Las etiquetas van en mayúsculas: es seña de identidad de la marca (CLAUDE.md). */
export const SLOT_LABEL: Record<SlotKey, string> = {
  desayuno: 'DESAYUNO',
  snack: 'SNACK',
  snack2: 'SNACK 2',
  almuerzo: 'ALMUERZO',
  comida: 'COMIDA',
  cena: 'CENA',
};

export const SLOT_ICON: Record<SlotKey, IconName> = {
  desayuno: 'desayuno',
  snack: 'snack',
  snack2: 'snack',
  almuerzo: 'snack',
  comida: 'cubiertos',
  cena: 'cena',
};

/** Las subsecciones del PDF, que cuelgan de la comida o la cena. */
export const SECTION_LABEL: Record<string, string> = {
  pan: 'PAN',
  postre: 'POSTRE',
  bebida: 'BEBIDA',
  extra: 'EXTRA',
};

/**
 * El ritmo de la tabla del PDF: martes, jueves y sábado con fondo amarillo suave.
 * 0 = lunes … 6 = domingo.
 */
export function isAccentDay(day: number): boolean {
  return day === 1 || day === 3 || day === 5;
}
