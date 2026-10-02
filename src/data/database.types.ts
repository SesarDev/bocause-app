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
        Omit<ProfileRow, 'id' | 'theme' | 'claim_email'> & {
          id?: string;
          theme?: string;
          claim_email?: string | null;
        }
      >;
      plans: Table<
        PlanRow,
        Omit<PlanRow, 'created_at' | 'status' | 'valid_to'> & {
          status?: string;
          valid_to?: string | null;
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
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};
