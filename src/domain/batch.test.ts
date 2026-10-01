import { describe, expect, it } from 'vitest';
import { ANDRES, CRISTINA, testFoods, testPlan, WEEK_START } from './__fixtures__/plan';
import { suggestBatchCooking } from './batch';
import { resolveWeek } from './resolve';

const weeks = [CRISTINA, ANDRES].map((profileId) =>
  resolveWeek({ plan: testPlan, profileId, weekStart: WEEK_START }),
);

const sugerencias = (from = WEEK_START, horizonDays?: number) =>
  suggestBatchCooking({ weeks, foods: testFoods, from, horizonDays });

describe('suggestBatchCooking', () => {
  it('propone el plato apto que se repite en el horizonte', () => {
    const pollo = sugerencias().find((s) => s.title === 'Pollo con arroz');
    expect(pollo).toBeDefined();
    expect(pollo?.repeated).toBe(true);
    expect(pollo?.occurrences).toBe(2);
    expect(pollo?.dates).toEqual(['2026-09-28', '2026-09-29']);
  });

  it('da la cantidad total para los dos', () => {
    const pollo = sugerencias().find((s) => s.title === 'Pollo con arroz');
    const ingrediente = pollo?.ingredients.find((i) => i.foodKey === 'pollo');

    // 120 + 180 el lunes, 120 + 180 el martes.
    expect(ingrediente?.total).toBe(600);
    expect(ingrediente?.perProfile[CRISTINA]).toBe(240);
    expect(ingrediente?.perProfile[ANDRES]).toBe(360);
  });

  it('solo lista los ingredientes aptos para adelantar', () => {
    const pollo = sugerencias().find((s) => s.title === 'Pollo con arroz');
    const claves = pollo?.ingredients.map((i) => i.foodKey);

    expect(claves).toContain('pollo');
    expect(claves).toContain('arroz');
    // El aceite no es batchable: no se adelanta.
    expect(claves).not.toContain('aove');
  });

  it('informa de los días que aguanta, el mínimo de sus ingredientes', () => {
    // Pollo aguanta 3 días y arroz 4: manda el pollo.
    expect(sugerencias().find((s) => s.title === 'Pollo con arroz')?.keepsDays).toBe(3);
  });

  it('descarta los platos sin ningún alimento apto', () => {
    expect(sugerencias().some((s) => s.title === 'Huevos rotos con jamón')).toBe(false);
    expect(sugerencias().some((s) => s.title === 'Tostada con pavo')).toBe(false);
  });

  it('respeta el horizonte de días', () => {
    // Con un solo día solo entra el lunes, así que ya no se repite.
    const unDia = sugerencias(WEEK_START, 1).find((s) => s.title === 'Pollo con arroz');
    expect(unDia?.occurrences).toBe(1);
    expect(unDia?.repeated).toBe(false);
    expect(unDia?.ingredients.find((i) => i.foodKey === 'pollo')?.total).toBe(300);
  });

  it('no mira hacia atrás', () => {
    const desdeMiercoles = sugerencias('2026-09-30');
    expect(desdeMiercoles).toHaveLength(0);
  });

  it('pone primero lo que más se repite', () => {
    const ordenadas = sugerencias().map((s) => s.occurrences);
    expect(ordenadas).toEqual([...ordenadas].sort((a, b) => b - a));
  });
});
