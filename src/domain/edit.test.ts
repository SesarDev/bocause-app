import { describe, expect, it } from 'vitest';
import { CRISTINA, testPlan, WEEK_START } from './__fixtures__/plan';
import { forkBlock, originOf, restoreCell } from './edit';
import { findSlot, resolveWeek } from './resolve';
import type { Block, CellKey, Section, TemplateCell, WeekOverride } from './schema';

const original = testPlan.blocks.find((block) => block.id === 'comida-lun') as Block;

const nuevaSeccion: Section = {
  id: 'seccion-nueva',
  kind: 'plato',
  title: 'Pollo con quinoa',
  items: [{ id: 'quinoa', label: 'Quinoa', portions: { [CRISTINA]: { rawG: 60 } } }],
};

describe('forkBlock', () => {
  it('crea un bloque nuevo sin tocar el original', () => {
    const antes = JSON.stringify(original);
    const copia = forkBlock(original, { sections: [nuevaSeccion] }, 'copia-1');

    expect(copia.id).toBe('copia-1');
    expect(copia.isOriginal).toBe(false);
    expect(copia.originBlockId).toBe('comida-lun');
    expect(copia.sections[0]?.title).toBe('Pollo con quinoa');
    expect(JSON.stringify(original)).toBe(antes);
  });

  it('conserva franja y scope del bloque de partida', () => {
    const copia = forkBlock(original, { sections: [nuevaSeccion] }, 'copia-1');
    expect(copia.slot).toBe('comida');
    expect(copia.scope).toBe('shared');
  });

  it('sin cambios, copia las secciones tal cual', () => {
    const copia = forkBlock(original, {}, 'copia-1');
    expect(copia.sections).toEqual(original.sections);
  });

  it('al copiar una copia sigue apuntando al original de verdad', () => {
    const primera = forkBlock(original, { sections: [nuevaSeccion] }, 'copia-1');
    const segunda = forkBlock(primera, { sections: [nuevaSeccion] }, 'copia-2');

    // Si apuntara a "copia-1", restaurar devolvería a una versión ya editada.
    expect(segunda.originBlockId).toBe('comida-lun');
    expect(originOf(segunda)).toBe('comida-lun');
  });
});

describe('restoreCell', () => {
  const cell: CellKey = { day: 0, slot: 'comida', scope: 'shared' };

  it('a nivel de semana borra el override y deja ver la plantilla', () => {
    const plan = restoreCell(cell, testPlan.template, { level: 'week', weekStart: WEEK_START });

    expect(plan.deleteOverrides).toEqual([
      { weekStart: WEEK_START, day: 0, slot: 'comida', scope: 'shared' },
    ]);
    expect(plan.templateCells).toHaveLength(0);
  });

  it('a nivel de plan devuelve la celda al bloque original', () => {
    const plan = restoreCell(cell, testPlan.template, { level: 'template', weekStart: WEEK_START });

    expect(plan.templateCells).toEqual([
      { day: 0, slot: 'comida', scope: 'shared', blockId: 'comida-lun' },
    ]);
    // También quita el override, que si no seguiría tapando la restauración.
    expect(plan.deleteOverrides).toHaveLength(1);
  });

  it('una celda vacía en el original se restaura a vacía', () => {
    const domingo: CellKey = { day: 6, slot: 'comida', scope: 'shared' };
    const plan = restoreCell(domingo, testPlan.template, { level: 'template' });
    expect(plan.templateCells[0]?.blockId).toBeNull();
  });
});

describe('editar y restaurar de punta a punta', () => {
  it('restaurar devuelve exactamente lo que traía el plan', () => {
    const copia = forkBlock(original, { sections: [nuevaSeccion] }, 'copia-1');

    // 1. Se edita para toda la semana.
    const overrides: WeekOverride[] = [
      {
        weekStart: WEEK_START,
        day: 0,
        slot: 'comida',
        scope: 'shared',
        blockId: copia.id,
        isFree: false,
      },
    ];
    const editada = findSlot(
      resolveWeek({
        plan: testPlan,
        profileId: CRISTINA,
        weekStart: WEEK_START,
        blocks: [copia],
        overrides,
      }),
      0,
      'comida',
    );
    expect(editada?.source).toBe('week');
    expect(editada?.block?.sections[0]?.title).toBe('Pollo con quinoa');

    // 2. Se restaura: se borra el override.
    const restore = restoreCell(editada!.cell, testPlan.template, {
      level: 'week',
      weekStart: WEEK_START,
    });
    const quedan = overrides.filter(
      (row) =>
        !restore.deleteOverrides.some(
          (key) =>
            key.weekStart === row.weekStart &&
            key.day === row.day &&
            key.slot === row.slot &&
            key.scope === row.scope,
        ),
    );

    const restaurada = findSlot(
      resolveWeek({
        plan: testPlan,
        profileId: CRISTINA,
        weekStart: WEEK_START,
        blocks: [copia],
        overrides: quedan,
      }),
      0,
      'comida',
    );

    expect(restaurada?.source).toBe('original');
    expect(restaurada?.blockId).toBe('comida-lun');
    expect(restaurada?.block?.sections[0]?.title).toBe('Pollo con arroz');
  });

  it('restaurar a nivel de plan deshace también un cambio de plantilla', () => {
    const copia = forkBlock(original, { sections: [nuevaSeccion] }, 'copia-1');
    const templateCells: TemplateCell[] = [
      { day: 0, slot: 'comida', scope: 'shared', blockId: copia.id },
    ];

    expect(
      findSlot(
        resolveWeek({
          plan: testPlan,
          profileId: CRISTINA,
          weekStart: WEEK_START,
          blocks: [copia],
          templateCells,
        }),
        0,
        'comida',
      )?.source,
    ).toBe('template');

    const restore = restoreCell({ day: 0, slot: 'comida', scope: 'shared' }, testPlan.template, {
      level: 'template',
    });

    const restaurada = findSlot(
      resolveWeek({
        plan: testPlan,
        profileId: CRISTINA,
        weekStart: WEEK_START,
        blocks: [copia],
        templateCells: restore.templateCells,
      }),
      0,
      'comida',
    );
    expect(restaurada?.source).toBe('original');
    expect(restaurada?.blockId).toBe('comida-lun');
  });
});
