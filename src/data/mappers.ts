/**
 * Traducción entre las filas de Postgres (snake_case, secciones dentro de un jsonb) y los
 * tipos del dominio (camelCase). Todo lo que entra se valida con Zod: es la regla de
 * CLAUDE.md de que ningún dato externo llega al dominio sin pasar por el esquema.
 */
import {
  Block,
  Check,
  DailyLog,
  Plan,
  ShoppingItem,
  TemplateCell,
  WeekOverride,
} from '../domain/schema';
import type {
  BlockRow,
  CheckRow,
  DailyLogRow,
  Database,
  PlanRow,
  ShoppingItemRow,
  TemplateCellRow,
  WeekOverrideRow,
} from './database.types';

type Tables = Database['public']['Tables'];
export type BlockInsert = Tables['blocks']['Insert'];
export type TemplateCellInsert = Tables['template_cells']['Insert'];
export type WeekOverrideInsert = Tables['week_overrides']['Insert'];

/** Lo que necesita un traductor para cruzar la frontera slug ↔ UUID. */
export type ScopeTranslator = {
  toDomainScope: (dbScope: string) => string;
  toDbScope: (domainScope: string) => string;
};

/** El plan original vive entero en plans.data y nunca se modifica. */
export function toPlan(row: PlanRow): Plan {
  return Plan.parse(row.data);
}

/**
 * Los bloques de la tabla son siempre copias (copy-on-write): los originales están dentro
 * de plans.data.blocks. Por eso isOriginal es false sin excepción.
 */
export function toBlock(row: BlockRow, scopes: ScopeTranslator): Block {
  const content = row.content as { sections?: unknown };
  return Block.parse({
    id: row.id,
    planId: row.plan_id,
    slot: row.slot,
    scope: scopes.toDomainScope(row.scope),
    sections: content?.sections ?? [],
    isOriginal: false,
    ...(row.origin_block_id === null ? {} : { originBlockId: row.origin_block_id }),
  });
}

export function fromBlock(
  block: Block,
  scopes: ScopeTranslator,
  createdBy: string | null,
): BlockInsert {
  return {
    id: block.id,
    plan_id: block.planId,
    slot: block.slot,
    scope: scopes.toDbScope(block.scope),
    origin_block_id: block.originBlockId ?? null,
    content: { sections: block.sections } as BlockRow['content'],
    created_by: createdBy,
  };
}

export function toTemplateCell(row: TemplateCellRow, scopes: ScopeTranslator): TemplateCell {
  return TemplateCell.parse({
    day: row.day,
    slot: row.slot,
    scope: scopes.toDomainScope(row.scope),
    blockId: row.block_id,
  });
}

export function fromTemplateCell(
  cell: TemplateCell,
  planId: string,
  scopes: ScopeTranslator,
  updatedBy: string | null,
): TemplateCellInsert {
  return {
    plan_id: planId,
    day: cell.day,
    slot: cell.slot,
    scope: scopes.toDbScope(cell.scope),
    block_id: cell.blockId,
    updated_by: updatedBy,
  };
}

export function toWeekOverride(row: WeekOverrideRow, scopes: ScopeTranslator): WeekOverride {
  return WeekOverride.parse({
    weekStart: row.week_start,
    day: row.day,
    slot: row.slot,
    scope: scopes.toDomainScope(row.scope),
    blockId: row.block_id,
    isFree: row.is_free,
  });
}

export function fromWeekOverride(
  override: WeekOverride,
  planId: string,
  scopes: ScopeTranslator,
  updatedBy: string | null,
): WeekOverrideInsert {
  return {
    plan_id: planId,
    week_start: override.weekStart,
    day: override.day,
    slot: override.slot,
    scope: scopes.toDbScope(override.scope),
    block_id: override.blockId,
    is_free: override.isFree,
    updated_by: updatedBy,
  };
}

export function toCheck(row: CheckRow, scopes: ScopeTranslator): Check {
  return Check.parse({
    profileId: scopes.toDomainScope(row.profile_id),
    date: row.date,
    slot: row.slot,
    itemId: row.item_id,
    checked: row.checked,
  });
}

export function toDailyLog(row: DailyLogRow, scopes: ScopeTranslator): DailyLog {
  return DailyLog.parse({
    profileId: scopes.toDomainScope(row.profile_id),
    date: row.date,
    comodinOptionId: row.comodin_option_id,
    comodinDone: row.comodin_done,
    waterMl: row.water_ml,
    aoveSpoons: row.aove_spoons,
  });
}

export function toShoppingItem(row: ShoppingItemRow): ShoppingItem {
  return ShoppingItem.parse({
    id: row.id,
    weekStart: row.week_start,
    source: row.source,
    ...(row.food_key === null ? {} : { foodKey: row.food_key }),
    label: row.label,
    ...(row.quantity_text === null ? {} : { quantityText: row.quantity_text }),
    section: row.section,
    checked: row.checked,
    inPantry: row.in_pantry,
  });
}

/**
 * Perfil del hogar. No es un tipo del dominio (el dominio solo conoce el id), así que se
 * define aquí: es información de la capa de datos.
 */
export type Profile = {
  id: string;
  userId: string | null;
  householdId: string;
  /** "cristina" | "andres": enlaza con los profileId del plan. */
  slug: string;
  displayName: string;
};

export function toProfile(row: {
  id: string;
  user_id: string | null;
  household_id: string;
  slug: string;
  display_name: string;
}): Profile {
  return {
    id: row.id,
    userId: row.user_id,
    householdId: row.household_id,
    slug: row.slug,
    displayName: row.display_name,
  };
}

/* ─────────────────────── Traducción de scopes ─────────────────────── */

/**
 * El dominio y la base de datos no llaman igual a una persona, y es a propósito:
 *
 * - El plan extraído del PDF usa los slugs "cristina" y "andres". Tienen que ser estables
 *   para que el JSON valga en cualquier entorno (y para la importación de la fase 13).
 * - Las políticas RLS de la migración comparan `scope = my_profile_id()::text`, es decir,
 *   el UUID del perfil. Si guardásemos el slug, nadie podría editar sus celdas.
 *
 * Así que la frontera se cruza aquí: hacia dentro, slugs; hacia la base de datos, UUIDs.
 */
export type ProfileDirectory = {
  profiles: Profile[];
  bySlug: (slug: string) => Profile | undefined;
  byId: (id: string) => Profile | undefined;
  /** UUID o "shared" → slug o "shared". */
  toDomainScope: (dbScope: string) => string;
  /** slug o "shared" → UUID o "shared". */
  toDbScope: (domainScope: string) => string;
};

export function buildProfileDirectory(profiles: Profile[]): ProfileDirectory {
  const bySlug = new Map(profiles.map((profile) => [profile.slug, profile]));
  const byId = new Map(profiles.map((profile) => [profile.id, profile]));

  return {
    profiles,
    bySlug: (slug) => bySlug.get(slug),
    byId: (id) => byId.get(id),
    toDomainScope: (dbScope) =>
      dbScope === 'shared' ? 'shared' : (byId.get(dbScope)?.slug ?? dbScope),
    toDbScope: (domainScope) =>
      domainScope === 'shared' ? 'shared' : (bySlug.get(domainScope)?.id ?? domainScope),
  };
}
