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
