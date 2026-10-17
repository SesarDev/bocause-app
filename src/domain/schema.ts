import { z } from "zod";

/* ───────────────────────── Identificadores básicos ───────────────────────── */

export const ProfileId = z.string().min(1); // uuid en Supabase, "cristina" | "andres" en el seed
export type ProfileId = z.infer<typeof ProfileId>;

export const DayIndex = z.number().int().min(0).max(6); // 0 = lunes … 6 = domingo
export type DayIndex = z.infer<typeof DayIndex>;

export const SlotKey = z.enum(["desayuno", "snack", "snack2", "almuerzo", "comida", "cena"]);
export type SlotKey = z.infer<typeof SlotKey>;

/** "shared" para comida/cena; el id del perfil para franjas individuales. */
export const Scope = z.union([z.literal("shared"), ProfileId]);
export type Scope = z.infer<typeof Scope>;

export const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/* ───────────────────────────── Alimentos ───────────────────────────── */

export const SupermarketSection = z.enum([
  "fruteria", "verduleria", "carniceria", "charcuteria", "pescaderia",
  "lacteos_huevos", "panaderia", "despensa", "congelados", "suplementos", "otros",
]);
export type SupermarketSection = z.infer<typeof SupermarketSection>;

/** Catálogo normalizado para sumar cantidades en la lista de la compra. */
export const Food = z.object({
  key: z.string(),                // "pechuga-pavo", "pan-molde-integral"
  name: z.string(),               // "Pechuga de pavo"
  section: SupermarketSection,
  unit: z.enum(["g", "ml", "ud"]).default("g"),
  batchable: z.boolean().default(false), // apto para batch cooking
  keepsDays: z.number().int().optional(),
});
export type Food = z.infer<typeof Food>;

/** Ración de una persona. Todo opcional: el PDF mezcla formatos. */
export const Portion = z.object({
  rawG: z.number().positive().optional(),    // "CR" / g en crudo
  cookedG: z.number().positive().optional(), // "CC" / g en cocido
  ml: z.number().positive().optional(),
  units: z.number().positive().optional(),
  measure: z.string().optional(),            // "1/3 de bandeja 500 g", "al gusto"
});
export type Portion = z.infer<typeof Portion>;

export const FoodItem = z.object({
  id: z.string(),
  foodKey: z.string().optional(),            // referencia a Food (null = texto libre)
  label: z.string(),                         // "Jamón serrano sin grasa"
  /** Una entrada por persona que lo come. Ausente = esa persona no lo toma. */
  portions: z.record(ProfileId, Portion),
  note: z.string().optional(),               // "batir todo junto", "bolsa o al gusto"
  /** De qué se cambió, si viene de una sustitución (fase 18). Permite "En lugar de…". */
  replaces: z.object({ foodKey: z.string().optional(), label: z.string() }).optional(),
});
export type FoodItem = z.infer<typeof FoodItem>;

/* ───────────────────────────── Bloques ───────────────────────────── */

export const SectionKind = z.enum(["plato", "pan", "postre", "bebida", "extra"]);
export type SectionKind = z.infer<typeof SectionKind>;

export const Section = z.object({
  id: z.string(),
  kind: SectionKind,
  title: z.string().optional(),              // "[PASTA CON BOLOÑESA]" → "Pasta con boloñesa"
  items: z.array(FoodItem),
  recipeId: z.string().optional(),
});
export type Section = z.infer<typeof Section>;

/** Unidad que se intercambia: todo lo que hay en una celda de la tabla. */
export const Block = z.object({
  id: z.string(),
  planId: z.string(),
  slot: SlotKey,
  scope: Scope,
  sections: z.array(Section).min(1),         // varios "plato" = primero/segundo (el "---" del PDF)
  isOriginal: z.boolean(),
  originBlockId: z.string().optional(),      // copy-on-write
});
export type Block = z.infer<typeof Block>;

/* ───────────────────────── Plantilla y semana ───────────────────────── */

export const CellKey = z.object({ day: DayIndex, slot: SlotKey, scope: Scope });
export type CellKey = z.infer<typeof CellKey>;

export const TemplateCell = CellKey.extend({ blockId: z.string().nullable() });
export type TemplateCell = z.infer<typeof TemplateCell>;

export const WeekOverride = CellKey.extend({
  weekStart: IsoDate,                        // lunes
  blockId: z.string().nullable(),            // null = celda vaciada en esta semana
  isFree: z.boolean().default(false),        // ingesta libre
});
export type WeekOverride = z.infer<typeof WeekOverride>;

/* ─────────────────────── Entreno, comodín, recetas ─────────────────────── */

export const TrainingType = z.string();      // "Gimnasio (Fuerza - Hipertrofia)", "Running", "Caminar"

export const SupplementProtocol = z.object({
  trainingType: TrainingType,
  pre: z.string().optional(),
  intra: z.string().optional(),              // "ETT" en el PDF
  post: z.string().optional(),
});

export const ComodinOption = z.object({
  id: z.string(),
  label: z.string(),                         // "Pechuga de pavo"
  amount: z.string(),                        // "50 g"
  measure: z.string().optional(),            // "3 lonchas finas"
});

export const Recipe = z.object({
  id: z.string(),
  title: z.string(),
  ingredients: z.array(z.object({
    label: z.string(), rawG: z.string().optional(), cookedG: z.string().optional(), measure: z.string().optional(),
  })),
  steps: z.array(z.string()),
  kind: z.enum(["plato", "cheat_meal"]).default("plato"),
});

export const ProfilePlan = z.object({
  profileId: ProfileId,
  displayName: z.string(),
  slots: z.array(SlotKey),                   // orden de franjas de esta persona
  training: z.array(TrainingType.nullable()).length(7),
  supplements: z.array(SupplementProtocol),
  comodin: z.array(ComodinOption),
});
export type ProfilePlan = z.infer<typeof ProfilePlan>;
export type SupplementProtocol = z.infer<typeof SupplementProtocol>;
export type ComodinOption = z.infer<typeof ComodinOption>;
export type Recipe = z.infer<typeof Recipe>;

export const Rules = z.object({
  aoveMaxSpoonsPerWeek: z.number().default(14),
  freeMealsPerWeek: z.number().default(2),
  waterLitersMin: z.number().default(2),
  waterLitersMax: z.number().default(3),
  comodinRequired: z.boolean().default(true),
  recommendations: z.array(z.string()),
});
export type Rules = z.infer<typeof Rules>;

/** Documento completo de un plan mensual tal como sale del PDF. */
export const Plan = z.object({
  id: z.string(),                            // "2026-09"
  name: z.string(),                          // "Septiembre 2026"
  issuedOn: IsoDate,                         // fecha del PDF
  validFrom: IsoDate,
  validTo: IsoDate.optional(),
  profiles: z.array(ProfilePlan).min(1),
  blocks: z.array(Block),
  template: z.array(TemplateCell),
  recipes: z.array(Recipe),
  foods: z.array(Food),
  rules: Rules,
});
export type Plan = z.infer<typeof Plan>;

/* ───────────────────────────── Registro diario ───────────────────────────── */

export const Check = z.object({
  profileId: ProfileId,
  date: IsoDate,
  slot: SlotKey,
  itemId: z.string(),
  checked: z.boolean(),
});
export type Check = z.infer<typeof Check>;

export const DailyLog = z.object({
  profileId: ProfileId,
  date: IsoDate,
  comodinOptionId: z.string().nullable(),
  comodinDone: z.boolean().default(false),
  waterMl: z.number().int().min(0).default(0),
  aoveSpoons: z.number().int().min(0).default(0),
});
export type DailyLog = z.infer<typeof DailyLog>;

export const MealNote = z.object({
  profileId: ProfileId,
  date: IsoDate,
  slot: SlotKey,
  hunger: z.number().int().min(1).max(5).optional(),
  text: z.string().max(500).optional(),
});
export type MealNote = z.infer<typeof MealNote>;

export const ShoppingItem = z.object({
  id: z.string(),
  weekStart: IsoDate,
  source: z.enum(["auto", "manual"]),
  foodKey: z.string().optional(),            // para "auto": clave de agregación
  label: z.string(),
  quantityText: z.string().optional(),       // "1.240 g", "6 ud"
  section: SupermarketSection,
  checked: z.boolean().default(false),
  inPantry: z.boolean().default(false),      // "ya lo tengo"
});
export type ShoppingItem = z.infer<typeof ShoppingItem>;

/* ─────────────────────── Biblioteca y equivalencias (fase 15) ─────────────────────── */

/**
 * Un alimento tal como vive en la biblioteca: con UNA ración base, no una por persona.
 * Al usar el bloque se instancia para cada comensal multiplicando esa base (ver
 * `src/domain/library.ts`). Es la diferencia con `FoodItem`, que ya está repartido.
 */
export const LibraryItem = z.object({
  id: z.string(),
  foodKey: z.string().optional(),
  label: z.string(),
  base: Portion,                             // ración de referencia (multiplicador 1)
  note: z.string().optional(),
});
export type LibraryItem = z.infer<typeof LibraryItem>;

export const LibrarySection = z.object({
  id: z.string(),
  kind: SectionKind,
  title: z.string().optional(),
  items: z.array(LibraryItem),
});
export type LibrarySection = z.infer<typeof LibrarySection>;

/** Bloque prehecho. `slots` dice en qué franjas tiene sentido ofrecerlo. */
export const LibraryBlock = z.object({
  id: z.string(),
  name: z.string().min(1),
  slots: z.array(SlotKey),
  tags: z.array(z.string()).default([]),
  sections: z.array(LibrarySection).min(1),
  notes: z.string().optional(),
  archived: z.boolean().default(false),
});
export type LibraryBlock = z.infer<typeof LibraryBlock>;

/**
 * Un alimento dentro de un grupo de equivalencia, con cuánto cunde respecto al grupo.
 * `factor` 1 = misma cantidad; 0,5 = hace falta la mitad. Lo decide la nutricionista:
 * la app no inventa equivalencias (regla de CLAUDE.md).
 */
export const EquivalenceMember = z.object({
  foodKey: z.string(),
  factor: z.number().positive().default(1),
  note: z.string().optional(),
});
export type EquivalenceMember = z.infer<typeof EquivalenceMember>;

export const EquivalenceGroup = z.object({
  id: z.string(),
  name: z.string().min(1),                   // "Legumbres", "Cereales de desayuno"
  description: z.string().optional(),
  members: z.array(EquivalenceMember),
  archived: z.boolean().default(false),
});
export type EquivalenceGroup = z.infer<typeof EquivalenceGroup>;
