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

/**
 * Id con el que se guarda el plan, que puede no ser el del archivo.
 *
 * `plans.id` es clave primaria **global**, no por hogar. Sembrar un segundo hogar con el
 * mismo archivo haría `upsert` sobre la fila del primero y **le movería el plan de casa**.
 * Por eso `npm run seed:demo` pasa un id propio.
 */
const PLAN_ID = process.env['SEED_PLAN_ID'] ?? null;

/** Nombre visible de un perfil, por si el hogar es de pruebas y no queremos nombres reales. */
function displayNameOf(profileId: string, fallback: string): string {
  return process.env[`SEED_NAME_${profileId.toUpperCase()}`] ?? fallback;
}
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
const planId = PLAN_ID ?? plan.id;
console.log(
  `Plan: ${plan.name} (${planId}${planId === plan.id ? '' : `, del archivo ${plan.id}`}) · ` +
    `${plan.profiles.length} perfiles`,
);

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
  const displayName = displayNameOf(profile.profileId, profile.displayName);

  if (profileIdBySlug.has(profile.profileId)) {
    const update = await db
      .from('profiles')
      .update({ display_name: displayName, ...(email ? { claim_email: email } : {}) })
      .eq('id', profileIdBySlug.get(profile.profileId)!);
    if (update.error) fail(`No se pudo actualizar el perfil ${profile.profileId}`, update.error);
    console.log(`Perfil ${displayName}: ya existía${email ? ` (correo ${email})` : ''}.`);
    continue;
  }

  const created = await db
    .from('profiles')
    .insert({
      household_id: householdId,
      slug: profile.profileId,
      display_name: displayName,
      user_id: null,
      ...(email ? { claim_email: email } : {}),
    })
    .select('id')
    .single();
  if (created.error) fail(`No se pudo crear el perfil ${profile.profileId}`, created.error);

  profileIdBySlug.set(profile.profileId, created.data.id);
  console.log(`Perfil ${displayName} creado${email ? ` (correo ${email})` : ''}.`);
}

if (!plan.profiles.every((profile) => profileIdBySlug.has(profile.profileId))) {
  fail('Falta algún perfil tras la siembra', [...profileIdBySlug.keys()]);
}

/* ─────────────── Plan ─────────────── */

const planUpsert = await db.from('plans').upsert({
  id: planId,
  household_id: householdId,
  name: plan.name,
  valid_from: plan.validFrom,
  valid_to: plan.validTo ?? null,
  status: 'active',
  data: plan as unknown as Database['public']['Tables']['plans']['Insert']['data'],
});
if (planUpsert.error) fail('No se pudo insertar el plan', planUpsert.error);
console.log(`Plan ${planId} insertado (activo desde ${plan.validFrom}).`);

/* ─────────────── Plantilla viva ─────────────── */

/**
 * El plan usa los slugs y la base de datos el UUID del perfil, porque las políticas RLS
 * comparan `scope = my_profile_id()::text`. Aquí se cruza esa frontera.
 */
const toDbScope = (scope: string) =>
  scope === 'shared' ? 'shared' : (profileIdBySlug.get(scope) ?? scope);

const cells = plan.template.map((cell) => ({
  plan_id: planId,
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

console.log('\n✓ Listo: el hogar, las personas y el plan ya están.');
console.log(
  '\nLos perfiles se han creado SIN cuenta: nadie puede entrar todavía como ellos, porque\n' +
    'desde la 0010 ya no se elige perfil al entrar. Dale a cada uno su usuario y su\n' +
    'contraseña desde /admin/hogares, o con `npm run user -- add <usuario> <contraseña>`.',
);
