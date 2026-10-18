import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

export type BocauseClient = SupabaseClient<Database>;

const url = import.meta.env['VITE_SUPABASE_URL'];
const anonKey = import.meta.env['VITE_SUPABASE_ANON_KEY'];

/**
 * Si faltan las variables de entorno la app no se rompe: arranca y enseña qué falta.
 * Es la diferencia entre una pantalla en blanco y saber que hay que copiar .env.example.
 */
export const supabaseConfigured = Boolean(url && anonKey);

/**
 * Los mismos datos de conexión, para quien necesite **otro** cliente.
 *
 * Solo hace falta en un sitio: dar de alta la cuenta de un cliente sin que `signUp` le robe
 * la sesión a la nutricionista (`useCreateClientAccount`). Es la clave pública de siempre,
 * la que ya viaja en el paquete; aquí no se expone nada nuevo.
 */
export const supabaseUrl = url ?? 'http://localhost:54321';
export const supabaseAnonKey = anonKey ?? 'sin-configurar';

/**
 * Id del usuario con sesión, leído de `localStorage` sin tocar la red.
 *
 * Hace falta de forma **síncrona** para separar la caché de IndexedDB por usuario: cuando
 * se guarda o se restaura no se puede esperar a que `supabase-js` resuelva nada. Es la
 * misma técnica que el script antiparpadeo de `index.html` usa con el tema.
 *
 * Devuelve null si no hay sesión o si el almacenamiento está bloqueado; quien llama decide
 * qué hacer, pero nunca debe caer en una clave compartida: ahí está la fuga.
 */
export function storedUserId(): string | null {
  if (!url) return null;
  try {
    const ref = new URL(url).hostname.split('.')[0];
    const raw = localStorage.getItem(`sb-${ref}-auth-token`);
    if (raw === null) return null;
    const session: unknown = JSON.parse(raw);
    const id = (session as { user?: { id?: unknown } } | null)?.user?.id;
    return typeof id === 'string' ? id : null;
  } catch {
    // Modo privado, almacenamiento bloqueado o formato que no reconocemos.
    return null;
  }
}

export const supabase: BocauseClient = createClient<Database>(
  url ?? 'http://localhost:54321',
  anonKey ?? 'sin-configurar',
  {
    auth: {
      // Magic link: la sesión llega en la URL al volver del correo.
      detectSessionInUrl: true,
      persistSession: true,
      autoRefreshToken: true,
      flowType: 'pkce',
    },
  },
);
