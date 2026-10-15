/**
 * Aplica las migraciones de `supabase/migrations/` que falten, en orden.
 *
 * Hasta ahora las migraciones se pegaban a mano en el SQL Editor del panel. Eso funciona
 * una vez, pero no deja constancia de qué se aplicó ni en qué orden, y con varias
 * migraciones por delante (0004 a 0008 en el plan) es fácil saltarse una o repetirla.
 * Aquí cada una se ejecuta **dentro de una transacción** y se anota en `schema_migrations`:
 * si falla a mitad, no deja la base a medio migrar.
 *
 *   npm run migrate                      aplica lo que falte
 *   npm run migrate -- --dry             dice qué haría, sin tocar nada
 *   npm run migrate -- --baseline 0002   marca como aplicadas las que ya pusiste a mano
 *
 * La cadena de conexión sale de SUPABASE_DB_URL (en .env.local, que no se versiona). La
 * del panel: Settings → Database → Connection string → URI. Usa la de "Session pooler" si
 * tu red no tiene IPv6, que es lo normal en casa.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';

const DIRECTORIO = 'supabase/migrations';

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const baseline = args[args.indexOf('--baseline') + 1];
const conFlagBaseline = args.includes('--baseline');

const url = process.env['SUPABASE_DB_URL'];
if (!url) {
  console.error(
    'Falta SUPABASE_DB_URL en .env.local.\n' +
      'Panel de Supabase → Settings → Database → Connection string → URI.\n' +
      'Si tu red no tiene IPv6 (lo normal), usa la de "Session pooler".',
  );
  process.exit(1);
}

if (conFlagBaseline && (baseline === undefined || baseline.startsWith('--'))) {
  console.error('--baseline necesita un prefijo, por ejemplo: --baseline 0002');
  process.exit(1);
}

const archivos = readdirSync(DIRECTORIO)
  .filter((name) => name.endsWith('.sql'))
  .sort();

const client = new pg.Client({ connectionString: url });
await client.connect();

try {
  // En simulación no se escribe nada, ni siquiera la tabla de control: si todavía no
  // existe, es que no se ha aplicado ninguna por aquí.
  const existe = await client.query<{ hay: string | null }>(
    "select to_regclass('public.schema_migrations')::text as hay",
  );
  const hayTabla = existe.rows[0]?.hay !== null;

  if (!hayTabla && !dry) {
    await client.query(`
      create table schema_migrations (
        name text primary key,
        applied_at timestamptz not null default now()
      )
    `);
  }

  const { rows } = hayTabla
    ? await client.query<{ name: string }>('select name from schema_migrations')
    : { rows: [] };
  const aplicadas = new Set(rows.map((row) => row.name));

  // Marcar como aplicadas las que ya se pusieron a mano, sin volver a ejecutarlas.
  if (baseline !== undefined) {
    const previas = archivos.filter((name) => name <= `${baseline}_zzz` && !aplicadas.has(name));
    for (const name of previas) {
      if (!dry) {
        await client.query('insert into schema_migrations (name) values ($1)', [name]);
      }
      aplicadas.add(name);
      console.log(`${dry ? '[simulado] ' : ''}marcada como ya aplicada: ${name}`);
    }
  }

  const pendientes = archivos.filter((name) => !aplicadas.has(name));

  if (pendientes.length === 0) {
    console.log('No hay migraciones pendientes.');
  }

  for (const name of pendientes) {
    const sql = readFileSync(join(DIRECTORIO, name), 'utf8');

    if (dry) {
      console.log(`[simulado] aplicaría ${name} (${sql.split('\n').length} líneas)`);
      continue;
    }

    process.stdout.write(`aplicando ${name}… `);
    try {
      await client.query('begin');
      await client.query(sql);
      await client.query('insert into schema_migrations (name) values ($1)', [name]);
      await client.query('commit');
      console.log('hecho');
    } catch (error) {
      await client.query('rollback');
      console.log('FALLÓ (nada se ha quedado a medias)');
      throw error;
    }
  }
} finally {
  await client.end();
}
