/**
 * Biblioteca de bloques y equivalencias.
 *
 * La biblioteca guarda **una ración base** por alimento, no una por persona. Al colocar un
 * bloque en la dieta de un hogar hay que repartirlo: cada comensal tiene su multiplicador
 * (`portion_multiplier` del perfil), y de ahí salen las raciones concretas.
 *
 * Dos cuidados que no son adorno:
 *
 * - **Se redondea a cantidades que se pueden pesar.** Multiplicar 85 g por 1,25 da 106,25 g,
 *   y eso en una báscula de cocina no existe. Gramos y mililitros van a múltiplos de 5;
 *   las unidades, a medias (media manzana sí, 0,8 manzanas no).
 * - **La medida casera NO se toca.** "1/3 de bandeja" o "2 rebanadas" no se pueden
 *   multiplicar sin decir una tontería, así que se conserva tal cual y se marca para que
 *   alguien la revise. Inventar ahí sería inventar cantidades, que es justo lo que
 *   CLAUDE.md prohíbe.
 */
import type {
  EquivalenceGroup,
  FoodItem,
  LibraryBlock,
  LibrarySection,
  Portion,
  ProfileId,
  Section,
  Block,
} from './schema';

/* ───────────────────────── Redondeo ───────────────────────── */

/** A múltiplos de 5, nunca a cero: 2 g × 0,75 son 1,5 g, y eso sigue siendo "algo". */
function redondeaPeso(value: number): number {
  const redondeado = Math.round(value / 5) * 5;
  return redondeado === 0 ? Math.round(value * 10) / 10 : redondeado;
}

/** A medias unidades. Media manzana se entiende; 0,8 manzanas, no. */
function redondeaUnidades(value: number): number {
  const redondeado = Math.round(value * 2) / 2;
  return redondeado === 0 ? 0.5 : redondeado;
}

export type Escalado = {
  portion: Portion;
  /** true si hay una medida casera que el multiplicador deja desfasada. */
  needsReview: boolean;
};

/** Escala una ración base. Devuelve también si hay algo que revisar a mano. */
export function scalePortion(base: Portion, multiplier: number): Escalado {
  if (multiplier <= 0) throw new Error('El multiplicador tiene que ser positivo');

  // Sin escalar no hay nada que hacer pesable: la cantidad ya es la que escribió la
  // nutricionista. Redondear aquí sería cambiarle un 142 g por un 140 g que no ha pedido
  // nadie, que es justo lo que CLAUDE.md prohíbe.
  if (multiplier === 1) return { portion: { ...base }, needsReview: false };

  const portion: Portion = {};
  if (base.rawG !== undefined) portion.rawG = redondeaPeso(base.rawG * multiplier);
  if (base.cookedG !== undefined) portion.cookedG = redondeaPeso(base.cookedG * multiplier);
  if (base.ml !== undefined) portion.ml = redondeaPeso(base.ml * multiplier);
  if (base.units !== undefined) portion.units = redondeaUnidades(base.units * multiplier);
  if (base.measure !== undefined) portion.measure = base.measure;

  return {
    portion,
    // Solo molesta cuando de verdad cambia algo: con multiplicador 1 la medida sigue bien.
    needsReview: base.measure !== undefined && multiplier !== 1,
  };
}

/* ───────────────────────── Instanciar un bloque ───────────────────────── */

export type Comensal = { profileId: ProfileId; multiplier: number };

export type Instanciado = {
  sections: Section[];
  /** Ids de alimentos cuya medida casera hay que repasar. */
  needsReview: string[];
};

/**
 * Convierte un bloque de biblioteca en secciones con raciones por persona.
 *
 * Los ids de alimento se conservan: así el que instancia puede relacionarlos con el bloque
 * de biblioteca del que salieron, y `needsReview` apunta a ellos.
 */
export function instantiate(block: LibraryBlock, people: readonly Comensal[]): Instanciado {
  const needsReview: string[] = [];

  const sections = block.sections.map((section) => ({
    id: section.id,
    kind: section.kind,
    ...(section.title !== undefined ? { title: section.title } : {}),
    items: section.items.map((item) => {
      const portions: Record<ProfileId, Portion> = {};

      for (const person of people) {
        const escalado = scalePortion(item.base, person.multiplier);
        portions[person.profileId] = escalado.portion;
        if (escalado.needsReview && !needsReview.includes(item.id)) needsReview.push(item.id);
      }

      return {
        id: item.id,
        ...(item.foodKey !== undefined ? { foodKey: item.foodKey } : {}),
        label: item.label,
        portions,
        ...(item.note !== undefined ? { note: item.note } : {}),
      } satisfies FoodItem;
    }),
  })) satisfies Section[];

  return { sections, needsReview };
}

/* ───────────────────────── Editar un bloque de biblioteca ───────────────────────── */

/**
 * El "comensal" ficticio con el que se edita un bloque de biblioteca: la ración base.
 *
 * Un bloque de biblioteca es, de hecho, un bloque de dieta con una sola persona. Verlo así
 * permite editarlo con el mismo editor que usa el cliente, en vez de tener dos.
 */
export const BASE_EATER: ProfileId = 'base';

/**
 * Pasa un bloque de biblioteca a la forma que entiende el editor.
 *
 * **No usa `instantiate` a propósito.** Instanciar redondea a múltiplos de 5, que es lo
 * correcto cuando la ración se reparte entre personas, pero aquí sería destruir el dato:
 * abrir un bloque de 42 g y guardarlo sin tocar nada lo dejaría en 40 g.
 */
export function toEditableBlock(block: LibraryBlock): Block {
  return {
    id: block.id,
    // La biblioteca no pertenece a ningún plan; el editor solo usa esto para rellenar
    // el bloque nuevo, y al volver se descarta.
    planId: 'biblioteca',
    slot: block.slots[0] ?? 'comida',
    scope: BASE_EATER,
    isOriginal: true,
    sections: block.sections.map((section) => ({
      id: section.id,
      kind: section.kind,
      ...(section.title !== undefined ? { title: section.title } : {}),
      items: section.items.map((item) => ({
        id: item.id,
        ...(item.foodKey !== undefined ? { foodKey: item.foodKey } : {}),
        label: item.label,
        portions: { [BASE_EATER]: item.base },
        ...(item.note !== undefined ? { note: item.note } : {}),
      })),
    })),
  };
}

/**
 * La vuelta: lo editado otra vez como bloque de biblioteca.
 *
 * Solo viaja el contenido. El nombre, las franjas, las etiquetas y las notas se editan en
 * su propio formulario, así que se conservan los del bloque de partida.
 */
export function fromEditableBlock(edited: Block, original: LibraryBlock): LibraryBlock {
  const { sections } = toLibraryBlock(edited, BASE_EATER, original.name, () => original.id);
  return { ...original, sections };
}

/* ───────────────────────── Guardar en la biblioteca ───────────────────────── */

/**
 * Pasa un bloque de la dieta a la biblioteca, tomando como base la ración de una persona.
 *
 * Los alimentos que esa persona no come (no tienen ración suya) se quedan fuera: si se
 * metieran con ración vacía, al instanciar aparecerían como alimentos sin cantidad.
 */
export function toLibraryBlock(
  block: Block,
  profileId: ProfileId,
  name: string,
  newId: (prefix: string) => string,
): LibraryBlock {
  const sections: LibrarySection[] = block.sections
    .map((section) => ({
      id: section.id,
      kind: section.kind,
      ...(section.title !== undefined ? { title: section.title } : {}),
      items: section.items
        .filter((item) => item.portions[profileId] !== undefined)
        .map((item) => ({
          id: item.id,
          ...(item.foodKey !== undefined ? { foodKey: item.foodKey } : {}),
          label: item.label,
          base: item.portions[profileId]!,
          ...(item.note !== undefined ? { note: item.note } : {}),
        })),
    }))
    .filter((section) => section.items.length > 0);

  return {
    id: newId('lib'),
    name,
    slots: [block.slot],
    tags: [],
    sections,
    archived: false,
  };
}

/* ───────────────────────── Equivalencias ───────────────────────── */

export type Equivalente = {
  foodKey: string;
  groupId: string;
  groupName: string;
  /** La cantidad que toca de este alimento para cambiarlo por el original. */
  portion: Portion;
  note?: string;
};

/**
 * Por qué puede cambiarse un alimento, y en qué cantidad.
 *
 * El factor va relativo al alimento de partida: si las lentejas cuentan 1 y los garbanzos
 * 1, 140 g de lentejas son 140 g de garbanzos; si el arroz contara 0,5, serían 70 g. La app
 * no decide esos números, los pone la nutricionista.
 *
 * La medida casera se descarta al cambiar de alimento: "2 rebanadas" no significa nada
 * aplicado a otra cosa.
 */
export function equivalentsFor(
  foodKey: string | undefined,
  portion: Portion,
  groups: readonly EquivalenceGroup[],
): Equivalente[] {
  if (foodKey === undefined) return [];

  const resultado: Equivalente[] = [];

  for (const group of groups) {
    if (group.archived) continue;

    const origen = group.members.find((member) => member.foodKey === foodKey);
    if (origen === undefined) continue;

    for (const member of group.members) {
      if (member.foodKey === foodKey) continue;

      // Cuánto cunde el destino respecto al origen.
      const factor = origen.factor / member.factor;
      const escalado = scalePortion(portion, factor);

      // La medida casera se queda fuera: "2 rebanadas" no significa nada en otro alimento.
      const cantidades = { ...escalado.portion };
      delete cantidades.measure;

      resultado.push({
        foodKey: member.foodKey,
        groupId: group.id,
        groupName: group.name,
        portion: cantidades,
        ...(member.note !== undefined ? { note: member.note } : {}),
      });
    }
  }

  return resultado;
}
