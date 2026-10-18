/**
 * Datos del constructor de dietas.
 *
 * El borrador es un documento con forma de `Plan` guardado en `diet_drafts`, uno por hogar.
 * Mientras está en borrador no existe para el cliente: solo al publicar se convierte en una
 * versión de `plans` y pasa a verse.
 *
 * El hogar que mira la nutricionista se fija con `setActiveHousehold`, igual que hace la app
 * del cliente con el suyo. Por eso las consultas de siempre (`usePlan`, `useEditedBlocks`…)
 * sirven aquí sin tocarlas: para eso se separó el hogar activo en `scope.ts`.
 */
import { createClient } from '@supabase/supabase-js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plan } from '../domain/schema';
import type { Block, TemplateCell, WeekOverride } from '../domain/schema';
import type { CarryOverResult } from '../domain/carryOver';
import { emailForUser } from './auth';
import type { Database } from './database.types';
import { consultaKeys, keysFor } from './keys';
import { supabase, supabaseAnonKey, supabaseUrl } from './supabase';
import type { ProfileDirectory } from './mappers';

/* ─────────────────────── Hogares (vista de la nutricionista) ─────────────────────── */

export type HouseholdSummary = {
  id: string;
  name: string;
  people: { id: string; slug: string; displayName: string; portionMultiplier: number }[];
  /** La dieta vigente, si la hay. */
  plan: { id: string; name: string; validFrom: string; version: number } | null;
};

export function useHouseholds() {
  return useQuery({
    queryKey: [...consultaKeys.all, 'households'] as const,
    queryFn: async (): Promise<HouseholdSummary[]> => {
      const [households, profiles, plans] = await Promise.all([
        supabase.from('households').select('id, name').order('name'),
        supabase
          .from('profiles')
          .select('id, household_id, slug, display_name, portion_multiplier'),
        supabase
          .from('plans')
          .select('id, household_id, name, valid_from, version, status')
          .eq('status', 'active'),
      ]);

      if (households.error) throw households.error;
      if (profiles.error) throw profiles.error;
      if (plans.error) throw plans.error;

      return (households.data ?? []).map((household) => ({
        id: household.id,
        name: household.name,
        people: (profiles.data ?? [])
          .filter((profile) => profile.household_id === household.id)
          .map((profile) => ({
            id: profile.id,
            slug: profile.slug,
            displayName: profile.display_name,
            portionMultiplier: profile.portion_multiplier,
          })),
        plan:
          (plans.data ?? [])
            .filter((plan) => plan.household_id === household.id)
            .map((plan) => ({
              id: plan.id,
              name: plan.name,
              validFrom: plan.valid_from,
              version: plan.version,
            }))[0] ?? null,
      }));
    },
  });
}

/**
 * Crear hogares y personas va por RPC, no por escritura directa.
 *
 * La 0002 limitó la escritura de `profiles` a la columna `theme` con un permiso **por
 * columna**, y ese candado alcanza también a la nutricionista porque también es
 * `authenticated`. Ninguna política RLS puede devolvérselo: las políticas dicen qué filas,
 * no qué columnas. Ver 0004_staff.sql.
 */
export function useCreateHousehold() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.rpc('staff_create_household', { p_name: name });
      if (error) throw error;
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: [...consultaKeys.all, 'households'] }),
  });
}

export function useUpsertProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (vars: {
      householdId: string;
      slug: string;
      displayName: string;
      claimEmail: string | null;
      portionMultiplier: number;
      /** Cuenta a la que pertenece este perfil, si se acaba de crear. */
      userId?: string | null;
    }) => {
      const { error } = await supabase.rpc('staff_upsert_profile', {
        p_household_id: vars.householdId,
        p_slug: vars.slug,
        p_display_name: vars.displayName,
        p_claim_email: vars.claimEmail,
        p_portion_multiplier: vars.portionMultiplier,
        p_user_id: vars.userId ?? null,
      });
      if (error) throw error;
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: [...consultaKeys.all, 'households'] }),
  });
}

/**
 * Da de alta la **cuenta** de un cliente: usuario y contraseña, y el perfil ya enlazado.
 *
 * El alta va con la clave pública, no con la `service_role`, que no puede pisar un
 * navegador. Eso obliga a un rodeo: `signUp` deja la sesión recién creada como sesión
 * activa del cliente que la hizo, así que se usa **un cliente de Supabase aparte**, sin
 * guardar sesión ni renovarla. Si no, la nutricionista se quedaría dentro de la cuenta de
 * su paciente en mitad de la pantalla de hogares.
 *
 * Que no se mande ningún correo depende de una casilla del panel de Supabase
 * ("Confirm email", apagada). Si estuviera encendida, la cuenta nacería sin confirmar y la
 * persona no podría entrar: por eso se comprueba y se avisa en claro.
 */
export function useCreateClientAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (vars: {
      householdId: string;
      slug: string;
      displayName: string;
      usuario: string;
      password: string;
      portionMultiplier: number;
    }) => {
      const email = emailForUser(vars.usuario);

      const aparte = createClient<Database>(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      });

      const { data, error } = await aparte.auth.signUp({ email, password: vars.password });
      if (error) throw error;

      const userId = data.user?.id;
      if (userId === undefined) {
        throw new Error('Supabase no devolvió la cuenta nueva. Inténtalo otra vez.');
      }
      if (data.session === null) {
        throw new Error(
          'La cuenta se ha creado pero pide confirmar un correo que no existe. Apaga ' +
            '"Confirm email" en Supabase → Authentication → Sign In / Providers → Email.',
        );
      }

      const { error: perfilError } = await supabase.rpc('staff_upsert_profile', {
        p_household_id: vars.householdId,
        p_slug: vars.slug,
        p_display_name: vars.displayName,
        p_claim_email: email,
        p_portion_multiplier: vars.portionMultiplier,
        p_user_id: userId,
      });
      if (perfilError) throw perfilError;
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: [...consultaKeys.all, 'households'] }),
  });
}

/* ─────────────────────── Borrador ─────────────────────── */

export function draftKey(householdId: string) {
  return [...keysFor(householdId).all, 'draft'] as const;
}

export function useDraft(householdId: string | null) {
  return useQuery({
    queryKey: draftKey(householdId ?? ''),
    enabled: householdId !== null,
    queryFn: async (): Promise<Plan | null> => {
      const { data, error } = await supabase
        .from('diet_drafts')
        .select('data')
        .eq('household_id', householdId!)
        .maybeSingle();
      if (error) throw error;
      return data === null ? null : Plan.parse(data.data);
    },
  });
}

export function useSaveDraft(householdId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ plan, basePlanId }: { plan: Plan; basePlanId: string | null }) => {
      // Se valida antes de guardar: un borrador roto se arrastraría hasta la publicación.
      const validado = Plan.parse(plan);

      const { error } = await supabase.from('diet_drafts').upsert(
        {
          household_id: householdId!,
          base_plan_id: basePlanId,
          data: validado as never,
          updated_by: null,
        },
        { onConflict: 'household_id' },
      );
      if (error) throw error;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: draftKey(householdId ?? '') }),
  });
}

export function useDiscardDraft(householdId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('diet_drafts')
        .delete()
        .eq('household_id', householdId!);
      if (error) throw error;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: draftKey(householdId ?? '') }),
  });
}

/* ─────────────────────── Publicar ─────────────────────── */

export type PublishVars = {
  householdId: string;
  planId: string;
  plan: Plan;
  validFrom: string;
  /** Plantilla de la dieta nueva, ya con los scopes de la base de datos. */
  cells: TemplateCell[];
  carry: CarryOverResult;
  scopes: ProfileDirectory;
};

/**
 * Publica en una sola llamada. Toda la escritura ocurre dentro de `publish_plan` (0008), en
 * una transacción: si algo falla, el hogar no se queda con dos dietas vigentes ni con una
 * dieta sin plantilla.
 *
 * La traducción slug → UUID se hace aquí, que es la frontera del proyecto; la RPC recibe las
 * celdas ya traducidas.
 */
export function usePublishPlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (vars: PublishVars) => {
      const toDb = (scope: string) => vars.scopes.toDbScope(scope);

      const cells = vars.cells.map((cell) => ({
        day: cell.day,
        slot: cell.slot,
        scope: toDb(cell.scope),
        block_id: cell.blockId,
      }));

      const carry = {
        blocks: vars.carry.blocks.map((block: Block) => ({
          id: block.id,
          slot: block.slot,
          scope: toDb(block.scope),
          origin_block_id: block.originBlockId ?? null,
          content: { sections: block.sections },
        })),
        cells: vars.carry.cells.map((cell: TemplateCell) => ({
          day: cell.day,
          slot: cell.slot,
          scope: toDb(cell.scope),
          block_id: cell.blockId,
        })),
        overrides: vars.carry.overrides.map((override: WeekOverride) => ({
          week_start: override.weekStart,
          day: override.day,
          slot: override.slot,
          scope: toDb(override.scope),
          block_id: override.blockId,
          is_free: override.isFree,
        })),
      };

      const { error } = await supabase.rpc('publish_plan', {
        p_household: vars.householdId,
        p_plan_id: vars.planId,
        p_plan: vars.plan as never,
        p_valid_from: vars.validFrom,
        p_cells: cells as never,
        p_carry: carry as never,
      });
      if (error) throw error;
    },
    onSettled: () => queryClient.invalidateQueries(),
  });
}
