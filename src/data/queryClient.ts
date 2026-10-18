import { QueryClient } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { del, get, set } from 'idb-keyval';
import { registerMutationDefaults } from './mutations';
import { storedUserId } from './supabase';

const ONE_WEEK = 1000 * 60 * 60 * 24 * 7;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Offline-first: servir de caché y reintentar al recuperar red, no fallar.
      networkMode: 'offlineFirst',
      staleTime: 1000 * 60 * 5,
      gcTime: ONE_WEEK,
      retry: 2,
      refetchOnWindowFocus: false,
    },
    mutations: {
      // Las mutaciones se pausan sin red y se reanudan al reconectar (fase 4).
      networkMode: 'offlineFirst',
      retry: 3,
    },
  },
});

/**
 * Caché persistida en IndexedDB, no en localStorage: es dato de servidor y puede ser
 * grande. idb-keyval devuelve undefined cuando no hay valor; el persister espera null.
 *
 * La clave lleva el id del usuario. En un móvil compartido, o cuando una nutricionista
 * entre con su cuenta en el mismo navegador, la caché del anterior seguiría en IndexedDB
 * y se restauraría tal cual: vería la semana, los checks y la compra de otra persona hasta
 * que la red respondiera. Con la clave separada, cada usuario solo puede restaurar la suya.
 *
 * Se calcula en cada operación y no al crear el persister: el módulo se carga antes de que
 * exista el token (al arrancar sin sesión), y así el primer guardado ya va a su sitio.
 */
function scopedKey(key: string): string {
  return `${key}:${storedUserId() ?? 'anon'}`;
}

export const persister = createAsyncStoragePersister({
  storage: {
    getItem: async (key) => (await get<string>(scopedKey(key))) ?? null,
    setItem: async (key, value) => {
      await set(scopedKey(key), value);
    },
    removeItem: async (key) => {
      await del(scopedKey(key));
    },
  },
  key: 'bocause.query-cache',
  throttleTime: 1000,
});

export const persistOptions = { persister, maxAge: ONE_WEEK } as const;

// Las mutaciones se registran por clave para que, al rehidratar la caché tras cerrar la app
// sin cobertura, el cliente sepa qué función ejecutar y pueda reanudarlas.
registerMutationDefaults(queryClient);
