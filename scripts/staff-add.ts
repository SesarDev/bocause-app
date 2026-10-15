/**
 * Da de alta a una nutricionista: `npm run staff:add -- correo@ejemplo.com`
 *
 * Ser staff significa ver y editar los hogares de todos los clientes, así que **no hay
 * ninguna forma de conseguirlo desde la app**: la tabla `staff_members` no tiene políticas
 * de escritura (ver 0004_staff.sql). Solo se entra por aquí, con la clave service_role, que
 * únicamente está en el portátil de quien administra.
 *
 * La persona tiene que haber entrado al menos una vez con su enlace mágico: este script no
 * crea cuentas, solo asciende una que ya existe. Si creara la cuenta, un correo mal escrito
 * dejaría un usuario fantasma con acceso a todo.
 */
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../src/data/database.types.ts';

const email = process.argv[2]?.trim().toLowerCase();
const displayName = process.argv[3];

if (!email || !email.includes('@')) {
  console.error('Uso: npm run staff:add -- correo@ejemplo.com ["Nombre visible"]');
  process.exit(1);
}

const url = process.env['VITE_SUPABASE_URL'];
const serviceKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];

if (!url || !serviceKey) {
  console.error(
    'Faltan VITE_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local.\n' +
      'La service_role salta todas las políticas: nunca con prefijo VITE_ ni en el repositorio.',
  );
  process.exit(1);
}

const db = createClient<Database>(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/* ─────────────── Buscar al usuario ─────────────── */

// listUsers va por páginas; se recorren todas en vez de mirar solo la primera, que es el
// error que aparece cuando el hogar crece y de pronto "no encuentra" a alguien que sí está.
let encontrado: { id: string; email?: string } | undefined;
for (let page = 1; page <= 20 && !encontrado; page += 1) {
  const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
  if (error) {
    console.error('No se pudo consultar la lista de usuarios:', error.message);
    process.exit(1);
  }
  if (data.users.length === 0) break;
  encontrado = data.users.find((user) => user.email?.toLowerCase() === email);
}

if (!encontrado) {
  console.error(
    `No hay ningún usuario con el correo ${email}.\n\n` +
      'Este script no crea cuentas a propósito: un correo mal escrito dejaría un usuario\n' +
      'fantasma con acceso a todos los hogares. Que entre una vez en la app con su enlace\n' +
      'mágico y vuelve a ejecutarlo.',
  );
  process.exit(1);
}

/* ─────────────── Ascender ─────────────── */

const yaEra = await db
  .from('staff_members')
  .select('user_id, display_name')
  .eq('user_id', encontrado.id)
  .maybeSingle();

if (yaEra.error) {
  console.error('No se pudo consultar staff_members:', yaEra.error.message);
  process.exit(1);
}

// Sin `process.exit(0)` en el camino bueno: en Windows, salir a la fuerza con conexiones
// todavía abiertas revienta con un fallo de aserción de libuv, y el script devolvería un
// código de error habiendo ido bien. Se deja terminar solo.
if (yaEra.data) {
  console.log(`${email} ya era nutricionista (${yaEra.data.display_name}). No se ha tocado nada.`);
} else {
  const alta = await db
    .from('staff_members')
    .insert({ user_id: encontrado.id, display_name: displayName ?? email })
    .select('user_id')
    .single();

  if (alta.error) {
    console.error('No se pudo dar de alta:', alta.error.message);
    process.exit(1);
  }

  console.log(`✓ ${email} ya es nutricionista: ve y edita todos los hogares.`);
  console.log('  Para quitarle el acceso, borra su fila de staff_members.');
}
