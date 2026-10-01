/**
 * Valida los planes de data/plans/*.json. Se ejecuta con `npm run seed:validate`.
 *
 * Tres capas:
 *  1. Esquema Zod (src/domain/schema.ts): la forma del documento.
 *  2. Integridad referencial: ids únicos, celdas que apuntan a bloques que existen,
 *     foodKey que existen en el catálogo, scopes y perfiles coherentes.
 *  3. Expectativas de la extracción: lo que se comprobó a mano contra los PDF queda aquí
 *     escrito como comprobación, para que un cambio accidental en el JSON salte.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Plan } from '../src/domain/schema.ts';
import type { Block, Plan as PlanType } from '../src/domain/schema.ts';

const PLANS_DIR = 'data/plans';

type Problem = { file: string; message: string };
const problems: Problem[] = [];
const fail = (file: string, message: string) => problems.push({ file, message });

/* ─────────────── Integridad referencial ─────────────── */

function checkIntegrity(file: string, plan: PlanType): void {
  const profileIds = new Set(plan.profiles.map((profile) => profile.profileId));
  const blockById = new Map<string, Block>();
  const foodKeys = new Set(plan.foods.map((food) => food.key));

  for (const block of plan.blocks) {
    if (blockById.has(block.id)) fail(file, `Bloque duplicado: ${block.id}`);
    blockById.set(block.id, block);

    if (block.planId !== plan.id) {
      fail(file, `El bloque ${block.id} dice pertenecer al plan ${block.planId}`);
    }
    if (block.scope !== 'shared' && !profileIds.has(block.scope)) {
      fail(file, `El bloque ${block.id} tiene un scope desconocido: ${block.scope}`);
    }
    if (block.originBlockId !== undefined) {
      fail(file, `El bloque ${block.id} del plan original no debería ser una copia`);
    }
  }

  const itemIds = new Set<string>();
  for (const block of plan.blocks) {
    for (const section of block.sections) {
      if (section.items.length === 0) {
        fail(file, `Sección vacía: ${section.id} en ${block.id}`);
      }
      for (const item of section.items) {
        if (itemIds.has(item.id)) fail(file, `Id de alimento duplicado: ${item.id}`);
        itemIds.add(item.id);

        if (item.foodKey !== undefined && !foodKeys.has(item.foodKey)) {
          fail(file, `${item.id} apunta a un alimento que no está en el catálogo: ${item.foodKey}`);
        }

        const owners = Object.keys(item.portions);
        if (owners.length === 0) {
          fail(file, `${item.id} ("${item.label}") no tiene ración para nadie`);
        }
        for (const owner of owners) {
          if (!profileIds.has(owner)) {
            fail(file, `${item.id} tiene ración para un perfil desconocido: ${owner}`);
          }
          if (block.scope !== 'shared' && owner !== block.scope) {
            fail(file, `${item.id} está en un bloque de ${block.scope} pero da ración a ${owner}`);
          }
        }
      }
    }
  }

  const seenCells = new Set<string>();
  for (const cell of plan.template) {
    const key = `${cell.day}|${cell.slot}|${cell.scope}`;
    if (seenCells.has(key)) fail(file, `Celda de plantilla duplicada: ${key}`);
    seenCells.add(key);

    if (cell.blockId !== null) {
      const block = blockById.get(cell.blockId);
      if (!block) {
        fail(file, `La celda ${key} apunta a un bloque que no existe: ${cell.blockId}`);
      } else {
        if (block.slot !== cell.slot) {
          fail(file, `La celda ${key} usa un bloque de la franja ${block.slot}`);
        }
        if (block.scope !== cell.scope) {
          fail(file, `La celda ${key} usa un bloque con scope ${block.scope}`);
        }
      }
    }
  }

  // Cada franja de cada perfil tiene que existir en la plantilla los siete días.
  const SHARED = new Set(['comida', 'cena']);
  for (const profile of plan.profiles) {
    for (const slot of profile.slots) {
      const scope = SHARED.has(slot) ? 'shared' : profile.profileId;
      for (let day = 0; day <= 6; day++) {
        if (!seenCells.has(`${day}|${slot}|${scope}`)) {
          fail(file, `Falta la celda de plantilla ${day}|${slot}|${scope}`);
        }
      }
    }
  }

  const huerfanos = plan.blocks.filter(
    (block) => !plan.template.some((cell) => cell.blockId === block.id),
  );
  for (const block of huerfanos) fail(file, `Bloque sin celda en la plantilla: ${block.id}`);
}

/* ─────────────── Expectativas de la extracción ─────────────── */

/**
 * Lo verificado a mano contra los PDF de septiembre de 2026. Está aquí para que, si
 * alguien toca el JSON, salte en vez de pasar inadvertido. Ver docs/extraccion-informe.md.
 */
const EXPECTED: Record<
  string,
  (plan: PlanType, check: (ok: boolean, msg: string) => void) => void
> = {
  '2026-09': (plan, check) => {
    const block = (id: string) => plan.blocks.find((b) => b.id === id);
    const items = (id: string) => block(id)?.sections.flatMap((s) => s.items) ?? [];
    const sections = (id: string, kind: string) =>
      block(id)?.sections.filter((s) => s.kind === kind) ?? [];

    // El jamón de la cena del lunes es lo único que cambia de cantidad entre los dos.
    const jamon = items('cena-0-shared').find((i) => i.foodKey === 'jamon-serrano');
    check(
      jamon?.portions['cristina']?.rawG === 60,
      'Cena del lunes: Cristina debe tener 60 g de jamón',
    );
    check(
      jamon?.portions['andres']?.rawG === 30,
      'Cena del lunes: Andrés debe tener 30 g de jamón',
    );

    // Pan en la cena: solo Andrés, martes, miércoles y jueves.
    for (let day = 0; day <= 6; day++) {
      const pan = sections(`cena-${day}-shared`, 'pan');
      const esperado = day >= 1 && day <= 3;
      check(
        pan.length > 0 === esperado,
        `Cena del día ${day}: ${esperado ? 'debe' : 'no debe'} llevar sección de pan`,
      );
      for (const item of pan.flatMap((s) => s.items)) {
        check(
          Object.keys(item.portions).join() === 'andres',
          `El pan de la cena del día ${day} es solo de Andrés`,
        );
      }
    }

    // Pan en la comida: solo Cristina y solo el jueves.
    for (let day = 0; day <= 6; day++) {
      const pan = sections(`comida-${day}-shared`, 'pan');
      check(
        pan.length > 0 === (day === 3),
        `Comida del día ${day}: ${day === 3 ? 'debe' : 'no debe'} llevar sección de pan`,
      );
      for (const item of pan.flatMap((s) => s.items)) {
        check(
          Object.keys(item.portions).join() === 'cristina',
          'El pan de la comida del jueves es solo de Cristina',
        );
      }
    }

    // Domingo sin bloques: las dos ingestas libres de la semana.
    for (const cell of plan.template.filter((c) => c.day === 6)) {
      check(cell.blockId === null, `El domingo no lleva bloques (${cell.slot}/${cell.scope})`);
    }
    check(plan.rules.freeMealsPerWeek === 2, 'La regla son 2 ingestas libres por semana');

    // Entrenos.
    const training = (id: string) => plan.profiles.find((p) => p.profileId === id)?.training;
    check(
      training('cristina')?.filter(Boolean).length === 1,
      'Cristina entrena un único día (lunes, gimnasio)',
    );
    check(
      training('andres')?.[0] !== null &&
        training('andres')?.[2] === 'Running' &&
        training('andres')?.[5] === 'Caminar',
      'Andrés: gimnasio el lunes, running el miércoles y caminar el sábado',
    );

    // Comodín: Andrés dobla a Cristina salvo en la whey.
    const comodin = (id: string) => plan.profiles.find((p) => p.profileId === id)?.comodin ?? [];
    const whey = (id: string) => comodin(id).find((o) => o.id === 'comodin-whey');
    check(
      whey('cristina')?.amount === whey('andres')?.amount,
      'La whey del comodín es igual para los dos',
    );
    check(
      comodin('cristina').length === 6 && comodin('andres').length === 6,
      'Cada perfil tiene 6 opciones de comodín',
    );

    // Comida y cena comparten plato: mismos alimentos para los dos.
    for (let day = 0; day <= 5; day++) {
      for (const slot of ['comida', 'cena']) {
        for (const section of sections(`${slot}-${day}-shared`, 'plato')) {
          for (const item of section.items) {
            check(
              Object.keys(item.portions).length === 2,
              `${item.id} ("${item.label}") es de un plato compartido: debe tener ración para los dos`,
            );
          }
        }
      }
    }
  },
};

/* ─────────────── Ejecución ─────────────── */

const files = readdirSync(PLANS_DIR).filter((name) => name.endsWith('.json'));
if (files.length === 0) {
  console.error(`No hay ningún plan en ${PLANS_DIR}/`);
  process.exit(1);
}

for (const file of files) {
  const raw = JSON.parse(readFileSync(join(PLANS_DIR, file), 'utf8')) as unknown;
  const result = Plan.safeParse(raw);

  if (!result.success) {
    for (const issue of result.error.issues) {
      fail(file, `${issue.path.join('.') || '(raíz)'}: ${issue.message}`);
    }
    continue;
  }

  const plan = result.data;
  checkIntegrity(file, plan);

  const expectations = EXPECTED[plan.id];
  if (expectations) {
    expectations(plan, (ok, message) => {
      if (!ok) fail(file, `Expectativa incumplida · ${message}`);
    });
  }

  const blockCount = plan.blocks.length;
  const itemCount = plan.blocks.reduce(
    (n, block) => n + block.sections.reduce((m, section) => m + section.items.length, 0),
    0,
  );
  console.log(
    `${file}: ${plan.name} · ${plan.profiles.length} perfiles · ${blockCount} bloques · ` +
      `${itemCount} alimentos · ${plan.foods.length} en catálogo` +
      (expectations ? ' · expectativas comprobadas' : ''),
  );
}

if (problems.length > 0) {
  console.error(`\n${problems.length} problema(s):`);
  for (const problem of problems) console.error(`  ${problem.file} · ${problem.message}`);
  process.exit(1);
}

console.log('\nTodo correcto.');
