/**
 * Qué pasa con los cambios del cliente cuando la nutricionista publica una dieta nueva.
 *
 * Es la pieza de más riesgo de todo el proyecto. La decisión 3 de `docs/PLAN.md` dice que
 * **los cambios del cliente sobreviven a la publicación**, salvo en las celdas que la
 * nutricionista haya tocado, donde manda ella. Hacerlo mal significa una de dos cosas, y
 * las dos son malas: o alguien pierde en silencio los ajustes que llevaba semanas haciendo,
 * o la dieta nueva no llega entera y la persona sigue comiendo lo de antes creyendo que no.
 *
 * Por eso aquí no se toca la base de datos: esto decide **qué** hay que escribir, y la RPC
 * `publish_plan` lo escribe en una transacción.
 *
 * La comparación es por **contenido, no por id**. Entre dos versiones de un plan los ids de
 * bloque cambian, así que comparar identidad diría que todo ha cambiado siempre.
 */
import type { IsoDateString } from './dates';
import { isSameOrAfter } from './dates';
import { cellId } from './resolve';
import type { Block, CellKey, Plan, TemplateCell, WeekOverride } from './schema';

/* ───────────────────────── Identidad por contenido ───────────────────────── */

/**
 * Huella de un bloque: lo que se come, no cómo se llama por dentro. Ignora el id y el plan
 * al que pertenece, que es justo lo que cambia entre versiones.
 */
export function blockFingerprint(block: Block | null): string {
  if (block === null) return '(vacío)';
  return JSON.stringify(
    block.sections.map((section) => [
      section.kind,
      section.title ?? '',
      section.items.map((item) => [item.label, item.foodKey ?? '', item.portions, item.note ?? '']),
    ]),
  );
}

/* ───────────────────────── Entrada y salida ───────────────────────── */

export type CarryOverInput = {
  prevPlan: Plan;
  /** Bloques que el cliente editó (copy-on-write) sobre el plan anterior. */
  prevEditedBlocks: readonly Block[];
  /** La plantilla viva del hogar: lo que el cliente ve hoy. */
  prevTemplateCells: readonly TemplateCell[];
  prevOverrides: readonly WeekOverride[];
  nextPlan: Plan;
  /** Lunes desde el que manda la dieta nueva. */
  validFrom: IsoDateString;
  /**
   * Celdas en conflicto donde se decide mantener el cambio del cliente. Por defecto gana la
   * nutricionista, que es lo que pide PLAN.md.
   */
  keepClient?: ReadonlySet<string>;
  newId?: () => string;
};

/** Una celda que cambiaron los dos. La interfaz la enseña antes de publicar. */
export type Conflict = {
  cell: CellKey;
  /** Lo que tenía el cliente, para poder enseñarlo. */
  clientBlockId: string | null;
  /** Lo que trae la dieta nueva. */
  nextBlockId: string | null;
  /** El plato del cliente ya no existe en la dieta nueva y no se puede arrastrar. */
  orphan: boolean;
};

export type CarryOverResult = {
  /** Copias de los bloques editados por el cliente, ya apuntando al plan nuevo. */
  blocks: Block[];
  /** Celdas de plantilla que hay que escribir además de las del plan nuevo. */
  cells: TemplateCell[];
  /** Overrides de semanas que empiezan en `validFrom` o después. */
  overrides: WeekOverride[];
  conflicts: Conflict[];
};

/* ───────────────────────── El cálculo ───────────────────────── */

export function carryOver(input: CarryOverInput): CarryOverResult {
  const {
    prevPlan,
    prevEditedBlocks,
    prevTemplateCells,
    prevOverrides,
    nextPlan,
    validFrom,
    keepClient = new Set<string>(),
    newId = () => crypto.randomUUID(),
  } = input;

  const prevBlocks = new Map<string, Block>();
  for (const block of prevPlan.blocks) prevBlocks.set(block.id, block);
  for (const block of prevEditedBlocks) prevBlocks.set(block.id, block);

  const nextBlocks = new Map<string, Block>();
  for (const block of nextPlan.blocks) nextBlocks.set(block.id, block);

  /** Para volver a encontrar un plato en la dieta nueva aunque le haya cambiado el id. */
  const nextByFingerprint = new Map<string, Block>();
  for (const block of nextPlan.blocks) {
    const huella = blockFingerprint(block);
    if (!nextByFingerprint.has(huella)) nextByFingerprint.set(huella, block);
  }

  const prevPublished = new Map(prevPlan.template.map((cell) => [cellId(cell), cell]));
  const nextPublished = new Map(nextPlan.template.map((cell) => [cellId(cell), cell]));
  const live = new Map(prevTemplateCells.map((cell) => [cellId(cell), cell]));

  const blocks: Block[] = [];
  const cells: TemplateCell[] = [];
  const conflicts: Conflict[] = [];

  /** Copias ya hechas, para que un bloque usado en dos celdas no se duplique. */
  const copiados = new Map<string, string>();

  /**
   * A qué bloque del plan nuevo corresponde lo que tenía el cliente.
   * - Un bloque que él editó se copia tal cual al plan nuevo.
   * - Un original del plan viejo (lo típico de un intercambio) se busca por contenido.
   * - Si no se encuentra, el plato ya no existe y no hay nada que arrastrar.
   */
  function traducir(blockId: string | null): { blockId: string | null; orphan: boolean } {
    if (blockId === null) return { blockId: null, orphan: false };

    const origen = prevBlocks.get(blockId);
    if (origen === undefined) return { blockId: null, orphan: true };

    // Editado por el cliente: viaja al plan nuevo con id propio.
    if (!origen.isOriginal) {
      const ya = copiados.get(blockId);
      if (ya !== undefined) return { blockId: ya, orphan: false };

      const copia: Block = {
        ...origen,
        id: newId(),
        planId: nextPlan.id,
        // Apunta al original de la dieta NUEVA si existe, para que "restaurar" siga
        // teniendo a dónde volver.
        ...(() => {
          const raiz = origen.originBlockId ?? null;
          const original = raiz === null ? null : (prevBlocks.get(raiz) ?? null);
          const equivalente =
            original === null ? undefined : nextByFingerprint.get(blockFingerprint(original));
          return equivalente === undefined ? {} : { originBlockId: equivalente.id };
        })(),
      };

      blocks.push(copia);
      copiados.set(blockId, copia.id);
      return { blockId: copia.id, orphan: false };
    }

    // Original del plan viejo: se busca el mismo plato en el nuevo.
    const equivalente = nextByFingerprint.get(blockFingerprint(origen));
    return equivalente === undefined
      ? { blockId: null, orphan: true }
      : { blockId: equivalente.id, orphan: false };
  }

  /* ── Plantilla ── */

  for (const [key, nextCell] of nextPublished) {
    const publicadoAntes = prevPublished.get(key) ?? null;
    const actual = live.get(key);

    // Lo que el cliente ve hoy; si no hay fila viva, es lo que se publicó entonces.
    //
    // Ojo con el `??` aquí: un `blockId` nulo es una celda que el cliente **vació a
    // propósito** (el domingo sin cena, por ejemplo), no una fila ausente. Mezclarlos hacía
    // que la publicación se la volviera a llenar sin que nadie se enterara.
    const delCliente = actual !== undefined ? actual.blockId : (publicadoAntes?.blockId ?? null);
    const cambioElCliente = delCliente !== (publicadoAntes?.blockId ?? null);

    const antes = blockFingerprint(
      publicadoAntes?.blockId == null ? null : (prevBlocks.get(publicadoAntes.blockId) ?? null),
    );
    const despues = blockFingerprint(
      nextCell.blockId === null ? null : (nextBlocks.get(nextCell.blockId) ?? null),
    );
    const cambioElla = antes !== despues;

    if (!cambioElCliente) continue; // La celda se queda como la publica ella.

    const traducido = traducir(delCliente);
    const celda = { day: nextCell.day, slot: nextCell.slot, scope: nextCell.scope };

    /*
     * Un cambio del cliente que no se puede arrastrar **siempre** sale como conflicto,
     * aunque ella no haya tocado esa celda. Si no, el plato que él se había puesto
     * desaparecería sin que nadie lo viera venir, que es justo el fallo que esta pieza
     * existe para evitar.
     */
    if (traducido.orphan || cambioElla) {
      conflicts.push({
        cell: celda,
        clientBlockId: delCliente,
        nextBlockId: nextCell.blockId,
        orphan: traducido.orphan,
      });
    }

    // El plato ya no existe en la dieta nueva: no hay nada que escribir.
    if (traducido.orphan) continue;

    // En un conflicto gana ella salvo que se decida lo contrario: la celda se queda con lo
    // que trae la dieta nueva y no se escribe nada encima.
    if (cambioElla && !keepClient.has(key)) continue;

    cells.push({ ...celda, blockId: traducido.blockId });
  }

  /* ── Overrides de semanas futuras ── */
  //
  // Las semanas anteriores a `validFrom` se siguen resolviendo con el plan viejo, así que
  // sus overrides no viajan: moverlos reescribiría el pasado.

  const overrides: WeekOverride[] = [];
  const enConflicto = new Set(conflicts.map((conflict) => cellId(conflict.cell)));

  for (const override of prevOverrides) {
    if (!isSameOrAfter(override.weekStart, validFrom)) continue;

    const key = cellId(override);

    // Si ella cambió la celda y gana, el override del cliente taparía su cambio.
    if (enConflicto.has(key) && !keepClient.has(key)) continue;

    const traducido = traducir(override.blockId);
    if (traducido.orphan) continue;

    overrides.push({
      weekStart: override.weekStart,
      day: override.day,
      slot: override.slot,
      scope: override.scope,
      blockId: traducido.blockId,
      isFree: override.isFree,
    });
  }

  return { blocks, cells, overrides, conflicts };
}
