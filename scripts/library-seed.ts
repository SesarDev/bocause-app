/**
 * Siembra el catálogo de alimentos y la biblioteca de bloques: `npm run library:seed`
 *
 * El catálogo sale de `plan.foods`. La biblioteca, de los bloques del plan, que es la forma
 * más rápida de que la nutricionista empiece con algo en las manos en vez de con una lista
 * vacía.
 *
 * Dos decisiones que conviene conocer:
 *
 * 1. **Se quitan los duplicados por contenido.** El plan repite platos entre días (42
 *    bloques, 33 distintos). En la biblioteca un plato repetido es ruido.
 * 2. **La ración base es la de Cristina.** Hay que elegir una, y al usar el bloque se
 *    reparte con el multiplicador de cada comensal. Si un alimento no lo come ella, se toma
 *    la ración de quien sí, para no perderlo.
 *
 * NO crea grupos de equivalencia: eso lo decide la nutricionista y la app no se inventa
 * equivalencias (CLAUDE.md).
 *
 * Es repetible: no duplica lo que ya está.
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { LibraryBlock, Plan, type Portion, type Section } from '../src/domain/schema.ts';
import type { Database } from '../src/data/database.types.ts';

const PLAN_FILE = process.env['SEED_PLAN'] ?? 'data/plans/2026-09.json';
const BASE_PROFILE = process.env['LIBRARY_BASE_PROFILE'] ?? 'cristina';

const url = process.env['VITE_SUPABASE_URL'];
const serviceKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];

if (!url || !serviceKey) {
  console.error('Faltan VITE_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local.');
  process.exit(1);
}

const db = createClient<Database>(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const plan = Plan.parse(JSON.parse(readFileSync(PLAN_FILE, 'utf8')));
console.log(
  `Plan: ${plan.name} · ${plan.foods.length} alimentos · ${plan.blocks.length} bloques\n`,
);

/* ─────────────── Catálogo ─────────────── */

const foods = plan.foods.map((food) => ({
  key: food.key,
  name: food.name,
  section: food.section,
  unit: food.unit,
  batchable: food.batchable,
  keeps_days: food.keepsDays ?? null,
}));

const upsertFoods = await db.from('foods').upsert(foods, { onConflict: 'key' });
if (upsertFoods.error) {
  console.error('No se pudo sembrar el catálogo:', upsertFoods.error.message);
  process.exit(1);
}
console.log(`Catálogo: ${foods.length} alimentos.`);

/* ─────────────── Biblioteca ─────────────── */

/**
 * Huella de lo que se va a GUARDAR, no del bloque original.
 *
 * La biblioteca guarda una sola ración base, así que dos bloques que solo se diferencian en
 * la ración de la *otra* persona acaban siendo la misma entrada. Deduplicar por el bloque
 * entero dejaba pares idénticos con el mismo nombre ("Pan con huevos revueltos" dos veces),
 * y además rompía la repetibilidad del script, porque el salto por nombre solo pillaba uno.
 */
function huella(sections: readonly LibrarySectionSeed[]): string {
  return JSON.stringify(
    sections.map((section) => [
      section.kind,
      section.title ?? '',
      section.items.map((item) => [item.label, item.base]),
    ]),
  );
}

type LibrarySectionSeed = {
  id: string;
  kind: Section['kind'];
  title?: string;
  items: { id: string; foodKey?: string; label: string; base: Portion; note?: string }[];
};

/**
 * Cómo se llama este plato.
 *
 * Lo normal sería el título de la sección, pero **27 de los 42 bloques no tienen ninguno**:
 * los desayunos y los snacks del PDF son una lista de alimentos sin encabezado. Para esos
 * se usan los primeros alimentos, que son los que de verdad lo identifican (el café y el
 * complejo vitamínico salen en todos y van al final).
 */
function nombreDe(sections: readonly Section[]): string {
  const titulos = sections.map((section) => section.title).filter((t) => t !== undefined);
  if (titulos.length > 0) return titulos.join(' + ');

  const labels = sections.flatMap((section) => section.items.map((item) => item.label));
  const primeros = labels.slice(0, 3);
  return primeros.length === 0 ? 'Sin nombre' : primeros.join(', ');
}

/** Ración de referencia: la del perfil base, o la de quien sí lo coma. */
function baseDe(portions: Record<string, Portion>): Portion | null {
  const propia = portions[BASE_PROFILE];
  if (propia !== undefined) return propia;
  const alguna = Object.values(portions)[0];
  return alguna ?? null;
}

const sinRacion: string[] = [];

/** Reduce un bloque del plan a lo que iría a la biblioteca: una ración base por alimento. */
function aSeccionesBase(sections: readonly Section[], nombre: string): LibrarySectionSeed[] {
  return sections
    .map((section) => ({
      id: section.id,
      kind: section.kind,
      ...(section.title !== undefined ? { title: section.title } : {}),
      items: section.items.flatMap((item) => {
        const base = baseDe(item.portions);
        if (base === null) {
          sinRacion.push(`${nombre} → ${item.label}`);
          return [];
        }
        return [
          {
            id: item.id,
            ...(item.foodKey !== undefined ? { foodKey: item.foodKey } : {}),
            label: item.label,
            base,
            ...(item.note !== undefined ? { note: item.note } : {}),
          },
        ];
      }),
    }))
    .filter((section) => section.items.length > 0);
}

const porHuella = new Map<
  string,
  { nombre: string; slots: Set<string>; sections: LibrarySectionSeed[] }
>();

for (const block of plan.blocks) {
  const nombre = nombreDe(block.sections);
  const sections = aSeccionesBase(block.sections, nombre);
  if (sections.length === 0) continue;

  const clave = huella(sections);
  const existente = porHuella.get(clave);

  if (existente) {
    existente.slots.add(block.slot);
    continue;
  }

  porHuella.set(clave, { nombre, slots: new Set([block.slot]), sections });
}

/**
 * Dos platos distintos pueden querer llamarse igual (el mismo desayuno con otras
 * cantidades). Se desempata con un número para que la lista no tenga dos filas idénticas y
 * para que el salto por nombre al repetir el script sea fiable.
 */
const vistos = new Map<string, number>();
for (const entrada of porHuella.values()) {
  const veces = (vistos.get(entrada.nombre) ?? 0) + 1;
  vistos.set(entrada.nombre, veces);
  if (veces > 1) entrada.nombre = `${entrada.nombre} (${veces})`;
}

console.log(`Bloques distintos: ${porHuella.size} (de ${plan.blocks.length}).`);

// Lo que ya hay, para no duplicar al repetir el script.
const existentes = await db.from('library_blocks').select('name');
if (existentes.error) {
  console.error('No se pudo leer la biblioteca:', existentes.error.message);
  process.exit(1);
}
const nombresPuestos = new Set(existentes.data.map((row) => row.name));

const nuevos: Database['public']['Tables']['library_blocks']['Insert'][] = [];
const saltados: string[] = [];

for (const entrada of porHuella.values()) {
  if (nombresPuestos.has(entrada.nombre)) {
    saltados.push(entrada.nombre);
    continue;
  }

  // Validar con Zod antes de guardar, como todo lo que entra (CLAUDE.md).
  const validado = LibraryBlock.safeParse({
    id: crypto.randomUUID(),
    name: entrada.nombre,
    slots: [...entrada.slots],
    tags: [],
    sections: entrada.sections,
    archived: false,
  });

  if (!validado.success) {
    console.error(`"${entrada.nombre}" no pasa el esquema:`, validado.error.issues[0]?.message);
    process.exit(1);
  }

  nuevos.push({
    name: validado.data.name,
    slots: validado.data.slots,
    tags: validado.data.tags,
    content: { sections: validado.data.sections } as never,
    notes: null,
    archived: false,
    created_by: null,
  });
}

if (nuevos.length > 0) {
  const insert = await db.from('library_blocks').insert(nuevos);
  if (insert.error) {
    console.error('No se pudo sembrar la biblioteca:', insert.error.message);
    process.exit(1);
  }
}

/* ─────────────── Informe ─────────────── */

console.log(`\nBiblioteca: ${nuevos.length} bloques creados, ${saltados.length} ya estaban.`);

if (nuevos.length > 0) {
  console.log('\nCreados:');
  for (const bloque of nuevos) {
    console.log(`  · ${bloque.name}  [${(bloque.slots ?? []).join(', ')}]`);
  }
}

if (sinRacion.length > 0) {
  console.log(
    `\nAviso: ${sinRacion.length} alimentos se quedaron fuera por no tener ración en ningún perfil:`,
  );
  for (const item of sinRacion.slice(0, 10)) console.log(`  · ${item}`);
}

console.log(
  '\nLos grupos de equivalencia NO se siembran: los decide la nutricionista, y la app no\n' +
    'se inventa equivalencias. Se crean desde /admin/equivalencias.',
);
