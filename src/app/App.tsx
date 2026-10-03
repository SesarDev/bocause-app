import { useEffect, useState } from 'react';
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
  // Diez segundos, no seis: un móvil que despierta de la pantalla apagada tarda lo suyo en
  // tener red, y asustar a alguien con un aviso mientras todo va bien es peor que esperar.
  const tarda = useTimeout(10_000);

  const slug = profileQuery.data?.slug;

  useEffect(() => {
    if (slug) setActiveProfile(slug as ProfileId);
  }, [slug, setActiveProfile]);

  if (!supabaseConfigured) return <SetupScreen />;
  if (loading) return <Splash />;
  if (!session) return <LoginScreen />;

  // Mientras no se sepa si hay perfil, no se decide nada. `isPending` también cubre la
  // consulta pausada por falta de red, que `isLoading` daba por terminada: con eso, un
  // corte de cobertura mandaba al selector de perfil a quien ya tenía el suyo.
  if (profileQuery.isPending) {
    if (profileQuery.fetchStatus === 'paused') {
      return (
        <Problem
          title="Sin conexión"
          detail="No se puede comprobar tu perfil ahora mismo. Se reintenta solo al volver la cobertura."
          onRetry={() => void profileQuery.refetch()}
        />
      );
    }
    // Sin red, la consulta puede tardar más de veinte segundos en darse por vencida. Nadie
    // se queda mirando un splash mudo tanto rato: pasado un tiempo se dice qué ocurre. La
    // app sigue reintentando sola por debajo, así que el botón es un atajo, no la salida.
    if (tarda) {
      return (
        <Problem
          title="Tardando más de lo normal"
          detail="Seguimos intentándolo. Si no arranca, comprueba la conexión del móvil."
          onRetry={() => void profileQuery.refetch()}
        />
      );
    }
    return <Splash />;
  }

  if (profileQuery.isError) {
    return (
      <Problem
        title="No se pudo cargar tu perfil"
        detail={profileQuery.error instanceof Error ? profileQuery.error.message : ''}
        onRetry={() => void profileQuery.refetch()}
      />
    );
  }

  if (!profileQuery.data) return <ProfilePicker />;

  return <AppShell />;
}

/** Pasa a true cuando han transcurrido `ms` desde el montaje. Para no esperar indefinidamente. */
function useTimeout(ms: number): boolean {
  const [cumplido, setCumplido] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setCumplido(true), ms);
    return () => clearTimeout(id);
  }, [ms]);

  return cumplido;
}

/** Pantalla de parada: dice qué pasa y deja reintentar, en vez de dejar a alguien encerrado. */
function Problem({
  title,
  detail,
  onRetry,
}: {
  title: string;
  detail: string;
  onRetry: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-screen-sm flex-col justify-center px-6">
      <section className="rounded-day bg-surface p-6">
        <h1 className="text-dish font-bold text-ink">{title}</h1>
        {detail !== '' && <p className="mt-2 text-item text-ink-muted">{detail}</p>}
        <button
          type="button"
          onClick={onRetry}
          className="mt-6 min-h-tap w-full rounded-block bg-slot px-4 py-3 text-item font-semibold text-slot-ink"
        >
          Reintentar
        </button>
      </section>
    </main>
  );
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
