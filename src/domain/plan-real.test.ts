/**
 * Prueba de encaje entre la fase 3 (datos reales extraídos del PDF) y la fase 2 (lógica).
 * El resto de tests del dominio usan un plan sintético; este usa el de verdad, así que
 * detecta tanto un error de extracción como una lógica que no aguanta los datos reales.
 */
// Se carga con "?raw" en vez de node:fs: así vale el mismo tipado que el resto de la app
// (que es código de navegador) y no entra el JSON entero como tipo literal.
import planRaw from '../../data/plans/2026-09.json?raw';
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
const cristina = semana('cristina');
const andres = semana('andres');

describe('el plan real pasa por resolveWeek', () => {
  it('la semana empieza el lunes 28/09/2026', () => {
    expect(weekStart).toBe('2026-09-28');
    expect(cristina.days.map((day) => day.date)).toEqual([
      '2026-09-28',
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
    ]);
  });

  it('cada una ve sus propias franjas', () => {
    expect(cristina.days[0]?.slots.map((s) => s.cell.slot)).toEqual([
      'desayuno',
      'snack',
      'snack2',
      'comida',
      'cena',
    ]);
    expect(andres.days[0]?.slots.map((s) => s.cell.slot)).toEqual([
      'desayuno',
      'almuerzo',
      'comida',
      'cena',
    ]);
  });

  it('de lunes a sábado no hay ninguna franja vacía', () => {
    for (const week of [cristina, andres]) {
      for (const day of week.days.slice(0, 6)) {
        for (const slot of day.slots) {
          expect(slot.block, `${week.profileId} día ${day.day} ${slot.cell.slot}`).not.toBeNull();
        }
      }
    }
  });

  it('el domingo está vacío entero: son las dos ingestas libres', () => {
    for (const week of [cristina, andres]) {
      for (const slot of week.days[6]?.slots ?? []) {
        expect(slot.block).toBeNull();
      }
    }
    expect(plan.rules.freeMealsPerWeek).toBe(2);
  });

  it('todo sale del plan original, sin cambios', () => {
    for (const slot of [...allSlots(cristina), ...allSlots(andres)]) {
      expect(slot.source).toBe('original');
    }
  });

  it('lleva los entrenos de cada uno', () => {
    expect(cristina.days.map((d) => d.training).filter(Boolean)).toEqual([
      'Gimnasio (Fuerza - Hipertrofia)',
    ]);
    expect(andres.days[2]?.training).toBe('Running');
    expect(andres.days[5]?.training).toBe('Caminar');
  });
});

describe('diferencias entre las dos personas', () => {
  it('el jamón de la cena del lunes: 60 g ella, 30 g él', () => {
    const jamonDe = (week: typeof cristina, profileId: string) =>
      findSlot(week, 0, 'cena')
        ?.block?.sections.flatMap((s) => s.items)
        .find((item) => item.foodKey === 'jamon-serrano')?.portions[profileId];

    expect(jamonDe(cristina, 'cristina')?.rawG).toBe(60);
    expect(jamonDe(andres, 'andres')?.rawG).toBe(30);
  });

  it('el pan de la comida del jueves solo lo ve Cristina', () => {
    expect(findSlot(cristina, 3, 'comida')?.block?.sections.map((s) => s.kind)).toContain('pan');
    expect(findSlot(andres, 3, 'comida')?.block?.sections.map((s) => s.kind)).not.toContain('pan');
  });

  it('el pan de la cena solo lo ve Andrés, de martes a jueves', () => {
    for (const day of DAYS) {
      const tienePan = (week: typeof cristina) =>
        findSlot(week, day, 'cena')?.block?.sections.some((s) => s.kind === 'pan') ?? false;

      expect(tienePan(cristina), `cristina día ${day}`).toBe(false);
      expect(tienePan(andres), `andrés día ${day}`).toBe(day >= 1 && day <= 3);
    }
  });

  it('el postre de la comida del martes: ella solo plátano, él plátano y manzana', () => {
    const postre = (week: typeof cristina) =>
      findSlot(week, 1, 'comida')
        ?.block?.sections.filter((s) => s.kind === 'postre')
        .flatMap((s) => s.items.map((i) => i.foodKey)) ?? [];

    expect(postre(cristina)).toEqual(['platano']);
    expect(postre(andres)).toEqual(['platano', 'manzana']);
  });

  it('el postre de la cena del lunes es solo de Andrés', () => {
    const postre = (week: typeof cristina) =>
      findSlot(week, 0, 'cena')?.block?.sections.filter((s) => s.kind === 'postre') ?? [];

    expect(postre(cristina)).toHaveLength(0);
    expect(postre(andres).flatMap((s) => s.items.map((i) => i.foodKey))).toEqual([
      'kefir-natural',
      'kiwi',
    ]);
  });
});

describe('la compra de la semana', () => {
  const compra = buildShoppingList({
    weeks: [cristina, andres],
    foods: plan.foods,
    from: weekStart,
  });

  it('suma el pavo de los dos', () => {
    // Cristina: 100 g del snack del miércoles.
    // Andrés: 100 g del desayuno del miércoles y 100 g del almuerzo de lunes y viernes.
    const pavo = findLine(compra, 'pechuga-pavo');
    expect(pavo?.perProfile['cristina']).toBe(100);
    expect(pavo?.perProfile['andres']).toBe(300);
    expect(pavo?.total).toBe(400);
  });

  it('suma el jamón con las cantidades distintas de cada uno', () => {
    const jamon = findLine(compra, 'jamon-serrano');
    // Ella: desayuno L y V (30+30), comida M y J (30+30), cena L (60) = 180.
    // Él: desayuno L y V (30+30), comida M y J (30+30), cena L (30) = 150.
    expect(jamon?.perProfile['cristina']).toBe(180);
    expect(jamon?.perProfile['andres']).toBe(150);
  });

  it('agrupa por sección del súper y deja aparte lo que no se puede sumar', () => {
    const secciones = compra.groups.map((group) => group.section);
    expect(secciones).toContain('carniceria');
    expect(secciones).toContain('fruteria');
    expect(secciones).toContain('panaderia');
    // "Al gusto", "bolsa o al gusto"... no se inventan cantidades.
    expect(compra.loose.length).toBeGreaterThan(0);
  });

  it('no mete nada del domingo, que no tiene plan', () => {
    for (const line of compra.groups.flatMap((g) => g.lines)) {
      expect(line.dates).not.toContain('2026-10-04');
    }
  });
});

describe('batch cooking sobre datos reales', () => {
  it('propone platos con alimentos aptos para adelantar', () => {
    const sugerencias = suggestBatchCooking({
      weeks: [cristina, andres],
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
    expect(weekAdherence(cristina, []).overall.total).toBeGreaterThan(0);
    expect(weekAdherence(andres, []).overall.total).toBeGreaterThan(0);
    // Sin ningún check, la adherencia es cero.
    expect(weekAdherence(cristina, []).overall.ratio).toBe(0);
  });
});
