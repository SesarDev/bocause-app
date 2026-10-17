/**
 * Claves de la caché de TanStack Query.
 *
 * Todas cuelgan de `['bocause', <hogar>]`. Llevar el hogar en la raíz no es decorativo: la
 * caché se persiste en IndexedDB y sobrevive a los cambios de sesión, así que sin él los
 * datos de un hogar podrían servirse a otro (y, en la fase 17, a la nutricionista mientras
 * mira a varios clientes). Con el hogar en la raíz, cada uno tiene su rama y nunca se
 * pisan; además `invalidateQueries({ queryKey: keysFor(h).all })` limpia un hogar entero.
 */
import { activeHouseholdId } from './scope';

export const ROOT = 'bocause';

/** Rama para cuando todavía no se sabe el hogar. Esas consultas están `enabled: false`. */
export const NO_HOUSEHOLD = 'sin-hogar';

/**
 * Claves de lo que es de la consulta entera y no de un hogar: catálogo, biblioteca y
 * equivalencias (0007). No cuelgan de ningún hogar porque hay un Supabase por consulta
 * (decisión 1 de PLAN.md), y la caché ya está separada por usuario.
 */
export const consultaKeys = {
  all: [ROOT, 'consulta'] as const,
  foods: () => [ROOT, 'consulta', 'foods'] as const,
  /** La rama entera de la biblioteca, para invalidar sus dos listas de una vez. */
  library: () => [ROOT, 'consulta', 'library-blocks'] as const,
  libraryBlocks: (archivados = false) =>
    [ROOT, 'consulta', 'library-blocks', archivados ? 'con-archivados' : 'activos'] as const,
  equivalences: () => [ROOT, 'consulta', 'equivalences'] as const,
};

export function keysFor(householdId: string | null) {
  const all = [ROOT, householdId ?? NO_HOUSEHOLD] as const;

  return {
    all,
    profiles: () => [...all, 'profiles'] as const,
    plan: (onDate: string) => [...all, 'plan', onDate] as const,
    blocks: (planId: string) => [...all, 'blocks', planId] as const,
    templateCells: (planId: string) => [...all, 'template-cells', planId] as const,
    weekOverrides: (planId: string, weekStart: string) =>
      [...all, 'week-overrides', planId, weekStart] as const,
    checks: (weekStart: string) => [...all, 'checks', weekStart] as const,
    dailyLogs: (weekStart: string) => [...all, 'daily-logs', weekStart] as const,
    shoppingItems: (weekStart: string) => [...all, 'shopping-items', weekStart] as const,
  };
}

/**
 * Claves del hogar activo, para quien no está dentro de un render de React: las mutaciones.
 * Dentro de un componente se usa `keysFor(useActiveHousehold())`, para que React sepa que
 * la clave depende del hogar y vuelva a pedir los datos cuando cambie.
 */
export const keys = {
  all: () => keysFor(activeHouseholdId()).all,
  profiles: () => keysFor(activeHouseholdId()).profiles(),
  plan: (onDate: string) => keysFor(activeHouseholdId()).plan(onDate),
  blocks: (planId: string) => keysFor(activeHouseholdId()).blocks(planId),
  templateCells: (planId: string) => keysFor(activeHouseholdId()).templateCells(planId),
  weekOverrides: (planId: string, weekStart: string) =>
    keysFor(activeHouseholdId()).weekOverrides(planId, weekStart),
  checks: (weekStart: string) => keysFor(activeHouseholdId()).checks(weekStart),
  dailyLogs: (weekStart: string) => keysFor(activeHouseholdId()).dailyLogs(weekStart),
  shoppingItems: (weekStart: string) => keysFor(activeHouseholdId()).shoppingItems(weekStart),
};
