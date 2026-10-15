/**
 * Convierte las entradas del registro en frases que se entienden.
 *
 * Una fila de `change_log` dice "week_overrides, UPDATE, day 1, slot comida, antes esto,
 * después aquello". Eso no se le enseña a nadie. Aquí se convierte en
 * «Andrés cambió la comida del martes (solo esta semana): lentejas → pollo al horno».
 *
 * Dos cosas importan:
 *
 * 1. **Agrupar por transacción.** Un intercambio toca dos celdas de una sola vez y contarlo
 *    como dos cambios sueltos sería mentir sobre lo que pasó. Las dos filas comparten
 *    `txId`, que es exacto; agrupar por hora sería adivinar.
 * 2. **No saber nada de Supabase.** Los títulos de los bloques llegan en un `lookup`, así
 *    que esto sigue siendo lógica pura y se puede probar sin red ni base de datos.
 */
import { DAY_NAMES } from './dates';

export type ActorRole = 'cliente' | 'nutricionista' | 'sistema';

export type ChangeSource = 'app' | 'publicacion' | 'restaurar' | (string & {});

export type ChangeEntry = {
  id: string;
  txId: string;
  createdAt: string;
  actorRole: ActorRole;
  /** Nombre de quien lo hizo, ya resuelto. Null si fue el sistema. */
  actorName: string | null;
  table: 'template_cells' | 'week_overrides' | 'blocks';
  op: 'INSERT' | 'UPDATE' | 'DELETE';
  cell: { day?: number; slot?: string; scope?: string; weekStart?: string };
  beforeBlockId: string | null;
  afterBlockId: string | null;
  source: ChangeSource;
};

/** Título legible de un bloque. Devuelve null si ya no se sabe cuál era. */
export type BlockTitleLookup = (blockId: string | null) => string | null;

export type ChangeGroup = {
  id: string;
  txId: string;
  createdAt: string;
  actorRole: ActorRole;
  actorName: string | null;
  /** La frase, sin el nombre de quien lo hizo (va aparte en la interfaz). */
  text: string;
  /** Celdas afectadas, por si se ofrece restaurar. */
  cells: ChangeEntry['cell'][];
  /** Un intercambio no se restaura celda a celda: se deshace entero. */
  kind: 'swap' | 'cell' | 'block' | 'other';
  source: ChangeSource;
};

const SLOT_LABELS: Record<string, string> = {
  desayuno: 'el desayuno',
  snack: 'el snack',
  snack2: 'el segundo snack',
  almuerzo: 'el almuerzo',
  comida: 'la comida',
  cena: 'la cena',
};

function slotLabel(slot: string | undefined): string {
  return slot === undefined ? 'una comida' : (SLOT_LABELS[slot] ?? `la franja ${slot}`);
}

function dayLabel(day: number | undefined): string {
  if (day === undefined) return '';
  const name = DAY_NAMES[day];
  return name === undefined ? '' : ` del ${name.toLocaleLowerCase('es-ES')}`;
}

/** "solo esta semana" frente a "todo el plan": es la diferencia que la gente pregunta. */
function alcance(entry: ChangeEntry): string {
  return entry.table === 'week_overrides' ? ' (solo esta semana)' : ' (todo el plan)';
}

function transicion(entry: ChangeEntry, lookup: BlockTitleLookup): string {
  const antes = lookup(entry.beforeBlockId);
  const despues = lookup(entry.afterBlockId);

  if (antes !== null && despues !== null && antes !== despues) return `: ${antes} → ${despues}`;
  if (antes === null && despues !== null) return `: ${despues}`;
  if (antes !== null && despues === null) return `: quitó ${antes}`;
  return '';
}

/**
 * ¿Son estas dos entradas un intercambio? Lo son cuando se escribieron a la vez, en la
 * misma franja y en días distintos, y cada una se queda con el bloque que tenía la otra.
 *
 * El detalle que importa: si una de las dos celdas no tenía cambio previo, la fila es un
 * INSERT y su `before` es nulo, así que ese lado del cruce **no se puede comprobar**. Pasa
 * en la mitad de los intercambios reales. Se exige entonces que todos los cruces que SÍ se
 * conocen encajen, y que se conozca al menos uno: con cero información no se afirma nada y
 * se cae a "cambió 2 comidas", que es menos vistoso pero cierto.
 */
function esIntercambio(entries: ChangeEntry[]): boolean {
  if (entries.length !== 2) return false;
  const [a, b] = entries as [ChangeEntry, ChangeEntry];
  if (a.cell.slot !== b.cell.slot) return false;
  if (a.cell.day === b.cell.day) return false;

  let comprobados = 0;
  if (a.beforeBlockId !== null) {
    if (b.afterBlockId !== a.beforeBlockId) return false;
    comprobados += 1;
  }
  if (b.beforeBlockId !== null) {
    if (a.afterBlockId !== b.beforeBlockId) return false;
    comprobados += 1;
  }

  return comprobados > 0;
}

function describeGroup(entries: ChangeEntry[], lookup: BlockTitleLookup): ChangeGroup {
  const first = entries[0]!;
  const base = {
    id: first.id,
    txId: first.txId,
    createdAt: first.createdAt,
    actorRole: first.actorRole,
    actorName: first.actorName,
    cells: entries.map((entry) => entry.cell),
    source: first.source,
  };

  if (first.source === 'restaurar') {
    // Restaurar una celda puede deshacer varias a la vez (un intercambio, por ejemplo), y
    // contar solo la primera daría una idea equivocada de lo que se deshizo.
    const dias = new Set(entries.map((entry) => entry.cell.day));
    return {
      ...base,
      kind: 'other',
      text:
        dias.size > 1
          ? `restauró ${dias.size} comidas`
          : `restauró ${slotLabel(first.cell.slot)}${dayLabel(first.cell.day)}`,
    };
  }

  if (esIntercambio(entries)) {
    const [a, b] = entries as [ChangeEntry, ChangeEntry];
    return {
      ...base,
      kind: 'swap',
      text:
        `intercambió ${slotLabel(a.cell.slot)}${dayLabel(a.cell.day)} y` +
        `${dayLabel(b.cell.day)}${alcance(a)}`,
    };
  }

  if (first.table === 'blocks') {
    const titulo = lookup(first.afterBlockId) ?? lookup(first.beforeBlockId);
    return {
      ...base,
      kind: 'block',
      text: titulo === null ? 'editó un plato' : `editó el plato "${titulo}"`,
    };
  }

  if (entries.length > 1) {
    return {
      ...base,
      kind: 'other',
      text: `cambió ${entries.length} comidas${alcance(first)}`,
    };
  }

  const verbo = first.op === 'DELETE' ? 'quitó' : 'cambió';
  return {
    ...base,
    kind: 'cell',
    text:
      `${verbo} ${slotLabel(first.cell.slot)}${dayLabel(first.cell.day)}` +
      `${alcance(first)}${first.op === 'DELETE' ? '' : transicion(first, lookup)}`,
  };
}

/**
 * Agrupa por transacción y describe cada grupo. Devuelve lo más reciente primero, que es
 * como se mira un historial.
 */
export function describeChanges(
  entries: readonly ChangeEntry[],
  lookup: BlockTitleLookup,
): ChangeGroup[] {
  const porTx = new Map<string, ChangeEntry[]>();

  for (const entry of entries) {
    const grupo = porTx.get(entry.txId);
    if (grupo) grupo.push(entry);
    else porTx.set(entry.txId, [entry]);
  }

  return [...porTx.values()]
    .map((grupo) => describeGroup(grupo, lookup))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Quién lo hizo, para la interfaz. */
export function actorLabel(group: ChangeGroup): string {
  if (group.actorRole === 'sistema') return 'El sistema';
  if (group.actorName !== null) return group.actorName;
  return group.actorRole === 'nutricionista' ? 'Tu nutricionista' : 'Alguien de casa';
}
