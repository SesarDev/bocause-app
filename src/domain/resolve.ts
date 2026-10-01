/**
 * Resolución de la semana: qué se come cada día, para una persona concreta.
 *
 * Tres capas, de más específica a más general (CLAUDE.md, regla 5):
 *   override de la semana  ??  celda de la plantilla viva  ??  plantilla original del plan
 *
 * El plan original nunca se toca, así que `source` dice de qué capa salió cada celda y es
 * lo que permite enseñar el distintivo "Modificado" y ofrecer "Restaurar original".
 */
import type { DayIndex, IsoDateString } from './dates';
import { isoWeekDates, weekStartOf } from './dates';
import type {
  Block,
  CellKey,
  FoodItem,
  Plan,
  Portion,
  ProfileId,
  Scope,
  SlotKey,
  TemplateCell,
  WeekOverride,
} from './schema';

/** Comida y cena son del hogar; el resto, de cada persona (CLAUDE.md, regla 3). */
export const SHARED_SLOTS: readonly SlotKey[] = ['comida', 'cena'];

export function isSharedSlot(slot: SlotKey): boolean {
  return SHARED_SLOTS.includes(slot);
}

export function scopeFor(slot: SlotKey, profileId: ProfileId): Scope {
  return isSharedSlot(slot) ? 'shared' : profileId;
}

/** Clave estable de una celda, para usarla en Map. */
export function cellId(cell: Pick<CellKey, 'day' | 'slot' | 'scope'>): string {
  return `${cell.day}|${cell.slot}|${cell.scope}`;
}

export type ResolveSource = 'original' | 'template' | 'week';

export type ResolvedSlot = {
  cell: CellKey;
  date: IsoDateString;
  /** Bloque filtrado a lo que come esta persona. null si la celda está vacía. */
  block: Block | null;
  /** Id resuelto antes de filtrar: distingue "vacío" de "existe pero no es suyo". */
  blockId: string | null;
  isFree: boolean;
  source: ResolveSource;
};

export type ResolvedDay = {
  day: DayIndex;
  date: IsoDateString;
  training: string | null;
  slots: ResolvedSlot[];
};

export type ResolvedWeek = {
  weekStart: IsoDateString;
  profileId: ProfileId;
  days: ResolvedDay[];
};

export type ResolveWeekInput = {
  plan: Plan;
  profileId: ProfileId;
  weekStart: IsoDateString;
  /** Bloques editados (copy-on-write). Pisan a los del plan cuando comparten id. */
  blocks?: readonly Block[];
  /** Plantilla viva. Si una celda no está, manda la plantilla original del plan. */
  templateCells?: readonly TemplateCell[];
  overrides?: readonly WeekOverride[];
};

export function portionOf(item: FoodItem, profileId: ProfileId): Portion | undefined {
  return item.portions[profileId];
}

/**
 * Deja solo los alimentos con ración para esta persona y descarta las secciones que se
 * quedan vacías (así el pan que solo come Andrés no aparece en la vista de Cristina).
 * Devuelve null si no le queda nada.
 */
export function filterBlockForProfile(block: Block, profileId: ProfileId): Block | null {
  const sections = block.sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => portionOf(item, profileId) !== undefined),
    }))
    .filter((section) => section.items.length > 0);

  return sections.length > 0 ? { ...block, sections } : null;
}

export function resolveWeek(input: ResolveWeekInput): ResolvedWeek {
  const { plan, profileId, blocks = [], templateCells = [], overrides = [] } = input;
  const weekStart = weekStartOf(input.weekStart);

  const profilePlan = plan.profiles.find((profile) => profile.profileId === profileId);
  if (!profilePlan) {
    throw new Error(`El plan ${plan.id} no tiene el perfil "${profileId}"`);
  }

  // Los bloques editados pisan a los originales del plan.
  const blockById = new Map<string, Block>();
  for (const block of plan.blocks) blockById.set(block.id, block);
  for (const block of blocks) blockById.set(block.id, block);

  const originalCells = new Map<string, string | null>();
  for (const cell of plan.template) originalCells.set(cellId(cell), cell.blockId);

  const liveCells = new Map<string, string | null>();
  for (const cell of templateCells) liveCells.set(cellId(cell), cell.blockId);

  const weekCells = new Map<string, WeekOverride>();
  for (const override of overrides) {
    if (override.weekStart === weekStart) weekCells.set(cellId(override), override);
  }

  const dates = isoWeekDates(weekStart);

  const days: ResolvedDay[] = dates.map((date, index) => {
    const day = index as DayIndex;

    const slots = profilePlan.slots.map((slot): ResolvedSlot => {
      const scope = scopeFor(slot, profileId);
      const cell: CellKey = { day, slot, scope };
      const key = cellId(cell);

      const originalBlockId = originalCells.get(key) ?? null;
      const override = weekCells.get(key);

      let blockId: string | null;
      let isFree = false;
      let source: ResolveSource;

      if (override) {
        blockId = override.blockId;
        isFree = override.isFree;
        source = 'week';
      } else if (liveCells.has(key)) {
        blockId = liveCells.get(key) ?? null;
        source = blockId === originalBlockId ? 'original' : 'template';
      } else {
        blockId = originalBlockId;
        source = 'original';
      }

      const block = blockId === null ? null : (blockById.get(blockId) ?? null);

      return {
        cell,
        date,
        blockId,
        block: block === null ? null : filterBlockForProfile(block, profileId),
        isFree,
        source,
      };
    });

    return {
      day,
      date,
      training: profilePlan.training[index] ?? null,
      slots,
    };
  });

  return { weekStart, profileId, days };
}

/** Busca una franja concreta dentro de una semana ya resuelta. */
export function findSlot(
  week: ResolvedWeek,
  day: DayIndex,
  slot: SlotKey,
): ResolvedSlot | undefined {
  return week.days[day]?.slots.find((resolved) => resolved.cell.slot === slot);
}

/** Todas las franjas de la semana, en orden de día y franja. */
export function allSlots(week: ResolvedWeek): ResolvedSlot[] {
  return week.days.flatMap((day) => day.slots);
}
