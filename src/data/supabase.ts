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
