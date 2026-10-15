import { lazy, Suspense, useEffect, useState } from 'react';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import { brand } from '../config/brand';
import { persistOptions, queryClient } from '../data/queryClient';
import { supabaseConfigured } from '../data/supabase';
import { signOut, useMyProfile, useSession } from '../data/auth';
import { useIsStaff } from '../data/staff';
import { setActiveHousehold } from '../data/scope';
import { ThemeProvider } from '../features/theme/ThemeProvider';
import { AppShell } from '../features/shell/AppShell';
import { LoginScreen } from '../features/auth/LoginScreen';
import { ProfilePicker } from '../features/auth/ProfilePicker';
import { SetupScreen } from '../features/auth/SetupScreen';
import { useUiStore, type ProfileId } from '../stores/ui';

/**
 * La zona de la nutricionista se carga aparte y solo cuando hace falta: así su código no
 * viaja en el paquete que se descarga el móvil de un cliente (decisión 10 de PLAN.md).
 */
const AdminApp = lazy(() => import('../features/admin/AdminApp'));

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
        <BrowserRouter>
          <Routes>
            <Route path="/admin/*" element={<AdminGate />} />
            <Route path="*" element={<Gate />} />
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </PersistQueryClientProvider>
  );
}

/**
 * Puerta de /admin. Aparte de la del cliente a propósito: la nutricionista **no tiene
 * perfil en ningún hogar**, así que pasar por el selector de perfil la dejaría encerrada
 * con la lista vacía.
 *
 * Esta comprobación es para saber qué pintar, no para proteger nada: quien abra /admin a la
 * fuerza no verá datos igualmente, porque lo que manda son las políticas RLS.
 */
function AdminGate() {
  const { session, loading } = useSession();
  const staff = useIsStaff(session !== null);

  if (!supabaseConfigured) return <SetupScreen />;
  if (loading) return <Splash />;
  if (!session) return <LoginScreen />;
  if (staff.isPending) return <Splash />;

  if (staff.data !== true) {
    return (
      <Problem
        title="No tienes acceso"
        detail="Esta zona es para la nutricionista. Tu plan está en la app."
        onRetry={() => void staff.refetch()}
        extra={
          <Link
            to="/"
            className="mt-3 block min-h-tap rounded-block border border-line px-4 py-3 text-center text-item font-semibold text-ink"
          >
            Ir a mi plan
          </Link>
        }
      />
    );
  }

  return (
    <Suspense fallback={<Splash />}>
      <AdminApp />
    </Suspense>
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
  // Solo se pregunta si resulta que no hay perfil: a un cliente normal, que sí lo tiene,
  // esta consulta no le cuesta ni una petición.
  const staff = useIsStaff(session !== null && profileQuery.data === null);
  // Diez segundos, no seis: un móvil que despierta de la pantalla apagada tarda lo suyo en
  // tener red, y asustar a alguien con un aviso mientras todo va bien es peor que esperar.
  const tarda = useTimeout(10_000);

  const slug = profileQuery.data?.slug;
  const householdId = profileQuery.data?.householdId ?? null;

  useEffect(() => {
    if (slug) setActiveProfile(slug as ProfileId);
  }, [slug, setActiveProfile]);

  // El hogar que mira la app. Todas las consultas cuelgan de él, así que se fija aquí,
  // en el único sitio donde se decide quién ve los datos de quién.
  useEffect(() => {
    setActiveHousehold(householdId);
  }, [householdId]);

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

  if (!profileQuery.data) {
    // Una nutricionista no tiene perfil en ningún hogar: el selector le saldría vacío, sin
    // nada que elegir ni forma de salir. Se le ofrece su zona en vez de encerrarla.
    return staff.data === true ? <StaffSinPerfil /> : <ProfilePicker />;
  }

  return <AppShell />;
}

/** Staff que entra por la puerta del cliente: no tiene perfil, pero sí sitio adonde ir. */
function StaffSinPerfil() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-screen-sm flex-col justify-center px-6">
      <section className="rounded-day bg-surface p-6">
        <h1 className="text-dish font-bold text-ink">Tu zona es la de administración</h1>
        <p className="mt-2 text-item text-ink-muted">
          Esta cuenta es de nutricionista, así que no tiene un plan propio que mostrar.
        </p>
        <Link
          to="/admin"
          className="mt-6 block min-h-tap rounded-block bg-slot px-4 py-3 text-center text-item font-semibold text-slot-ink"
        >
          Ir a administración
        </Link>
        <button
          type="button"
          onClick={() => void signOut()}
          className="mt-3 min-h-tap w-full text-measure font-semibold text-ink-muted underline"
        >
          Cerrar sesión
        </button>
      </section>
    </main>
  );
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
  extra,
}: {
  title: string;
  detail: string;
  onRetry: () => void;
  /** Salida alternativa, para que la pantalla no sea solo un botón de reintentar. */
  extra?: React.ReactNode;
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
        {extra}
      </section>
    </main>
  );
}

function Splash() {
  return (
    <main className="grid min-h-dvh place-items-center bg-bg">
      <p className="text-lg font-extrabold tracking-[0.1em] text-ink">
        {brand.wordmark}
        <span aria-hidden="true" className="ml-0.5 text-accent">
          .
        </span>
      </p>
    </main>
  );
}
