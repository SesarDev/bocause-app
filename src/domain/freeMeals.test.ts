import { describe, expect, it } from 'vitest';
import { CRISTINA, testPlan, WEEK_START } from './__fixtures__/plan';
import { canMarkFree, countFreeMeals, freeMealsLeft } from './freeMeals';
import { resolveWeek } from './resolve';
import type { WeekOverride } from './schema';

const rules = testPlan.rules; // freeMealsPerWeek: 2

function semanaCon(...libres: { day: number; slot: 'comida' | 'cena' }[]) {
  const overrides: WeekOverride[] = libres.map(({ day, slot }) => ({
    weekStart: WEEK_START,
    day,
    slot,
    scope: 'shared',
    blockId: null,
    isFree: true,
  }));
  return resolveWeek({ plan: testPlan, profileId: CRISTINA, weekStart: WEEK_START, overrides });
}

describe('canMarkFree', () => {
  it('con el cupo intacto se puede marcar', () => {
    const week = semanaCon();
    expect(countFreeMeals(week)).toBe(0);
    expect(freeMealsLeft(week, rules)).toBe(2);
    expect(canMarkFree(week, rules)).toBe(true);
  });

  it('con una usada todavía queda una', () => {
    const week = semanaCon({ day: 0, slot: 'comida' });
    expect(countFreeMeals(week)).toBe(1);
    expect(freeMealsLeft(week, rules)).toBe(1);
    expect(canMarkFree(week, rules)).toBe(true);
  });

  it('no se puede marcar una tercera', () => {
    const week = semanaCon({ day: 0, slot: 'comida' }, { day: 2, slot: 'cena' });
    expect(countFreeMeals(week)).toBe(2);
    expect(freeMealsLeft(week, rules)).toBe(0);
    expect(canMarkFree(week, rules)).toBe(false);
  });

  it('pero sí se puede desmarcar una de las ya marcadas', () => {
    const week = semanaCon({ day: 0, slot: 'comida' }, { day: 2, slot: 'cena' });
    const yaLibre = { day: 0, slot: 'comida' as const, scope: 'shared' };
    expect(canMarkFree(week, rules, yaLibre)).toBe(true);
    // Una celda distinta sigue bloqueada.
    expect(canMarkFree(week, rules, { day: 3, slot: 'cena', scope: 'shared' })).toBe(false);
  });

  it('el cupo sale de las reglas del plan', () => {
    const week = semanaCon({ day: 0, slot: 'comida' });
    expect(canMarkFree(week, { freeMealsPerWeek: 1 })).toBe(false);
    expect(canMarkFree(week, { freeMealsPerWeek: 3 })).toBe(true);
  });

  it('el contador es de la semana, no del plan entero', () => {
    const overrides: WeekOverride[] = [
      {
        weekStart: WEEK_START,
        day: 0,
        slot: 'comida',
        scope: 'shared',
        blockId: null,
        isFree: true,
      },
      {
        weekStart: '2026-10-05',
        day: 0,
        slot: 'cena',
        scope: 'shared',
        blockId: null,
        isFree: true,
      },
    ];
    const semana = resolveWeek({
      plan: testPlan,
      profileId: CRISTINA,
      weekStart: WEEK_START,
      overrides,
    });
    expect(countFreeMeals(semana)).toBe(1);
  });
});
