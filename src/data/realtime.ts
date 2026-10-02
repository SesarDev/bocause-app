/**
 * Realtime: lo que toca uno aparece en el móvil del otro sin recargar.
 *
 * Se invalida la consulta afectada en vez de aplicar el cambio a mano. Es más tráfico pero
 * mucho menos frágil, y con la caché persistida el refresco es casi instantáneo. Las tablas
 * son las que publica la migración en `supabase_realtime`.
 */
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { keys } from './queries';

export function useRealtimeSync(planId: string | undefined, weekStart: string): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!planId) return;

    const invalidate = (key: readonly unknown[]) => () => {
      void queryClient.invalidateQueries({ queryKey: key });
    };

    const channel = supabase
      .channel(`bocause:${planId}:${weekStart}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'template_cells' },
        invalidate(keys.templateCells(planId)),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'week_overrides' },
        invalidate(keys.weekOverrides(planId, weekStart)),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'blocks' },
        invalidate(keys.blocks(planId)),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'checks' },
        invalidate(keys.checks(weekStart)),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'daily_logs' },
        invalidate(keys.dailyLogs(weekStart)),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shopping_items' },
        invalidate(keys.shoppingItems(weekStart)),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, planId, weekStart]);
}
