import { createContext, useContext } from 'react';
import type { SlotKey } from '../../domain/schema';

/**
 * Todo lo que necesita saber un alimento para pintar su check. Va por contexto y no por
 * props porque está cuatro niveles por debajo de donde viven los datos.
 *
 * `editable` es falso cuando miras el plan de la otra persona o la vista Casa: cada uno
 * marca lo suyo. La base de datos lo impone igualmente (las RLS de `checks` solo dejan
 * escribir con tu propio profile_id), pero enseñar un check que va a fallar es mentir.
 */
export type CheckApi = {
  editable: boolean;
  isChecked: (date: string, slot: SlotKey, itemId: string) => boolean;
  toggle: (date: string, slot: SlotKey, itemId: string, next: boolean) => void;
  /** Marca o desmarca de golpe todos los alimentos de una franja. */
  toggleSlot: (date: string, slot: SlotKey, itemIds: string[], next: boolean) => void;
  /** Nombres de quién lo ha marcado ya. Para la vista Casa. */
  checkedBy: (date: string, slot: SlotKey, itemId: string) => string[];
};

export const CheckContext = createContext<CheckApi | null>(null);

export function useCheckApi(): CheckApi | null {
  return useContext(CheckContext);
}
