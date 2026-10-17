/**
 * Cambiar un alimento por un equivalente.
 *
 * Las equivalencias las decide la nutricionista (`equivalence_groups`); aquí solo se aplica
 * el cambio dentro de un bloque. La conversión de cantidad llega como función, no como
 * ración ya calculada: en un plato compartido cada persona come una cantidad distinta y hay
 * que convertir la suya, no la de otro.
 *
 * Dos modos, y la diferencia importa:
 *
 * - **Para los dos**: el alimento cambia para todo el mundo. Es lo normal cuando se cocina
 *   una sola vez.
 * - **Solo para mí**: el alimento original se queda con la ración de los demás y nace uno
 *   nuevo con la mía. Es lo que permite que uno cambie las lentejas por garbanzos sin
 *   tocarle el plato al otro.
 *
 * Nada de esto muta el bloque: devuelve uno nuevo, y quien llama lo guarda con `forkBlock`
 * (copy-on-write, regla 6 de CLAUDE.md).
 */
import type { Block, FoodItem, Portion, ProfileId, Section } from './schema';

export type Replacement = {
  foodKey: string;
  label: string;
  /** Convierte la ración de cada persona. Viene de `equivalentsFor`. */
  convert: (portion: Portion) => Portion;
  note?: string;
};

export type SubstitutionMode = 'todos' | 'solo-yo';

export type SubstituteOptions = {
  mode: SubstitutionMode;
  /** Quién lo pide. Solo se usa en modo "solo para mí". */
  profileId: ProfileId;
  newId: () => string;
};

/** Lo que había antes, para poder enseñar "En lugar de…" y deshacerlo. */
function origenDe(item: FoodItem): { foodKey?: string; label: string } {
  // Si ya venía de otra sustitución, el origen sigue siendo el primero: así "restaurar"
  // devuelve al alimento del plan y no a un paso intermedio.
  if (item.replaces !== undefined) return item.replaces;
  return { ...(item.foodKey !== undefined ? { foodKey: item.foodKey } : {}), label: item.label };
}

function sustituido(
  item: FoodItem,
  replacement: Replacement,
  portions: Record<ProfileId, Portion>,
): FoodItem {
  const origen = origenDe(item);

  // Si se vuelve al alimento de partida, ya no hay sustitución que señalar. Sin esto
  // quedaba un "Arroz integral en lugar de arroz integral", que no dice nada y da la
  // sensación de que la app no se entera de lo que ha hecho.
  const vuelveAlOriginal = origen.foodKey === replacement.foodKey;

  return {
    id: item.id,
    foodKey: replacement.foodKey,
    label: replacement.label,
    portions,
    ...(replacement.note !== undefined ? { note: replacement.note } : {}),
    ...(vuelveAlOriginal ? {} : { replaces: origen }),
  };
}

/**
 * Devuelve el bloque con el alimento cambiado. Si el alimento no está, devuelve el mismo
 * bloque: quien llama no tiene que comprobarlo.
 */
export function substituteItem(
  block: Block,
  itemId: string,
  replacement: Replacement,
  options: SubstituteOptions,
): Block {
  let tocado = false;

  const sections: Section[] = block.sections.map((section) => {
    const items: FoodItem[] = [];

    for (const item of section.items) {
      if (item.id !== itemId) {
        items.push(item);
        continue;
      }

      tocado = true;

      if (options.mode === 'todos') {
        const portions: Record<ProfileId, Portion> = {};
        for (const [profileId, portion] of Object.entries(item.portions)) {
          portions[profileId] = replacement.convert(portion);
        }
        items.push(sustituido(item, replacement, portions));
        continue;
      }

      /* Solo para mí: se parte en dos. */

      const mia = item.portions[options.profileId];

      // Si no lo como yo, no hay nada que cambiar para mí.
      if (mia === undefined) {
        items.push(item);
        continue;
      }

      const deLosDemas: Record<ProfileId, Portion> = {};
      for (const [profileId, portion] of Object.entries(item.portions)) {
        if (profileId !== options.profileId) deLosDemas[profileId] = portion;
      }

      // El original se queda con la ración de los demás; si no come nadie más, desaparece.
      if (Object.keys(deLosDemas).length > 0) {
        items.push({ ...item, portions: deLosDemas });
      }

      items.push(
        sustituido({ ...item, id: options.newId() }, replacement, {
          [options.profileId]: replacement.convert(mia),
        }),
      );
    }

    return { ...section, items };
  });

  return tocado ? { ...block, sections } : block;
}

/**
 * Deshace una sustitución concreta, devolviendo el alimento a lo que era.
 *
 * No recalcula cantidades: la ración de la que se partió no se guarda, así que lo honesto
 * es devolver el alimento al original del plan, que es lo que hace "Restaurar original" de
 * la celda. Esto sirve para quitar el cambio cuando la celda tiene varios.
 */
export function isSubstituted(item: FoodItem): boolean {
  return item.replaces !== undefined;
}

/** Texto para la interfaz: "En lugar de lentejas". */
export function replacedLabel(item: FoodItem): string | null {
  return item.replaces === undefined ? null : `En lugar de ${item.replaces.label.toLowerCase()}`;
}
