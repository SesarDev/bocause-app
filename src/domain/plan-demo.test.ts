/**
 * Prueba de encaje entre un plan completo (data/plans/demo.json) y la lógica del dominio.
 * El resto de tests usan una maqueta pequeña; este usa un plan del tamaño de uno de verdad
 * (42 bloques, dos personas con franjas distintas), así que detecta una lógica que no
 * aguanta un documento entero. Los datos son ficticios.
 */
// Se carga con "?raw" en vez de node:fs: así vale el mismo tipado que el resto de la app
// (que es código de navegador) y no entra el JSON entero como tipo literal.
import planRaw from '../../data/plans/demo.json?raw';
import { describe, expect, it } from 'vitest';
import { Plan } from './schema';
import { allSlots, findSlot, resolveWeek } from './resolve';
import { buildShoppingList, findLine } from './shopping';
import { weekAdherence } from './progress';
import { suggestBatchCooking } from './batch';

const plan = Plan.parse(JSON.parse(planRaw));
const weekStart = plan.validFrom;

const DAYS = [0, 1, 2, 3, 4, 5, 6] as const;

const semana = (profileId: string) => resolveWeek({ plan, profileId, weekStart });
const a = semana('cristina');
const b = semana('andres');

describe('el plan de ejemplo pasa por resolveWeek', () => {
  it('la semana empieza el lunes 28/09/2026', () => {
    expect(weekStart).toBe('2026-09-28');
    expect(a.days.map((day) => day.date)).toEqual([
      '2026-09-28',
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
    ]);
  });

  it('cada persona ve sus propias franjas', () => {
    expect(a.days[0]?.slots.map((s) => s.cell.slot)).toEqual([
      'desayuno',
      'snack',
      'snack2',
      'comida',
      'cena',
    ]);
    expect(b.days[0]?.slots.map((s) => s.cell.slot)).toEqual([
      'desayuno',
      'almuerzo',
      'comida',
      'cena',
    ]);
  });

  it('de lunes a sábado no hay ninguna franja vacía', () => {
    for (const week of [a, b]) {
      for (const day of week.days.slice(0, 6)) {
        for (const slot of day.slots) {
          expect(slot.block, `${week.profileId} día ${day.day} ${slot.cell.slot}`).not.toBeNull();
        }
      }
    }
  });

  it('el domingo está vacío entero: son las dos ingestas libres', () => {
    for (const week of [a, b]) {
      for (const slot of week.days[6]?.slots ?? []) {
        expect(slot.block).toBeNull();
      }
    }
    expect(plan.rules.freeMealsPerWeek).toBe(2);
  });

  it('todo sale del plan original, sin cambios', () => {
    for (const slot of [...allSlots(a), ...allSlots(b)]) {
      expect(slot.source).toBe('original');
    }
  });

  it('lleva los entrenos de cada uno', () => {
    expect(a.days.map((d) => d.training).filter(Boolean)).toEqual([
      'Gimnasio (Fuerza)',
      'Gimnasio (Fuerza)',
    ]);
    expect(b.days[0]?.training).toBe('Running');
    expect(b.days[5]?.training).toBe('Bicicleta');
  });
});

describe('diferencias entre las dos personas', () => {
  it('la merluza de la cena del lunes: 150 g A, 200 g B', () => {
    const merluzaDe = (week: typeof a, profileId: string) =>
      findSlot(week, 0, 'cena')
        ?.block?.sections.flatMap((s) => s.items)
        .find((item) => item.foodKey === 'merluza')?.portions[profileId];

    expect(merluzaDe(a, 'cristina')?.rawG).toBe(150);
    expect(merluzaDe(b, 'andres')?.rawG).toBe(200);
  });

  it('el pan de la comida solo lo ve B, de lunes a miércoles', () => {
    for (const day of DAYS) {
      const tienePan = (week: typeof a) =>
        findSlot(week, day, 'comida')?.block?.sections.some((s) => s.kind === 'pan') ?? false;

      expect(tienePan(a), `A día ${day}`).toBe(false);
      expect(tienePan(b), `B día ${day}`).toBe(day <= 2);
    }
  });

  it('el pan de la cena del viernes solo lo ve A', () => {
    expect(findSlot(a, 4, 'cena')?.block?.sections.map((s) => s.kind)).toContain('pan');
    expect(findSlot(b, 4, 'cena')?.block?.sections.map((s) => s.kind)).not.toContain('pan');
  });

  it('el postre de la comida del martes: A solo manzana, B manzana y nueces', () => {
    const postre = (week: typeof a) =>
      findSlot(week, 1, 'comida')
        ?.block?.sections.filter((s) => s.kind === 'postre')
        .flatMap((s) => s.items.map((i) => i.foodKey)) ?? [];

    expect(postre(a)).toEqual(['manzana']);
    expect(postre(b)).toEqual(['manzana', 'nueces']);
  });

  it('el postre de la cena del lunes es solo de B', () => {
    const postre = (week: typeof a) =>
      findSlot(week, 0, 'cena')?.block?.sections.filter((s) => s.kind === 'postre') ?? [];

    expect(postre(a)).toHaveLength(0);
    expect(postre(b).flatMap((s) => s.items.map((i) => i.foodKey))).toEqual([
      'yogur-natural',
      'arandanos',
    ]);
  });
});

describe('la compra de la semana', () => {
  const compra = buildShoppingList({
    weeks: [a, b],
    foods: plan.foods,
    from: weekStart,
  });

  it('suma el pavo de los dos', () => {
    // A: desayuno L y J (40+40), snack X (60), cena J (80) = 220.
    // B: almuerzo L (60), cena J (100) = 160.
    const pavo = findLine(compra, 'pechuga-pavo');
    expect(pavo?.perProfile['cristina']).toBe(220);
    expect(pavo?.perProfile['andres']).toBe(160);
    expect(pavo?.total).toBe(380);
  });

  it('suma la merluza con las cantidades distintas de cada uno', () => {
    const merluza = findLine(compra, 'merluza');
    expect(merluza?.perProfile['cristina']).toBe(150);
    expect(merluza?.perProfile['andres']).toBe(200);
  });

  it('suma la fruta, que lleva la cantidad dentro de la medida casera', () => {
    // "Plátano (1 unidad mediana)": el 1 es la cantidad. Si se leyera solo como texto, toda
    // la fruta acabaría en la lista de lo no sumable y la frutería quedaría vacía.
    expect(findLine(compra, 'platano')).toMatchObject({ unit: 'ud', total: 8 });
    expect(findLine(compra, 'manzana')?.total).toBe(7);
    expect(findLine(compra, 'pera')?.total).toBe(4);
    expect(findLine(compra, 'naranja')?.total).toBe(3);
    expect(findLine(compra, 'kiwi')?.total).toBe(5);
  });

  it('agrupa por sección del súper y deja aparte lo que no se puede sumar', () => {
    const secciones = compra.groups.map((group) => group.section);
    expect(secciones).toContain('carniceria');
    expect(secciones).toContain('fruteria');
    expect(secciones).toContain('panaderia');
    // "Al gusto" y similares: no se inventan cantidades.
    expect(compra.loose.length).toBeGreaterThan(0);
  });

  it('no mete nada del domingo, que no tiene plan', () => {
    for (const line of compra.groups.flatMap((g) => g.lines)) {
      expect(line.dates).not.toContain('2026-10-04');
    }
  });
});

describe('batch cooking sobre un plan completo', () => {
  it('propone platos con alimentos aptos para adelantar', () => {
    const sugerencias = suggestBatchCooking({
      weeks: [a, b],
      foods: plan.foods,
      from: weekStart,
      horizonDays: 7,
    });

    expect(sugerencias.length).toBeGreaterThan(0);
    for (const sugerencia of sugerencias) {
      expect(sugerencia.ingredients.length).toBeGreaterThan(0);
    }
  });
});

describe('adherencia', () => {
  it('cuenta todos los alimentos de la semana de cada uno', () => {
    expect(weekAdherence(a, []).overall.total).toBeGreaterThan(0);
    expect(weekAdherence(b, []).overall.total).toBeGreaterThan(0);
    // Sin ningún check, la adherencia es cero.
    expect(weekAdherence(a, []).overall.ratio).toBe(0);
  });
});
