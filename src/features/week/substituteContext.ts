import { createContext, useContext } from 'react';
import type { Block, FoodItem } from '../../domain/schema';

/**
 * Qué alimentos se pueden cambiar por un equivalente, y cómo abrir esa hoja.
 *
 * Va por contexto, como los checks, porque el alimento está cuatro niveles por debajo de
 * donde viven los grupos de equivalencia y el bloque al que pertenece.
 *
 * `canSubstitute` es falso cuando el alimento no tiene `foodKey`, cuando no está en ningún
 * grupo, o cuando estás mirando el plan de otra persona: cambiar la comida de otro no es
 * cosa tuya.
 */
export type SubstituteApi = {
  canSubstitute: (item: FoodItem) => boolean;
  /** `date` identifica la celda: el día sale de ahí, y la franja y el scope del bloque. */
  open: (block: Block, item: FoodItem, date: string) => void;
};

export const SubstituteContext = createContext<SubstituteApi | null>(null);

export function useSubstituteApi(): SubstituteApi | null {
  return useContext(SubstituteContext);
}
