import { describe, expect, it } from 'vitest';
import { ANDRES, CRISTINA, testPlan, WEEK_START } from './__fixtures__/plan';
import { findSlot, resolveWeek } from './resolve';
import { canSwap, swapCells, swapValidation, type CellUpsert, type SwapCell } from './swap';
import type { TemplateCell, WeekOverride } from './schema';

const comidaLunes: SwapCell = {
  cell: { day: 0, slot: 'comida', scope: 'shared' },
  blockId: 'comida-lun',
};
const comidaMartes: SwapCell = {
  cell: { day: 1, slot: 'comida', scope: 'shared' },
  blockId: 'comida-mar',
};
const comidaDomingo: SwapCell = {
  cell: { day: 6, slot: 'comida', scope: 'shared' },
  blockId: null,
};

/** Reparte los upserts en lo que espera resolveWeek, para comprobar el efecto real. */
function apply(upserts: CellUpsert[]) {
  const overrides: WeekOverride[] = [];
  const templateCells: TemplateCell[] = [];
  for (const upsert of upserts) {
    if (upsert.level === 'week') overrides.push(upsert.row);
    else templateCells.push(upsert.row);
  }
  return { overrides, templateCells };
}

describe('validación', () => {
  it('no deja intercambiar entre franjas distintas', () => {
    const cena: SwapCell = { cell: { day: 1, slot: 'cena', scope: 'shared' }, blockId: 'cena-lun' };
    expect(swapValidation(comidaLunes, cena)).toBe('franja-distinta');
    expect(canSwap(comidaLunes, cena)).toBe(false);
  });

  it('no deja intercambiar entre una compartida y una individual', () => {
    const desayuno: SwapCell = {
      cell: { day: 1, slot: 'comida', scope: CRISTINA },
      blockId: 'des-c',
    };
    expect(swapValidation(comidaLunes, desayuno)).toBe('scope-distinto');
  });

  it('no deja intercambiar una celda consigo misma', () => {
    expect(swapValidation(comidaLunes, comidaLunes)).toBe('misma-celda');
  });

  it('no deja intercambiar dos celdas vacías', () => {
    const otroVacio: SwapCell = {
      cell: { day: 5, slot: 'comida', scope: 'shared' },
      blockId: null,
    };
    expect(swapValidation(comidaDomingo, otroVacio)).toBe('ambas-vacias');
  });

  it('un intercambio válido devuelve ok con dos filas', () => {
    const result = swapCells(comidaLunes, comidaMartes, { level: 'week', weekStart: WEEK_START });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.upserts).toHaveLength(2);
  });

  it('un intercambio inválido no genera ninguna fila', () => {
    const cena: SwapCell = { cell: { day: 1, slot: 'cena', scope: 'shared' }, blockId: 'cena-lun' };
    const result = swapCells(comidaLunes, cena, { level: 'week', weekStart: WEEK_START });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('franja-distinta');
  });
});

describe('intercambio compartido', () => {
  it('afecta a los dos perfiles a la vez', () => {
    const result = swapCells(comidaLunes, comidaMartes, { level: 'week', weekStart: WEEK_START });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.affectsBothProfiles).toBe(true);
    const { overrides } = apply(result.upserts);

    for (const profileId of [CRISTINA, ANDRES]) {
      const week = resolveWeek({ plan: testPlan, profileId, weekStart: WEEK_START, overrides });
      expect(findSlot(week, 0, 'comida')?.blockId).toBe('comida-mar');
      expect(findSlot(week, 1, 'comida')?.blockId).toBe('comida-lun');
    }
  });

  it('el bloque viaja entero, con su pan y su postre', () => {
    const result = swapCells(comidaLunes, comidaMartes, { level: 'week', weekStart: WEEK_START });
    if (!result.ok) throw new Error('el intercambio debería ser válido');

    const week = resolveWeek({
      plan: testPlan,
      profileId: CRISTINA,
      weekStart: WEEK_START,
      ...apply(result.upserts),
    });

    // La comida del lunes (con pan y postre) ahora está en el martes.
    expect(findSlot(week, 1, 'comida')?.block?.sections.map((s) => s.kind)).toEqual([
      'plato',
      'pan',
      'postre',
    ]);
  });
});

describe('intercambio individual', () => {
  it('no toca al otro perfil', () => {
    const lunes: SwapCell = {
      cell: { day: 0, slot: 'desayuno', scope: CRISTINA },
      blockId: 'des-c',
    };
    const martes: SwapCell = { cell: { day: 1, slot: 'desayuno', scope: CRISTINA }, blockId: null };

    const result = swapCells(lunes, martes, { level: 'week', weekStart: WEEK_START });
    if (!result.ok) throw new Error('el intercambio debería ser válido');
    expect(result.affectsBothProfiles).toBe(false);

    const { overrides } = apply(result.upserts);
    const cristina = resolveWeek({
      plan: testPlan,
      profileId: CRISTINA,
      weekStart: WEEK_START,
      overrides,
    });
    const andres = resolveWeek({
      plan: testPlan,
      profileId: ANDRES,
      weekStart: WEEK_START,
      overrides,
    });

    expect(findSlot(cristina, 0, 'desayuno')?.blockId).toBeNull();
    expect(findSlot(cristina, 1, 'desayuno')?.blockId).toBe('des-c');
    // El desayuno de Andrés sigue donde estaba.
    expect(findSlot(andres, 0, 'desayuno')?.blockId).toBe('des-a');
  });
});

describe('intercambio con celda vacía', () => {
  it('mueve la comida al domingo y deja vacío el lunes', () => {
    const result = swapCells(comidaLunes, comidaDomingo, { level: 'week', weekStart: WEEK_START });
    if (!result.ok) throw new Error('el intercambio debería ser válido');

    const week = resolveWeek({
      plan: testPlan,
      profileId: ANDRES,
      weekStart: WEEK_START,
      ...apply(result.upserts),
    });

    expect(findSlot(week, 0, 'comida')?.blockId).toBeNull();
    expect(findSlot(week, 6, 'comida')?.blockId).toBe('comida-lun');
  });
});

describe('niveles', () => {
  it('a nivel de plantilla cambia todas las semanas', () => {
    const result = swapCells(comidaLunes, comidaMartes, { level: 'template' });
    if (!result.ok) throw new Error('el intercambio debería ser válido');

    const { templateCells, overrides } = apply(result.upserts);
    expect(overrides).toHaveLength(0);

    for (const weekStart of [WEEK_START, '2026-10-05']) {
      const week = resolveWeek({ plan: testPlan, profileId: CRISTINA, weekStart, templateCells });
      expect(findSlot(week, 0, 'comida')?.blockId).toBe('comida-mar');
      expect(findSlot(week, 0, 'comida')?.source).toBe('template');
    }
  });

  it('a nivel de semana solo cambia esa semana', () => {
    const result = swapCells(comidaLunes, comidaMartes, { level: 'week', weekStart: WEEK_START });
    if (!result.ok) throw new Error('el intercambio debería ser válido');
    const { overrides } = apply(result.upserts);

    const siguiente = resolveWeek({
      plan: testPlan,
      profileId: CRISTINA,
      weekStart: '2026-10-05',
      overrides,
    });
    expect(findSlot(siguiente, 0, 'comida')?.blockId).toBe('comida-lun');
    expect(findSlot(siguiente, 0, 'comida')?.source).toBe('original');
  });

  it('normaliza el weekStart al lunes', () => {
    const result = swapCells(comidaLunes, comidaMartes, { level: 'week', weekStart: '2026-10-01' });
    if (!result.ok) throw new Error('el intercambio debería ser válido');
    const { overrides } = apply(result.upserts);
    expect(overrides.every((row) => row.weekStart === WEEK_START)).toBe(true);
  });

  it('la marca de ingesta libre se queda en su día', () => {
    const libre: SwapCell = { ...comidaLunes, isFree: true };
    const result = swapCells(libre, comidaMartes, { level: 'week', weekStart: WEEK_START });
    if (!result.ok) throw new Error('el intercambio debería ser válido');

    const { overrides } = apply(result.upserts);
    expect(overrides.find((row) => row.day === 0)?.isFree).toBe(true);
    expect(overrides.find((row) => row.day === 1)?.isFree).toBe(false);
  });
});
