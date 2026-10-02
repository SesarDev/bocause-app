import { useEffect } from 'react';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { persistOptions, queryClient } from '../data/queryClient';
import { supabaseConfigured } from '../data/supabase';
import { useMyProfile, useSession } from '../data/auth';
import { ThemeProvider } from '../features/theme/ThemeProvider';
import { AppShell } from '../features/shell/AppShell';
import { LoginScreen } from '../features/auth/LoginScreen';
import { ProfilePicker } from '../features/auth/ProfilePicker';
import { SetupScreen } from '../features/auth/SetupScreen';
import { useUiStore, type ProfileId } from '../stores/ui';

export function App() {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={persistOptions}
      // Al rehidratar la caché se reanudan las mutaciones que quedaron en pausa sin red.
      onSuccess={() => {
        void queryClient.resumePausedMutations();
      }}
    >
      <ThemeProvider>
        <Gate />
      </ThemeProvider>
    </PersistQueryClientProvider>
  );
}

/**
 * Decide qué pantalla toca: configurar, entrar, elegir perfil o la app.
 * Son cuatro estados y conviene que estén juntos y en orden, porque es el único sitio
 * donde se decide si alguien ve los datos del hogar.
 */
function Gate() {
  const { session, loading } = useSession();
  const profileQuery = useMyProfile(session !== null);
  const setActiveProfile = useUiStore((state) => state.setActiveProfile);

  const slug = profileQuery.data?.slug;

  useEffect(() => {
    if (slug) setActiveProfile(slug as ProfileId);
  }, [slug, setActiveProfile]);

  if (!supabaseConfigured) return <SetupScreen />;
  if (loading) return <Splash />;
  if (!session) return <LoginScreen />;
  if (profileQuery.isLoading) return <Splash />;
  if (!profileQuery.data) return <ProfilePicker />;

  return <AppShell />;
}

function Splash() {
  return (
    <main className="grid min-h-dvh place-items-center bg-bg">
      <p className="text-lg font-extrabold tracking-[0.1em] text-ink">
        BOCAUSE
        <span aria-hidden="true" className="ml-0.5 text-accent">
          .
        </span>
      </p>
    </main>
  );
}
