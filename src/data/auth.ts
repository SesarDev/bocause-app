/**
 * Sesión y vinculación con el perfil.
 *
 * Entrar tiene dos pasos: primero el magic link identifica al usuario (quién eres para
 * Supabase) y después se elige el perfil del hogar (si eres Cristina o Andrés). El segundo
 * paso usa las funciones de 0002_claim_profile.sql, porque hasta tener perfil las políticas
 * de la base de datos no te dejan ni leer la lista.
 */
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { toProfile, type Profile } from './mappers';
import { persister, queryClient } from './queryClient';
import { setActiveHousehold } from './scope';

export const authKeys = {
  profiles: ['auth', 'available-profiles'] as const,
  myProfile: ['auth', 'my-profile'] as const,
};

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

export async function signInWithMagicLink(email: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim(),
    options: { emailRedirectTo: window.location.origin },
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

export type AvailableProfile = {
  id: string;
  slug: string;
  displayName: string;
  taken: boolean;
};

/** Perfiles que este usuario puede ocupar. Solo tiene sentido con sesión iniciada. */
export function useAvailableProfiles(enabled: boolean) {
  return useQuery({
    queryKey: authKeys.profiles,
    enabled,
    queryFn: async (): Promise<AvailableProfile[]> => {
      const { data, error } = await supabase.rpc('available_profiles');
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id,
        slug: row.slug,
        displayName: row.display_name,
        taken: row.taken,
      }));
    },
  });
}

/** El perfil de este usuario, o null si todavía no ha elegido. */
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
      // con "este usuario no tiene perfil". El resultado era mandar al selector de perfil
      // a alguien que ya tenía el suyo, y dejarlo encerrado allí.
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;

      const userId = sessionData.session?.user.id;
      if (!userId) return null;

      const { data, error } = await supabase
        .from('profiles')
        .select('id, user_id, household_id, slug, display_name')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;
      return data ? toProfile(data) : null;
    },
  });
}

export function useClaimProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (profileId: string): Promise<Profile> => {
      const { data, error } = await supabase.rpc('claim_profile', { p_profile_id: profileId });
      if (error) throw error;
      return toProfile(data);
    },
    onSuccess: async () => {
      // Con perfil ya se es miembro del hogar: ahora sí se puede leer todo lo demás.
      await queryClient.invalidateQueries();
    },
  });
}

export function useReleaseProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<void> => {
      const { error } = await supabase.rpc('release_my_profile');
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries();
    },
  });
}
