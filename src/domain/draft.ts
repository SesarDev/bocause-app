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
import type { Plan } from './schema';

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
