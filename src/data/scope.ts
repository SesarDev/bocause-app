/**
 * El hogar activo: a qué hogar pertenece todo lo que la app lee y escribe ahora mismo.
 *
 * Hasta ahora no hacía falta. Las consultas no filtraban por hogar y funcionaban porque
 * las políticas RLS solo devuelven el hogar de quien pregunta, así que el filtro era
 * invisible pero real. Eso se rompe en la fase 13: una nutricionista puede verlo todo, y
 * entonces las mismas consultas mezclarían hogares sin avisar. De ahí la regla nueva:
 * **toda consulta filtra por hogar de forma explícita y no se fía de RLS.**
 *
 * Vive en un módulo y no en un hook porque las mutaciones corren fuera de React (se
 * registran por `mutationKey` para poder reanudarse tras una reconexión) y necesitan saber
 * el hogar igual que las consultas. `useActiveHousehold` expone el mismo valor a React.
 *
 * Es un valor propio y no algo derivado del perfil a propósito: en la fase 17 la
 * nutricionista elegirá qué hogar está mirando, y esta pieza tiene que servir igual.
 */
import { useSyncExternalStore } from 'react';

let activeHousehold: string | null = null;

const listeners = new Set<() => void>();

export function activeHouseholdId(): string | null {
  return activeHousehold;
}

export function setActiveHousehold(householdId: string | null): void {
  if (activeHousehold === householdId) return;
  activeHousehold = householdId;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** El hogar activo, re-renderizando el componente cuando cambia. */
export function useActiveHousehold(): string | null {
  return useSyncExternalStore(subscribe, activeHouseholdId, activeHouseholdId);
}
