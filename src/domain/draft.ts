/**
 * Higiene del borrador de dieta.
 *
 * El constructor crea un bloque nuevo cada vez que se rellena una celda, y el anterior se
 * queda ahí sin que nadie lo señale. Cambiar diez veces la cena del jueves dejaba nueve
 * bloques muertos dentro del borrador, que se publicarían tal cual dentro de `plans.data`:
 * un documento inmutable lleno de platos que no come nadie.
 *
 * No es solo tamaño. `carryOver` busca platos por contenido para reencontrarlos entre
 * versiones, y un plan lleno de restos hace esa búsqueda menos fiable.
 */
import type { IsoDateString } from './dates';
import { Rules } from './schema';
import type { Block, Food, Plan, ProfileId, SlotKey } from './schema';

/* ─────────────────────── Empezar una dieta ─────────────────────── */

/**
 * Las franjas con las que nace una persona en una dieta nueva.
 *
 * Tres comidas es el mínimo que tiene sentido enseñar; los snacks y el almuerzo se añaden
 * desde Configuración, que es donde se ve de quién son. La app **no** adivina las franjas
 * de nadie a partir de otro hogar.
 */
export const SLOTS_POR_DEFECTO: readonly SlotKey[] = ['desayuno', 'comida', 'cena'];

/** Los siete días sin entreno. `training` tiene que medir 7 siempre. */
const SIN_ENTRENO = [null, null, null, null, null, null, null];

/**
 * Una dieta vacía para un hogar: las personas, sus franjas por defecto y las reglas del
 * plan. Ni una comida: las pone la nutricionista.
 *
 * El catálogo entra entero si se le pasa. No es un capricho: `plan.foods` es lo que agrupa
 * la lista de la compra por secciones y lo que autocompleta el editor, y una dieta nueva
 * sin catálogo nace con las dos cosas peor que la anterior.
 */
export function blankPlan(input: {
  id: string;
  name: string;
  issuedOn: IsoDateString;
  validFrom: IsoDateString;
  people: readonly { profileId: ProfileId; displayName: string }[];
  foods?: readonly Food[];
}): Plan {
  return {
    id: input.id,
    name: input.name,
    issuedOn: input.issuedOn,
    validFrom: input.validFrom,
    profiles: input.people.map((persona) => ({
      profileId: persona.profileId,
      displayName: persona.displayName,
      slots: [...SLOTS_POR_DEFECTO],
      training: [...SIN_ENTRENO],
      supplements: [],
      comodin: [],
    })),
    blocks: [],
    template: [],
    recipes: [],
    foods: [...(input.foods ?? [])],
    rules: Rules.parse({ recommendations: [] }),
  };
}

/**
 * Copia una dieta a otro hogar, diciendo qué persona de allí hace de cuál de aquí.
 *
 * Lo que no esté en el mapa se queda fuera entero: su franja individual, sus bloques y su
 * ración dentro de los compartidos. Es la única opción honesta cuando el hogar de destino
 * tiene menos gente: repartirle a nadie la comida de un tercero sería inventar raciones.
 *
 * Los ids de bloque se renuevan. Son los de otra dieta, de otro hogar, y dejarlos invita a
 * que `carryOver` o el registro de cambios crucen dos planes que no tienen nada que ver.
 */
export function duplicatePlan(
  plan: Plan,
  options: {
    id: string;
    name: string;
    /** Hoy: la copia nace hoy, no el día en que se emitió la dieta de la que sale. */
    issuedOn: IsoDateString;
    /** profileId de la dieta de origen → profileId del hogar de destino (o null: fuera). */
    mapping: Readonly<Record<string, string | null>>;
    people: readonly { profileId: ProfileId; displayName: string }[];
    newId: () => string;
  },
): Plan {
  const destino = (profileId: string): string | null => options.mapping[profileId] ?? null;
  const nombreDe = (profileId: string): string =>
    options.people.find((persona) => persona.profileId === profileId)?.displayName ?? profileId;

  const profiles = plan.profiles
    .filter((perfil) => destino(perfil.profileId) !== null)
    .map((perfil) => {
      const nuevo = destino(perfil.profileId)!;
      return { ...perfil, profileId: nuevo, displayName: nombreDe(nuevo) };
    });

  /** Un bloque individual de alguien que no viaja no tiene sitio en la dieta nueva. */
  const traduceScope = (scope: string): string | null =>
    scope === 'shared' ? 'shared' : destino(scope);

  const idsNuevos = new Map<string, string>();
  const blocks: Block[] = [];

  for (const block of plan.blocks) {
    const scope = traduceScope(block.scope);
    if (scope === null) continue;

    const sections = block.sections.map((section) => ({
      ...section,
      items: section.items
        .map((item) => {
          const portions: Record<string, (typeof item.portions)[string]> = {};
          for (const [profileId, portion] of Object.entries(item.portions)) {
            const nuevo = destino(profileId);
            if (nuevo !== null && portion !== undefined) portions[nuevo] = portion;
          }
          return { ...item, portions };
        })
        // Un alimento que solo comía quien no viaja se queda sin nadie: fuera.
        .filter((item) => Object.keys(item.portions).length > 0),
    }));

    const id = options.newId();
    idsNuevos.set(block.id, id);

    // Se enumeran los campos en vez de esparcir el bloque: así se queda fuera
    // `originBlockId`, que apuntaba a un bloque de la otra dieta y aquí no existe.
    blocks.push({ id, planId: options.id, slot: block.slot, scope, sections, isOriginal: true });
  }

  const template = plan.template
    .map((cell) => {
      const scope = traduceScope(cell.scope);
      if (scope === null) return null;
      const blockId = cell.blockId === null ? null : (idsNuevos.get(cell.blockId) ?? null);
      return { ...cell, scope, blockId };
    })
    .filter((cell) => cell !== null);

  return {
    ...plan,
    id: options.id,
    name: options.name,
    issuedOn: options.issuedOn,
    profiles,
    blocks,
    template,
  };
}

/** Bloques a los que apunta alguna celda de la plantilla. */
function enUso(plan: Plan): Set<string> {
  const usados = new Set<string>();
  for (const cell of plan.template) {
    if (cell.blockId !== null) usados.add(cell.blockId);
  }
  return usados;
}

/**
 * Quita del plan los bloques que no usa ninguna celda.
 *
 * Conserva los que son origen de otro bloque que sí está en uso: son la referencia a la que
 * vuelve "Restaurar original", y borrarlos dejaría esa vuelta sin destino.
 */
export function pruneUnusedBlocks(plan: Plan): Plan {
  const usados = enUso(plan);

  const origenesNecesarios = new Set<string>();
  for (const block of plan.blocks) {
    if (usados.has(block.id) && block.originBlockId !== undefined) {
      origenesNecesarios.add(block.originBlockId);
    }
  }

  const sobreviven = plan.blocks.filter(
    (block) => usados.has(block.id) || origenesNecesarios.has(block.id),
  );

  // Si no sobra nada, se devuelve el mismo objeto: así quien compare por identidad no cree
  // que ha cambiado algo.
  return sobreviven.length === plan.blocks.length ? plan : { ...plan, blocks: sobreviven };
}

/** Cuántos bloques sobran ahora mismo. Para avisar sin tener que recalcular el plan. */
export function unusedBlockCount(plan: Plan): number {
  return plan.blocks.length - pruneUnusedBlocks(plan).blocks.length;
}
