import { describe, expect, it } from 'vitest';
import { ANDRES, CRISTINA, testFoods, testPlan, WEEK_START } from './__fixtures__/plan';
import { resolveWeek } from './resolve';
import { buildShoppingList, findLine, formatQuantity, quantityOf } from './shopping';
import type { WeekOverride } from './schema';

function semanas(overrides: WeekOverride[] = []) {
  return [CRISTINA, ANDRES].map((profileId) =>
    resolveWeek({ plan: testPlan, profileId, weekStart: WEEK_START, overrides }),
  );
}

const lista = () => buildShoppingList({ weeks: semanas(), foods: testFoods, from: WEEK_START });

describe('quantityOf', () => {
  it('prioriza crudo sobre cocido', () => {
    expect(quantityOf({ rawG: 120, cookedG: 90 })).toEqual({ amount: 120, unit: 'g' });
  });

  it('usa cocido si no hay crudo', () => {
    expect(quantityOf({ cookedG: 90 })).toEqual({ amount: 90, unit: 'g' });
  });

  it('entiende ml y unidades', () => {
    expect(quantityOf({ ml: 10 })).toEqual({ amount: 10, unit: 'ml' });
    expect(quantityOf({ units: 2 })).toEqual({ amount: 2, unit: 'ud' });
  });

  it('devuelve null si solo hay una medida casera', () => {
    expect(quantityOf({ measure: 'al gusto' })).toBeNull();
  });
});

describe('buildShoppingList', () => {
  it('suma el pavo de los dos', () => {
    // Cristina 50 g + Andrés 100 g en el desayuno del lunes.
    const pavo = findLine(lista(), 'pechuga-pavo');
    expect(pavo?.total).toBe(150);
    expect(pavo?.perProfile[CRISTINA]).toBe(50);
    expect(pavo?.perProfile[ANDRES]).toBe(100);
  });

  it('no cuenta dos veces los platos compartidos', () => {
    // Pollo: lunes 120+180 y martes 120+180.
    const pollo = findLine(lista(), 'pollo');
    expect(pollo?.total).toBe(600);
    expect(pollo?.perProfile[CRISTINA]).toBe(240);
    expect(pollo?.perProfile[ANDRES]).toBe(360);
  });

  it('suma lo que solo come una persona', () => {
    // Jamón de la cena: 60 de Cristina + 30 de Andrés.
    expect(findLine(lista(), 'jamon-serrano')?.total).toBe(90);
  });

  it('agrupa por sección del súper', () => {
    const secciones = lista().groups.map((group) => group.section);
    expect(secciones).toContain('carniceria');
    expect(secciones).toContain('fruteria');
    // Y respeta el orden de recorrido configurado.
    expect(secciones.indexOf('fruteria')).toBeLessThan(secciones.indexOf('despensa'));
  });

  it('usa el nombre del catálogo, no la etiqueta del plan', () => {
    expect(findLine(lista(), 'aove')?.label).toBe('Aceite de oliva virgen extra');
    expect(findLine(lista(), 'aove')?.unit).toBe('ml');
  });

  it('anota de qué días viene cada línea', () => {
    expect(findLine(lista(), 'pollo')?.dates).toEqual(['2026-09-28', '2026-09-29']);
  });

  it('deja aparte lo que no se puede sumar', () => {
    const sueltos = lista().loose;
    const especias = sueltos.find((line) => line.label === 'Especias al gusto');
    expect(especias).toBeDefined();
    expect(especias?.measures).toEqual(['al gusto']);
    // Y no aparece en las líneas sumables.
    expect(
      lista()
        .groups.flatMap((g) => g.lines)
        .some((l) => l.label === 'Especias al gusto'),
    ).toBe(false);
  });

  it('separa unidades distintas del mismo alimento', () => {
    // El plátano del fixture siempre va en unidades: 1 snack + 2 almuerzo + 1 + 1 de postre.
    const platano = findLine(lista(), 'platano');
    expect(platano?.unit).toBe('ud');
    expect(platano?.total).toBe(5);
  });
});

describe('rango de fechas', () => {
  it('"lo que queda de semana" descarta los días pasados', () => {
    const desdeMartes = buildShoppingList({
      weeks: semanas(),
      foods: testFoods,
      from: '2026-09-29',
    });
    // Solo queda la comida del martes: 120 + 180.
    expect(findLine(desdeMartes, 'pollo')?.total).toBe(300);
    expect(findLine(desdeMartes, 'pechuga-pavo')).toBeUndefined();
  });

  it('el límite superior es exclusivo', () => {
    const soloLunes = buildShoppingList({
      weeks: semanas(),
      foods: testFoods,
      from: WEEK_START,
      to: '2026-09-29',
    });
    expect(findLine(soloLunes, 'pollo')?.total).toBe(300);
  });

  it('una ingesta libre no se compra', () => {
    const libre: WeekOverride[] = [
      {
        weekStart: WEEK_START,
        day: 0,
        slot: 'cena',
        scope: 'shared',
        blockId: 'cena-lun',
        isFree: true,
      },
    ];
    expect(
      findLine(
        buildShoppingList({ weeks: semanas(libre), foods: testFoods, from: WEEK_START }),
        'jamon-serrano',
      ),
    ).toBeUndefined();
  });
});

describe('formatQuantity', () => {
  it('escribe la unidad detrás de la cantidad', () => {
    expect(formatQuantity(150, 'g')).toBe('150 g');
    expect(formatQuantity(20, 'ml')).toBe('20 ml');
    expect(formatQuantity(5, 'ud')).toBe('5 ud');
  });
});
