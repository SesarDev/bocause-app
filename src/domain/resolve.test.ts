import { describe, expect, it } from 'vitest';
import { ANDRES, CRISTINA, testPlan, WEEK_START } from './__fixtures__/plan';
import { findSlot, filterBlockForProfile, resolveWeek, scopeFor } from './resolve';
import type { Block, TemplateCell, WeekOverride } from './schema';

const base = { plan: testPlan, weekStart: WEEK_START };

describe('scopeFor', () => {
  it('comida y cena son del hogar; el resto, de cada persona', () => {
    expect(scopeFor('comida', CRISTINA)).toBe('shared');
    expect(scopeFor('cena', ANDRES)).toBe('shared');
    expect(scopeFor('desayuno', CRISTINA)).toBe(CRISTINA);
    expect(scopeFor('almuerzo', ANDRES)).toBe(ANDRES);
  });
});

describe('resolveWeek', () => {
  it('da siete días con las franjas de esa persona, en su orden', () => {
    const week = resolveWeek({ ...base, profileId: CRISTINA });

    expect(week.days).toHaveLength(7);
    expect(week.days[0]?.slots.map((slot) => slot.cell.slot)).toEqual([
      'desayuno',
      'snack',
      'snack2',
      'comida',
      'cena',
    ]);
    expect(
      resolveWeek({ ...base, profileId: ANDRES }).days[0]?.slots.map((s) => s.cell.slot),
    ).toEqual(['desayuno', 'almuerzo', 'comida', 'cena']);
  });

  it('fecha cada día de lunes a domingo', () => {
    const week = resolveWeek({ ...base, profileId: CRISTINA });
    expect(week.days.map((day) => day.date)).toEqual([
      '2026-09-28',
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
    ]);
  });

  it('normaliza al lunes si le pasan un día cualquiera de la semana', () => {
    const week = resolveWeek({ ...base, weekStart: '2026-10-01', profileId: CRISTINA });
    expect(week.weekStart).toBe(WEEK_START);
  });

  it('marca como "original" lo que viene del plan sin tocar', () => {
    const comida = findSlot(resolveWeek({ ...base, profileId: CRISTINA }), 0, 'comida');
    expect(comida?.source).toBe('original');
    expect(comida?.blockId).toBe('comida-lun');
    expect(comida?.isFree).toBe(false);
  });

  it('deja vacías las celdas sin bloque, como el domingo', () => {
    const domingo = findSlot(resolveWeek({ ...base, profileId: CRISTINA }), 6, 'comida');
    expect(domingo?.blockId).toBeNull();
    expect(domingo?.block).toBeNull();
  });

  it('deja vacía la franja que no tiene fila en la plantilla', () => {
    // snack2 de Cristina no está en la plantilla del fixture.
    expect(
      findSlot(resolveWeek({ ...base, profileId: CRISTINA }), 0, 'snack2')?.blockId,
    ).toBeNull();
  });

  it('falla claro si el perfil no está en el plan', () => {
    expect(() => resolveWeek({ ...base, profileId: 'nadie' })).toThrow(/no tiene el perfil/);
  });

  it('lleva el entreno de cada día del perfil', () => {
    const andres = resolveWeek({ ...base, profileId: ANDRES });
    expect(andres.days[0]?.training).toBe('Gimnasio');
    expect(andres.days[2]?.training).toBe('Running');
    expect(andres.days[1]?.training).toBeNull();
  });
});

describe('filtrado por persona en bloques compartidos', () => {
  it('cada una ve su propia ración del mismo plato', () => {
    const cristina = findSlot(resolveWeek({ ...base, profileId: CRISTINA }), 0, 'cena');
    const andres = findSlot(resolveWeek({ ...base, profileId: ANDRES }), 0, 'cena');

    const jamonC = cristina?.block?.sections[0]?.items.find((i) => i.id === 'cena-lun-jamon');
    const jamonA = andres?.block?.sections[0]?.items.find((i) => i.id === 'cena-lun-jamon');

    expect(jamonC?.portions[CRISTINA]?.rawG).toBe(60);
    expect(jamonA?.portions[ANDRES]?.rawG).toBe(30);
  });

  it('el pan de la comida solo lo ve quien lo tiene', () => {
    const cristina = findSlot(resolveWeek({ ...base, profileId: CRISTINA }), 0, 'comida');
    const andres = findSlot(resolveWeek({ ...base, profileId: ANDRES }), 0, 'comida');

    expect(cristina?.block?.sections.map((s) => s.kind)).toEqual(['plato', 'pan', 'postre']);
    // Andrés no tiene pan ese día: la sección entera desaparece de su vista.
    expect(andres?.block?.sections.map((s) => s.kind)).toEqual(['plato', 'postre']);
  });

  it('filterBlockForProfile devuelve null si no le queda nada a esa persona', () => {
    const soloCristina: Block = {
      id: 'x',
      planId: 'test',
      slot: 'comida',
      scope: 'shared',
      isOriginal: true,
      sections: [
        {
          id: 's',
          kind: 'plato',
          items: [{ id: 'i', label: 'Algo', portions: { [CRISTINA]: { rawG: 10 } } }],
        },
      ],
    };
    expect(filterBlockForProfile(soloCristina, CRISTINA)).not.toBeNull();
    expect(filterBlockForProfile(soloCristina, ANDRES)).toBeNull();
  });

  it('no muta el bloque original al filtrar', () => {
    const original = testPlan.blocks.find((block) => block.id === 'comida-lun');
    const antes = JSON.stringify(original);
    resolveWeek({ ...base, profileId: ANDRES });
    expect(JSON.stringify(original)).toBe(antes);
  });
});

describe('capas de resolución', () => {
  const otroBloque: Block = {
    id: 'comida-alternativa',
    planId: 'test',
    slot: 'comida',
    scope: 'shared',
    isOriginal: false,
    originBlockId: 'comida-lun',
    sections: [
      {
        id: 'alt-s1',
        kind: 'plato',
        title: 'Lentejas',
        items: [
          {
            id: 'alt-lentejas',
            label: 'Lentejas',
            portions: { [CRISTINA]: { rawG: 70 }, [ANDRES]: { rawG: 90 } },
          },
        ],
      },
    ],
  };

  it('un cambio de plantilla gana al original y se marca como "template"', () => {
    const templateCells: TemplateCell[] = [
      { day: 0, slot: 'comida', scope: 'shared', blockId: 'comida-alternativa' },
    ];
    const comida = findSlot(
      resolveWeek({ ...base, profileId: CRISTINA, blocks: [otroBloque], templateCells }),
      0,
      'comida',
    );

    expect(comida?.source).toBe('template');
    expect(comida?.blockId).toBe('comida-alternativa');
    expect(comida?.block?.sections[0]?.title).toBe('Lentejas');
  });

  it('una fila de plantilla igual al original se sigue considerando original', () => {
    const templateCells: TemplateCell[] = [
      { day: 0, slot: 'comida', scope: 'shared', blockId: 'comida-lun' },
    ];
    expect(
      findSlot(resolveWeek({ ...base, profileId: CRISTINA, templateCells }), 0, 'comida')?.source,
    ).toBe('original');
  });

  it('el override de la semana gana a la plantilla', () => {
    const templateCells: TemplateCell[] = [
      { day: 0, slot: 'comida', scope: 'shared', blockId: 'comida-alternativa' },
    ];
    const overrides: WeekOverride[] = [
      {
        weekStart: WEEK_START,
        day: 0,
        slot: 'comida',
        scope: 'shared',
        blockId: 'comida-mar',
        isFree: false,
      },
    ];

    const comida = findSlot(
      resolveWeek({ ...base, profileId: CRISTINA, blocks: [otroBloque], templateCells, overrides }),
      0,
      'comida',
    );

    expect(comida?.source).toBe('week');
    expect(comida?.blockId).toBe('comida-mar');
  });

  it('el override de otra semana no afecta a esta', () => {
    const overrides: WeekOverride[] = [
      {
        weekStart: '2026-10-05',
        day: 0,
        slot: 'comida',
        scope: 'shared',
        blockId: null,
        isFree: true,
      },
    ];
    const comida = findSlot(resolveWeek({ ...base, profileId: CRISTINA, overrides }), 0, 'comida');

    expect(comida?.source).toBe('original');
    expect(comida?.blockId).toBe('comida-lun');
    expect(comida?.isFree).toBe(false);
  });

  it('un override puede vaciar la celda y marcarla como ingesta libre', () => {
    const overrides: WeekOverride[] = [
      { weekStart: WEEK_START, day: 0, slot: 'cena', scope: 'shared', blockId: null, isFree: true },
    ];
    const cena = findSlot(resolveWeek({ ...base, profileId: ANDRES, overrides }), 0, 'cena');

    expect(cena?.blockId).toBeNull();
    expect(cena?.block).toBeNull();
    expect(cena?.isFree).toBe(true);
  });

  it('un bloque editado pisa al del plan cuando comparten id', () => {
    const editado: Block = {
      ...(testPlan.blocks.find((block) => block.id === 'comida-lun') as Block),
      sections: [
        {
          id: 'editada',
          kind: 'plato',
          title: 'Pollo con quinoa',
          items: [{ id: 'quinoa', label: 'Quinoa', portions: { [CRISTINA]: { rawG: 60 } } }],
        },
      ],
    };

    const comida = findSlot(
      resolveWeek({ ...base, profileId: CRISTINA, blocks: [editado] }),
      0,
      'comida',
    );
    expect(comida?.block?.sections[0]?.title).toBe('Pollo con quinoa');
  });
});

describe('alcance de los cambios compartidos e individuales', () => {
  it('un cambio en una celda compartida se ve en los dos perfiles', () => {
    const overrides: WeekOverride[] = [
      {
        weekStart: WEEK_START,
        day: 0,
        slot: 'comida',
        scope: 'shared',
        blockId: 'comida-mar',
        isFree: false,
      },
    ];

    expect(
      findSlot(resolveWeek({ ...base, profileId: CRISTINA, overrides }), 0, 'comida')?.blockId,
    ).toBe('comida-mar');
    expect(
      findSlot(resolveWeek({ ...base, profileId: ANDRES, overrides }), 0, 'comida')?.blockId,
    ).toBe('comida-mar');
  });

  it('un cambio en el desayuno de Cristina no toca el de Andrés', () => {
    const overrides: WeekOverride[] = [
      {
        weekStart: WEEK_START,
        day: 0,
        slot: 'desayuno',
        scope: CRISTINA,
        blockId: null,
        isFree: false,
      },
    ];

    expect(
      findSlot(resolveWeek({ ...base, profileId: CRISTINA, overrides }), 0, 'desayuno')?.blockId,
    ).toBeNull();
    expect(
      findSlot(resolveWeek({ ...base, profileId: ANDRES, overrides }), 0, 'desayuno')?.blockId,
    ).toBe('des-a');
  });
});
