/**
 * Tipos de la base de datos, escritos a mano a partir de supabase/migrations/0001_init.sql.
 *
 * Lo normal sería generarlos con `npx supabase gen types typescript`, que requiere la CLI
 * enlazada al proyecto. Cuando esté disponible, este archivo se puede sustituir por el
 * generado sin tocar nada más: el resto del código solo depende de `Database`.
 */

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

/**
 * Fila tal cual la devuelve Postgres, con los nombres en snake_case.
 * `Relationships` lo exige el cliente tipado de supabase-js aunque esté vacío; sin él los
 * genéricos se resuelven a `never` y todas las consultas dejan de tipar.
 */
type Table<Row, Insert = Row, Update = Partial<Insert>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type HouseholdRow = {
  id: string;
  name: string;
  created_at: string;
};

export type ProfileRow = {
  id: string;
  user_id: string | null;
  household_id: string;
  slug: string;
  display_name: string;
  theme: 'system' | 'light' | 'dark';
  /** Correo autorizado a ocupar el perfil (0002_claim_profile.sql). */
  claim_email: string | null;
  /** Cuánto come esta persona respecto a la ración base de la biblioteca (0004_staff.sql). */
  portion_multiplier: number;
};

/**
 * Quién es nutricionista (0004_staff.sql). La tabla no tiene políticas de escritura: solo
 * se entra con la clave service_role, desde `npm run staff:add`.
 */
export type StaffMemberRow = {
  user_id: string;
  display_name: string;
  role: 'nutricionista';
  created_at: string;
};

/* ─────────── Catálogo, biblioteca y equivalencias (0007_library.sql) ───────────
 *
 * Son de la consulta, no de un hogar: una app por consulta (decisión 1 de PLAN.md), así
 * que no llevan `household_id`. Las lee cualquiera que haya entrado; las escribe staff.
 */

export type FoodRow = {
  key: string;
  name: string;
  section: string;
  unit: 'g' | 'ml' | 'ud';
  batchable: boolean;
  keeps_days: number | null;
  archived: boolean;
  updated_at: string;
};

export type LibraryBlockRow = {
  id: string;
  name: string;
  slots: string[];
  tags: string[];
  /** { sections: LibrarySection[] } con UNA ración base por alimento. */
  content: Json;
  notes: string | null;
  archived: boolean;
  created_by: string | null;
  updated_at: string;
};

export type EquivalenceGroupRow = {
  id: string;
  name: string;
  description: string | null;
  /** EquivalenceMember[]: las decide la nutricionista, la app no las inventa. */
  members: Json;
  archived: boolean;
  updated_at: string;
};

/**
 * Registro de cambios (0006_change_log.sql). Lo escriben triggers de Postgres; desde la app
 * solo se lee. No tiene políticas de UPDATE ni DELETE: es solo de añadir.
 */
export type ChangeLogRow = {
  id: string;
  household_id: string;
  plan_id: string;
  /** Transacción: las celdas de un mismo intercambio la comparten. */
  tx_id: number;
  actor_user_id: string | null;
  actor_role: 'cliente' | 'nutricionista' | 'sistema';
  table_name: string;
  op: 'INSERT' | 'UPDATE' | 'DELETE';
  cell: Json;
  before: Json;
  after: Json;
  source: string;
  created_at: string;
};

export type PlanRow = {
  id: string;
  household_id: string;
  name: string;
  valid_from: string;
  valid_to: string | null;
  status: 'draft' | 'active' | 'archived';
  data: Json;
  created_at: string;
  /** Número de publicación dentro del hogar. Lo pone solo un trigger (0005). */
  version: number;
  published_at: string | null;
  published_by: string | null;
};

export type BlockRow = {
  id: string;
  plan_id: string;
  slot: string;
  scope: string;
  origin_block_id: string | null;
  content: Json;
  created_by: string | null;
  created_at: string;
};

export type TemplateCellRow = {
  plan_id: string;
  day: number;
  slot: string;
  scope: string;
  block_id: string | null;
  updated_by: string | null;
  updated_at: string;
};

export type WeekOverrideRow = {
  plan_id: string;
  week_start: string;
  day: number;
  slot: string;
  scope: string;
  block_id: string | null;
  is_free: boolean;
  updated_by: string | null;
  updated_at: string;
};

export type CheckRow = {
  profile_id: string;
  date: string;
  slot: string;
  item_id: string;
  checked: boolean;
  updated_at: string;
};

export type DailyLogRow = {
  profile_id: string;
  date: string;
  comodin_option_id: string | null;
  comodin_done: boolean;
  water_ml: number;
  aove_spoons: number;
  updated_at: string;
};

export type MealNoteRow = {
  profile_id: string;
  date: string;
  slot: string;
  hunger: number | null;
  text: string | null;
  updated_at: string;
};

export type ShoppingItemRow = {
  id: string;
  household_id: string;
  week_start: string;
  source: 'auto' | 'manual';
  food_key: string | null;
  label: string;
  quantity_text: string | null;
  section: string;
  checked: boolean;
  in_pantry: boolean;
  updated_by: string | null;
  updated_at: string;
};

export type PushSubscriptionRow = {
  id: string;
  profile_id: string;
  endpoint: string;
  keys: Json;
  created_at: string;
};

export type ReminderSettingsRow = {
  profile_id: string;
  enabled: boolean;
  slot_times: Json;
  comodin_reminder: string | null;
  water_every_minutes: number | null;
};

/** Campos con valor por defecto en Postgres: opcionales al insertar. */
export type Database = {
  public: {
    Tables: {
      households: Table<HouseholdRow, Omit<HouseholdRow, 'id' | 'created_at'> & { id?: string }>;
      profiles: Table<
        ProfileRow,
        Omit<ProfileRow, 'id' | 'theme' | 'claim_email' | 'portion_multiplier'> & {
          id?: string;
          theme?: string;
          claim_email?: string | null;
          portion_multiplier?: number;
        }
      >;
      staff_members: Table<
        StaffMemberRow,
        Omit<StaffMemberRow, 'role' | 'created_at'> & { role?: string }
      >;
      // Solo lectura desde la app: lo escriben los triggers.
      change_log: Table<ChangeLogRow, never>;
      foods: Table<
        FoodRow,
        Omit<
          FoodRow,
          'section' | 'unit' | 'batchable' | 'keeps_days' | 'archived' | 'updated_at'
        > & {
          section?: string;
          unit?: string;
          batchable?: boolean;
          keeps_days?: number | null;
          archived?: boolean;
        }
      >;
      library_blocks: Table<
        LibraryBlockRow,
        Omit<LibraryBlockRow, 'id' | 'updated_at'> & { id?: string }
      >;
      equivalence_groups: Table<
        EquivalenceGroupRow,
        Omit<EquivalenceGroupRow, 'id' | 'members' | 'archived' | 'updated_at' | 'description'> & {
          id?: string;
          description?: string | null;
          members?: Json;
          archived?: boolean;
        }
      >;
      plans: Table<
        PlanRow,
        // `version` no se envía al insertar: la numera el trigger de la 0005.
        Omit<
          PlanRow,
          'created_at' | 'status' | 'valid_to' | 'version' | 'published_at' | 'published_by'
        > & {
          status?: string;
          valid_to?: string | null;
          published_at?: string | null;
          published_by?: string | null;
        }
      >;
      blocks: Table<
        BlockRow,
        Omit<BlockRow, 'created_at' | 'origin_block_id' | 'created_by'> & {
          origin_block_id?: string | null;
          created_by?: string | null;
        }
      >;
      template_cells: Table<
        TemplateCellRow,
        Omit<TemplateCellRow, 'updated_at' | 'updated_by'> & {
          updated_by?: string | null;
        }
      >;
      week_overrides: Table<
        WeekOverrideRow,
        Omit<WeekOverrideRow, 'updated_at' | 'updated_by' | 'is_free'> & {
          is_free?: boolean;
          updated_by?: string | null;
        }
      >;
      checks: Table<CheckRow, Omit<CheckRow, 'updated_at' | 'checked'> & { checked?: boolean }>;
      daily_logs: Table<
        DailyLogRow,
        Omit<DailyLogRow, 'updated_at' | 'comodin_done' | 'water_ml' | 'aove_spoons'> & {
          comodin_done?: boolean;
          water_ml?: number;
          aove_spoons?: number;
        }
      >;
      meal_notes: Table<MealNoteRow, Omit<MealNoteRow, 'updated_at'>>;
      shopping_items: Table<
        ShoppingItemRow,
        Omit<ShoppingItemRow, 'id' | 'updated_at' | 'checked' | 'in_pantry' | 'updated_by'> & {
          id?: string;
          checked?: boolean;
          in_pantry?: boolean;
          updated_by?: string | null;
        }
      >;
      push_subscriptions: Table<
        PushSubscriptionRow,
        Omit<PushSubscriptionRow, 'id' | 'created_at'> & { id?: string }
      >;
      reminder_settings: Table<ReminderSettingsRow, ReminderSettingsRow>;
    };
    Views: Record<never, never>;
    Functions: {
      /** Perfiles que este usuario puede ocupar (ver 0002_claim_profile.sql). */
      available_profiles: {
        Args: Record<never, never>;
        Returns: { id: string; slug: string; display_name: string; taken: boolean }[];
      };
      claim_profile: {
        Args: { p_profile_id: string };
        Returns: ProfileRow;
      };
      release_my_profile: {
        Args: Record<never, never>;
        Returns: undefined;
      };
      /** ¿Quien pregunta es nutricionista? (0004_staff.sql) */
      is_staff: {
        Args: Record<never, never>;
        Returns: boolean;
      };
      /**
       * Altas de staff sobre hogares y perfiles. Van por función y no por política porque
       * la 0002 limitó la escritura de `profiles` a la columna `theme` con un permiso por
       * columna, que alcanza también a la nutricionista (ver 0004_staff.sql).
       */
      staff_create_household: {
        Args: { p_name: string };
        Returns: HouseholdRow;
      };
      staff_upsert_profile: {
        Args: {
          p_household_id: string;
          p_slug: string;
          p_display_name: string;
          p_claim_email?: string | null;
          p_portion_multiplier?: number;
        };
        Returns: ProfileRow;
      };
      /**
       * Restaurar en una sola transacción (0006). Antes eran varias peticiones sueltas y
       * podía quedarse a medias; además así el registro lo marca como 'restaurar'.
       */
      restore_cell: {
        Args: {
          p_plan_id: string;
          p_week_start: string;
          p_deletes?: Json;
          p_template?: Json;
        };
        Returns: undefined;
      };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};
