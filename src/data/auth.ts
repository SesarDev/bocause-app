/**
 * Sesión y perfil.
 *
 * Se entra con **usuario y contraseña**, y quien entra ya es alguien: el perfil se lo
 * asignó la nutricionista al dar de alta la cuenta (0010_cuentas.sql). No hay nada que
 * elegir, ni lista de perfiles libres que ofrecer.
 *
 * Supabase identifica las cuentas por correo, así que "marta" viaja por dentro como
 * `marta@bocause.local`. Ese correo no es un buzón: no se manda nada a esas direcciones.
 */
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Session } from '@supabase/supabase-js';
import { brand } from '../config/brand';
import { supabase } from './supabase';
import { toProfile, type Profile } from './mappers';
import { persister, queryClient } from './queryClient';
import { setActiveHousehold } from './scope';

export const authKeys = {
  myProfile: ['auth', 'my-profile'] as const,
};

/**
 * El correo interno de un usuario.
 *
 * Si ya viene con arroba se respeta tal cual: las cuentas de antes de la 0010 tienen el
 * correo de verdad de su dueño, y dejarlas fuera sería dejar a esas personas fuera.
 */
export function emailForUser(usuario: string, domain = brand.auth.userDomain): string {
  const limpio = usuario.trim().toLocaleLowerCase('es-ES');
  return limpio.includes('@') ? limpio : `${limpio}@${domain}`;
}

/** Sesión actual. undefined mientras se comprueba, null si no hay. */
export function useSession(): { session: Session | null; loading: boolean } {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    let active = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
      // Al cambiar de usuario, la caché del anterior ya no vale.
      void queryClient.invalidateQueries();
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [queryClient]);

  return { session, loading };
}

/**
 * Entrar. La sesión se guarda y se renueva sola: en el móvil, de la cocina al súper, nadie
 * quiere volver a escribir una contraseña.
 */
export async function signIn(usuario: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({
    email: emailForUser(usuario),
    password,
  });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  // El orden importa: se borra la caché persistida ANTES de cerrar la sesión. Al revés, el
  // token ya no estaría en localStorage, `storedUserId()` devolvería null y borraríamos la
  // caché equivocada, dejando la del usuario que sale guardada en el móvil.
  await persister.removeClient();
  queryClient.clear();
  setActiveHousehold(null);

  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/** El perfil de esta cuenta, o null si la nutricionista no le ha asignado ninguno. */
export function useMyProfile(enabled: boolean) {
  return useQuery({
    queryKey: authKeys.myProfile,
    enabled,
    // Mientras no se sepa qué perfil es, se reintenta solo cada cinco segundos. En el móvil
    // la radio tarda en despertar al abrir la app, y de esto no se sale pidiéndole a nadie
    // que pulse un botón: se sale insistiendo.
    refetchInterval: (query) => (query.state.data === undefined ? 5000 : false),
    queryFn: async (): Promise<Profile | null> => {
      // getSession() lee la sesión del almacenamiento local. Antes esto usaba getUser(),
      // que va a la red: sin cobertura devolvía "no hay usuario", y aquí eso se confundía
      // con "esta cuenta no tiene perfil", que es la pantalla de "aún no te han dado de
      // alta". A quien ya tenía su perfil se le negaba su propia dieta por un túnel.
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;

      const userId = sessionData.session?.user.id;
      if (!userId) return null;

      const { data, error } = await supabase
        .from('profiles')
        .select('id, user_id, household_id, slug, display_name, portion_multiplier')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;
      return data ? toProfile(data) : null;
    },
  });
}
