/**
 * ¿Quien ha entrado es nutricionista?
 *
 * Lo decide la base de datos con `is_staff()` (0004_staff.sql), no el cliente. Esto es solo
 * para saber qué pintar: aunque alguien se saltara la comprobación de la interfaz y abriera
 * `/admin` a la fuerza, no vería nada, porque lo que de verdad manda son las políticas RLS.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';

export const staffKeys = {
  isStaff: ['auth', 'is-staff'] as const,
};

export function useIsStaff(enabled: boolean) {
  return useQuery({
    queryKey: staffKeys.isStaff,
    enabled,
    // Cambia muy de vez en cuando y se consulta en cada arranque: una hora está bien.
    staleTime: 1000 * 60 * 60,
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase.rpc('is_staff');
      if (error) throw error;
      return data === true;
    },
  });
}
