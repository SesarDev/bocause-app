/**
 * Utilidades comunes de las pruebas de extremo a extremo.
 *
 * La sesión no se consigue pinchando el magic link (el correo no se puede leer desde aquí),
 * sino pidiéndole a la API de administración un enlace, canjeándolo por tokens y metiendo
 * la sesión en localStorage antes de que cargue la página. Es lo mismo que hace el navegador
 * tras pinchar el enlace, saltándose el correo.
 */
import { test as base, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

type Env = { url: string; anonKey: string; serviceKey: string; email: string };

function readEnv(): Env | null {
  let raw = '';
  try {
    raw = readFileSync('.env.local', 'utf8');
  } catch {
    return null;
  }

  const get = (name: string) =>
    new RegExp(`^${name}=(.*)$`, 'm').exec(raw)?.[1]?.trim() ?? process.env[name] ?? '';

  const url = get('VITE_SUPABASE_URL');
  const anonKey = get('VITE_SUPABASE_ANON_KEY');
  const serviceKey = get('SUPABASE_SERVICE_ROLE_KEY');
  const email = get('SEED_EMAIL_ANDRES') || process.env['E2E_EMAIL'] || '';

  if (!url || !anonKey || !serviceKey) return null;
  return { url, anonKey, serviceKey, email };
}

export const env = readEnv();

/** Llama a la API REST de Supabase con la clave de servicio (se salta las RLS). */
export async function admin(path: string, init: RequestInit = {}): Promise<Response> {
  if (!env) throw new Error('Sin configuración de Supabase');
  return fetch(`${env.url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: env.serviceKey,
      Authorization: `Bearer ${env.serviceKey}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
}

/* ─────────────────── Proteger los datos reales del hogar ─────────────────── */

/**
 * Estas pruebas corren contra el Supabase de casa, que ya **no está vacío**: hay comidas
 * marcadas, intercambios y una lista de la compra de verdad, de gente que usa la app a
 * diario. Así que una prueba no puede limpiar borrando: tiene que dejar la tabla
 * exactamente como estaba, incluidas las filas que haya modificado.
 *
 * Borrar "lo creado durante la prueba" no basta, porque una prueba que escribe encima de
 * una fila existente la deja cambiada y no creada: al borrarla se perdería el dato real.
 *
 * (Lo correcto a medio plazo es un proyecto de Supabase de pruebas; esto protege mientras.)
 */
export type Tabla = 'checks' | 'week_overrides' | 'shopping_items';

type Row = Record<string, unknown>;

const CLAVES: Record<Tabla, string[]> = {
  checks: ['profile_id', 'date', 'slot', 'item_id'],
  week_overrides: ['plan_id', 'week_start', 'day', 'slot', 'scope'],
  shopping_items: ['id'],
};

const claveDe = (tabla: Tabla, row: Row) => CLAVES[tabla]!.map((c) => String(row[c])).join('|');

/** Contenido comparable: sin las columnas que cambian solas al escribir. */
function contenido(row: Row): string {
  const campos = Object.keys(row)
    .filter((k) => k !== 'updated_at' && k !== 'updated_by')
    .sort();
  return JSON.stringify(campos.map((k) => [k, row[k]]));
}

async function leerTabla(tabla: Tabla): Promise<Row[]> {
  const response = await admin(`${tabla}?select=*`);
  if (!response.ok) throw new Error(`No se pudo leer ${tabla}: HTTP ${response.status}`);
  return (await response.json()) as Row[];
}

export type Foto = { tabla: Tabla; filas: Map<string, Row> };

export async function fotografiar(tabla: Tabla): Promise<Foto> {
  const filas = new Map<string, Row>();
  for (const row of await leerTabla(tabla)) filas.set(claveDe(tabla, row), row);
  return { tabla, filas };
}

/** Filas que han cambiado respecto a la foto: añadidas, quitadas o modificadas. */
export async function cambiosDesde(foto: Foto): Promise<number> {
  const ahora = await leerTabla(foto.tabla);
  const vistas = new Set<string>();
  let cambios = 0;

  for (const row of ahora) {
    const clave = claveDe(foto.tabla, row);
    vistas.add(clave);
    const antes = foto.filas.get(clave);
    if (!antes || contenido(antes) !== contenido(row)) cambios += 1;
  }

  for (const clave of foto.filas.keys()) if (!vistas.has(clave)) cambios += 1;

  return cambios;
}

/** Deja la tabla exactamente como estaba en la foto. */
export async function restaurar(foto: Foto): Promise<void> {
  const ahora = await leerTabla(foto.tabla);
  const vistas = new Set<string>();

  for (const row of ahora) {
    const clave = claveDe(foto.tabla, row);
    vistas.add(clave);
    if (!foto.filas.has(clave)) {
      const filtro = CLAVES[foto.tabla]!.map((c) => `${c}=eq.${String(row[c])}`).join('&');
      const response = await admin(`${foto.tabla}?${filtro}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(`No se pudo borrar de ${foto.tabla}`);
    }
  }

  // Las que se modificaron (o que la prueba borró) se reponen tal cual estaban.
  const reponer = [...foto.filas.entries()]
    .filter(([clave, antes]) => {
      if (!vistas.has(clave)) return true;
      const actual = ahora.find((row) => claveDe(foto.tabla, row) === clave);
      return actual !== undefined && contenido(actual) !== contenido(antes);
    })
    .map(([, antes]) => antes);

  if (reponer.length > 0) {
    const response = await admin(foto.tabla, {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify(reponer),
    });
    if (!response.ok) {
      throw new Error(`No se pudo restaurar ${foto.tabla}: HTTP ${response.status}`);
    }
  }
}

async function anyClaimedEmail(): Promise<string> {
  if (!env) throw new Error('Sin configuración');
  if (env.email) return env.email;

  // Si no hay correo configurado, se usa el del perfil que ya esté ocupado.
  const response = await fetch(`${env.url}/auth/v1/admin/users`, {
    headers: { apikey: env.serviceKey, Authorization: `Bearer ${env.serviceKey}` },
  });
  const data = (await response.json()) as { users?: { email?: string }[] };
  const email = data.users?.[0]?.email;
  if (!email) throw new Error('No hay ningún usuario registrado con el que probar');
  return email;
}

async function buildSession(): Promise<{ key: string; value: string }> {
  if (!env) throw new Error('Sin configuración');
  const email = await anyClaimedEmail();

  const linkResponse = await fetch(`${env.url}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: {
      apikey: env.serviceKey,
      Authorization: `Bearer ${env.serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'magiclink',
      email,
      options: { redirect_to: 'http://localhost:5173/' },
    }),
  });
  const link = (await linkResponse.json()) as { action_link?: string };
  if (!link.action_link) throw new Error('No se pudo generar el enlace de acceso');

  const verify = await fetch(link.action_link, { redirect: 'manual' });
  const location = verify.headers.get('location') ?? '';
  const hash = new URLSearchParams(location.split('#')[1] ?? '');
  const accessToken = hash.get('access_token');
  if (!accessToken) throw new Error('El enlace no devolvió sesión');

  const userResponse = await fetch(`${env.url}/auth/v1/user`, {
    headers: { apikey: env.serviceKey, Authorization: `Bearer ${accessToken}` },
  });

  const session = {
    access_token: accessToken,
    token_type: 'bearer',
    expires_in: Number(hash.get('expires_in') ?? 3600),
    expires_at: Number(hash.get('expires_at') ?? 0),
    refresh_token: hash.get('refresh_token'),
    user: await userResponse.json(),
  };

  const ref = env.url.replace('https://', '').replace(/\.supabase\.co.*/, '');
  return { key: `sb-${ref}-auth-token`, value: JSON.stringify(session) };
}

/** Página ya autenticada y con la pestaña pedida abierta. */
export const test = base.extend<{ app: Page }>({
  app: async ({ page }, use) => {
    const { key, value } = await buildSession();
    await page.addInitScript(
      ([storageKey, storageValue]) => {
        window.localStorage.setItem(storageKey as string, storageValue as string);
      },
      [key, value],
    );
    await page.goto('/');
    await expect(page.getByRole('navigation', { name: 'Secciones' })).toBeVisible({
      timeout: 30_000,
    });
    await use(page);
  },
});

export async function openTab(page: Page, name: string): Promise<void> {
  await page.getByRole('navigation', { name: 'Secciones' }).getByRole('button', { name }).click();
}

export { expect };
