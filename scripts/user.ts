/**
 * Cuentas: crear, cambiar contraseña y renombrar usuarios.
 *
 *   npm run user -- list
 *   npm run user -- add nutri1 bocause123
 *   npm run user -- password marta nuevaclave
 *   npm run user -- rename alguien@correo.com andres
 *
 * Las cuentas de cliente las crea la nutricionista desde la app; esto es para lo que ella
 * no puede hacer desde el navegador: dar de alta a **otra nutricionista** (que además hay
 * que ascender con `npm run staff:add`) y rescatar a quien ha olvidado su contraseña.
 *
 * Usa la clave `service_role`, que salta todas las políticas y solo está en tu .env.local.
 * Por eso vive en un script y no en la app: lo que no puede pisar un navegador, no lo pisa.
 *
 * Supabase identifica las cuentas por correo. Un usuario sin arroba se convierte en
 * `usuario@<dominio>`; ese correo no es un buzón y nunca se le manda nada, así que las
 * cuentas nacen ya confirmadas (`email_confirm`).
 */
import { createClient, type User } from '@supabase/supabase-js';
import type { Database } from '../src/data/database.types.ts';
import { brand } from '../src/config/brand.ts';

const [verbo, uno, dos] = process.argv.slice(2);

const USO = `Uso:
  npm run user -- list
  npm run user -- add <usuario> <contraseña>
  npm run user -- password <usuario> <contraseña nueva>
  npm run user -- rename <usuario actual> <usuario nuevo>`;

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

/** "marta" → "marta@bocause.local". Con arroba, se respeta tal cual. */
function correoDe(usuario: string): string {
  const limpio = usuario.trim().toLowerCase();
  return limpio.includes('@') ? limpio : `${limpio}@${brand.auth.userDomain}`;
}

/** Todas las cuentas. `listUsers` va por páginas y mirar solo la primera es el fallo clásico. */
async function todas(): Promise<User[]> {
  const usuarios: User[] = [];
  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) {
      console.error('No se pudo consultar la lista de usuarios:', error.message);
      process.exit(1);
    }
    if (data.users.length === 0) break;
    usuarios.push(...data.users);
  }
  return usuarios;
}

async function buscar(usuario: string): Promise<User> {
  const correo = correoDe(usuario);
  const encontrado = (await todas()).find((user) => user.email?.toLowerCase() === correo);
  if (!encontrado) {
    console.error(`No hay ninguna cuenta con el usuario "${usuario}" (${correo}).`);
    process.exit(1);
  }
  return encontrado;
}

/* ─────────────── Órdenes ─────────────── */

if (verbo === 'list') {
  const usuarios = await todas();
  const staff = await db.from('staff_members').select('user_id');
  const perfiles = await db.from('profiles').select('user_id, display_name, household_id');
  const hogares = await db.from('households').select('id, name');

  const nombreHogar = new Map((hogares.data ?? []).map((h) => [h.id, h.name]));
  const esStaff = new Set((staff.data ?? []).map((fila) => fila.user_id));
  const perfilDe = new Map(
    (perfiles.data ?? [])
      .filter((p) => p.user_id !== null)
      .map((p) => [p.user_id!, `${p.display_name} · ${nombreHogar.get(p.household_id) ?? '?'}`]),
  );

  console.log(`${usuarios.length} cuentas:\n`);
  for (const user of usuarios) {
    const quien = esStaff.has(user.id)
      ? 'nutricionista'
      : (perfilDe.get(user.id) ?? 'sin perfil asignado');
    console.log(`  ${(user.email ?? '?').padEnd(36)} ${quien}`);
  }
} else if (verbo === 'add') {
  if (!uno || !dos) {
    console.error(USO);
    process.exit(1);
  }
  const correo = correoDe(uno);
  const { data, error } = await db.auth.admin.createUser({
    email: correo,
    password: dos,
    // Confirmada de salida: ese correo no existe, así que nadie va a poder confirmarlo.
    email_confirm: true,
  });
  if (error) {
    console.error('No se pudo crear:', error.message);
    process.exit(1);
  }
  console.log(`✓ Cuenta "${uno}" creada (${correo}), id ${data.user?.id}`);
  console.log('  Si es una nutricionista: npm run staff:add -- ' + correo);
  console.log('  Si es un cliente: asígnale perfil desde /admin/hogares.');
} else if (verbo === 'password') {
  if (!uno || !dos) {
    console.error(USO);
    process.exit(1);
  }
  const user = await buscar(uno);
  const { error } = await db.auth.admin.updateUserById(user.id, { password: dos });
  if (error) {
    console.error('No se pudo cambiar la contraseña:', error.message);
    process.exit(1);
  }
  console.log(`✓ Contraseña de "${uno}" cambiada. Las sesiones abiertas siguen valiendo.`);
} else if (verbo === 'rename') {
  if (!uno || !dos) {
    console.error(USO);
    process.exit(1);
  }
  const user = await buscar(uno);
  const correoNuevo = correoDe(dos);
  const { error } = await db.auth.admin.updateUserById(user.id, {
    email: correoNuevo,
    email_confirm: true,
  });
  if (error) {
    console.error('No se pudo renombrar:', error.message);
    process.exit(1);
  }
  console.log(`✓ ${user.email} ahora entra como "${dos}" (${correoNuevo}).`);
  console.log('  Su perfil, sus checks y su historial no se tocan: la cuenta es la misma.');
} else {
  console.error(USO);
  process.exit(1);
}
