/**
 * Realtime: lo que toca uno aparece en el móvil del otro sin recargar.
 *
 * Se invalida la consulta afectada en vez de aplicar el cambio a mano. Es más tráfico pero
 * mucho menos frágil, y con la caché persistida el refresco es casi instantáneo. Las tablas
 * son las que publica la migración en `supabase_realtime`.
 *
 * Cada suscripción lleva su `filter`. Sin él, el servidor manda **todos** los cambios de la
 * tabla y el cliente invalida consultas por cosas de otros hogares: hoy solo sería tráfico
 * de más, pero en cuanto haya varias casas sería una fuga de actividad ajena (saber cuándo
 * otro marca una comida) además de refrescos constantes.
 *
 * `checks` y `daily_logs` no tienen columna de hogar, cuelgan del perfil, y
 * `postgres_changes` solo admite un filtro por suscripción: por eso se suscribe una vez por
 * perfil del hogar en lugar de una vez por tabla.
 */
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { keysFor } from './keys';
import { useActiveHousehold } from './scope';
import { useProfiles } from './queries';

export function useRealtimeSync(planId: string | undefined, weekStart: string): void {
  const queryClient = useQueryClient();
  const householdId = useActiveHousehold();
  const { data: profiles } = useProfiles();

  // Se serializa para que el efecto no se reenganche en cada render por una lista nueva.
  const profileIds = (profiles ?? []).map((profile) => profile.id).join(',');

  useEffect(() => {
    if (!planId || householdId === null) return;

    const keys = keysFor(householdId);
    const invalidate = (key: readonly unknown[]) => () => {
      void queryClient.invalidateQueries({ queryKey: key });
    };

    const channel = supabase
      .channel(`bocause:${householdId}:${planId}:${weekStart}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'template_cells',
          filter: `plan_id=eq.${planId}`,
        },
        invalidate(keys.templateCells(planId)),
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'week_overrides',
          filter: `plan_id=eq.${planId}`,
        },
        invalidate(keys.weekOverrides(planId, weekStart)),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'blocks', filter: `plan_id=eq.${planId}` },
        invalidate(keys.blocks(planId)),
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shopping_items',
          filter: `household_id=eq.${householdId}`,
        },
        invalidate(keys.shoppingItems(weekStart)),
      );

    for (const profileId of profileIds === '' ? [] : profileIds.split(',')) {
      channel
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'checks', filter: `profile_id=eq.${profileId}` },
          invalidate(keys.checks(weekStart)),
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'daily_logs',
            filter: `profile_id=eq.${profileId}`,
          },
          invalidate(keys.dailyLogs(weekStart)),
        );
    }

    channel.subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, planId, weekStart, householdId, profileIds]);
}
