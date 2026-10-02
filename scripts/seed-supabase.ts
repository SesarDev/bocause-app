/**
 * Siembra el hogar en Supabase: crea la casa, los dos perfiles, inserta el plan y rellena
 * la plantilla viva a partir de `plan.template`.
 *
 * Se ejecuta con `npm run seed`. Necesita la clave **service_role**, porque las políticas
 * RLS de la migración exigen ser miembro del hogar y al principio no hay ningún hogar: es
 * el huevo y la gallina. Esa clave nunca lleva prefijo VITE_, así que no acaba en el
 * paquete que se descarga el móvil.
 *
 * Es repetible: vuelve a ejecutarse sin duplicar nada y sin tocar los perfiles ya
 * vinculados. Por defecto NO pisa la plantilla viva (que puede tener cambios vuestros);
 * para reiniciarla, `npm run seed -- --reset-template`.
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { Plan } from '../src/domain/schema.ts';
import type { Database } from '../src/data/database.types.ts';

const PLAN_FILE = process.env['SEED_PLAN'] ?? 'data/plans/2026-09.json';
const HOUSEHOLD_NAME = process.env['SEED_HOUSEHOLD_NAME'] ?? 'Casa';
const resetTemplate = process.argv.includes('--reset-template');

const url = process.env['VITE_SUPABASE_URL'];
const serviceKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];

if (!url || !serviceKey) {
  console.error(
    [
      'Faltan variables de entorno.',
      '',
      '  VITE_SUPABASE_URL            ya debería estar en .env.local',
      '  SUPABASE_SERVICE_ROLE_KEY    Supabase → Project Settings → API → service_role',
      '',
      'La clave service_role salta todas las políticas RLS: no la pongas con prefijo VITE_',
      'ni la subas al repositorio. .env.local está en .gitignore.',
    ].join('\n'),
  );
  process.exit(1);
}

const db = createClient<Database>(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function fail(message: string, error: unknown): never {
  console.error(`\n✗ ${message}`);
  console.error(error);
  process.exit(1);
}

const plan = Plan.parse(JSON.parse(readFileSync(PLAN_FILE, 'utf8')));
console.log(`Plan: ${plan.name} (${plan.id}) · ${plan.profiles.length} perfiles`);

/* ─────────────── Hogar ─────────────── */

const existingHousehold = await db
  .from('households')
  .select('id, name')
  .eq('name', HOUSEHOLD_NAME)
  .maybeSingle();
if (existingHousehold.error) fail('No se pudo consultar el hogar', existingHousehold.error);

let householdId = existingHousehold.data?.id;
if (householdId) {
  console.log(`Hogar "${HOUSEHOLD_NAME}" ya existía.`);
} else {
  const created = await db
    .from('households')
    .insert({ name: HOUSEHOLD_NAME })
    .select('id')
    .single();
  if (created.error) fail('No se pudo crear el hogar', created.error);
  householdId = created.data.id;
  console.log(`Hogar "${HOUSEHOLD_NAME}" creado.`);
}

/* ─────────────── Perfiles ─────────────── */

const existingProfiles = await db
  .from('profiles')
  .select('id, slug, user_id')
  .eq('household_id', householdId);
if (existingProfiles.error) fail('No se pudieron leer los perfiles', existingProfiles.error);

const profileIdBySlug = new Map(existingProfiles.data.map((row) => [row.slug, row.id]));

for (const profile of plan.profiles) {
  // El correo autorizado a ocupar el perfil (ver 0002_claim_profile.sql).
  const email = process.env[`SEED_EMAIL_${profile.profileId.toUpperCase()}`] ?? null;

  if (profileIdBySlug.has(profile.profileId)) {
    const update = await db
      .from('profiles')
      .update({ display_name: profile.displayName, ...(email ? { claim_email: email } : {}) })
      .eq('id', profileIdBySlug.get(profile.profileId)!);
    if (update.error) fail(`No se pudo actualizar el perfil ${profile.profileId}`, update.error);
    console.log(`Perfil ${profile.displayName}: ya existía${email ? ` (correo ${email})` : ''}.`);
    continue;
  }

  const created = await db
    .from('profiles')
    .insert({
      household_id: householdId,
      slug: profile.profileId,
      display_name: profile.displayName,
      user_id: null,
      ...(email ? { claim_email: email } : {}),
    })
    .select('id')
    .single();
  if (created.error) fail(`No se pudo crear el perfil ${profile.profileId}`, created.error);

  profileIdBySlug.set(profile.profileId, created.data.id);
  console.log(`Perfil ${profile.displayName} creado${email ? ` (correo ${email})` : ''}.`);
}

if (!plan.profiles.every((profile) => profileIdBySlug.has(profile.profileId))) {
  fail('Falta algún perfil tras la siembra', [...profileIdBySlug.keys()]);
}

/* ─────────────── Plan ─────────────── */

const planUpsert = await db.from('plans').upsert({
  id: plan.id,
  household_id: householdId,
  name: plan.name,
  valid_from: plan.validFrom,
  valid_to: plan.validTo ?? null,
  status: 'active',
  data: plan as unknown as Database['public']['Tables']['plans']['Insert']['data'],
});
if (planUpsert.error) fail('No se pudo insertar el plan', planUpsert.error);
console.log(`Plan ${plan.id} insertado (activo desde ${plan.validFrom}).`);

/* ─────────────── Plantilla viva ─────────────── */

/**
 * El plan usa los slugs y la base de datos el UUID del perfil, porque las políticas RLS
 * comparan `scope = my_profile_id()::text`. Aquí se cruza esa frontera.
 */
const toDbScope = (scope: string) =>
  scope === 'shared' ? 'shared' : (profileIdBySlug.get(scope) ?? scope);

const cells = plan.template.map((cell) => ({
  plan_id: plan.id,
  day: cell.day,
  slot: cell.slot,
  scope: toDbScope(cell.scope),
  block_id: cell.blockId,
  updated_by: null,
}));

const unknownScopes = plan.template.filter(
  (cell) => cell.scope !== 'shared' && !profileIdBySlug.has(cell.scope),
);
if (unknownScopes.length > 0) {
  fail('Hay celdas con un perfil que no existe', unknownScopes);
}

const cellsUpsert = await db
  .from('template_cells')
  .upsert(cells, { onConflict: 'plan_id,day,slot,scope', ignoreDuplicates: !resetTemplate });
if (cellsUpsert.error) fail('No se pudieron insertar las celdas de plantilla', cellsUpsert.error);

console.log(
  `Plantilla: ${cells.length} celdas ${resetTemplate ? 'reiniciadas' : 'insertadas (las ya existentes se respetan)'}.`,
);

console.log('\n✓ Listo. Ya podéis entrar con el magic link y elegir perfil.');
if (!plan.profiles.some((p) => process.env[`SEED_EMAIL_${p.profileId.toUpperCase()}`])) {
  console.log(
    '\nAviso: ningún perfil tiene correo asignado, así que cualquier usuario que se registre\n' +
      'podría ocuparlos. Para reservarlos, define SEED_EMAIL_CRISTINA y SEED_EMAIL_ANDRES\n' +
      'en .env.local y vuelve a ejecutar el seed.',
  );
}
