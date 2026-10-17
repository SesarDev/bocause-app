import { describe, expect, it } from 'vitest';
import { equivalentsFor, instantiate, scalePortion, toLibraryBlock } from './library';
import type { Block, EquivalenceGroup, LibraryBlock } from './schema';

const bloqueBiblioteca: LibraryBlock = {
  id: 'lib-1',
  name: 'Pollo al horno con verduras',
  slots: ['comida'],
  tags: ['horno'],
  archived: false,
  sections: [
    {
      id: 'sec-1',
      kind: 'plato',
      title: 'Pollo al horno',
      items: [
        { id: 'i1', foodKey: 'pollo', label: 'Pechuga de pollo', base: { rawG: 100 } },
        { id: 'i2', foodKey: 'calabacin', label: 'Calabacín', base: { rawG: 150 } },
      ],
    },
  ],
};

describe('scalePortion', () => {
  it('no toca nada con multiplicador 1', () => {
    expect(scalePortion({ rawG: 100 }, 1).portion).toEqual({ rawG: 100 });
  });

  it('redondea los gramos a múltiplos de 5, que es lo que se puede pesar', () => {
    // 85 × 1,25 = 106,25, que en una báscula de cocina no existe.
    expect(scalePortion({ rawG: 85 }, 1.25).portion.rawG).toBe(105);
    expect(scalePortion({ cookedG: 140 }, 0.75).portion.cookedG).toBe(105);
    expect(scalePortion({ ml: 200 }, 1.5).portion.ml).toBe(300);
  });

  it('redondea las unidades a medias', () => {
    // 1 × 1,25 = 1,25 → 1,5. Media manzana se entiende; un cuarto, ya no tanto.
    expect(scalePortion({ units: 1 }, 1.25).portion.units).toBe(1.5);
    expect(scalePortion({ units: 2 }, 0.75).portion.units).toBe(1.5);
  });

  it('nunca deja una cantidad en cero', () => {
    // 2 g × 0,2 = 0,4: redondeado a múltiplos de 5 sería 0, o sea "no comas nada".
    expect(scalePortion({ rawG: 2 }, 0.2).portion.rawG).toBe(0.4);
    expect(scalePortion({ units: 1 }, 0.1).portion.units).toBe(0.5);
  });

  it('conserva la medida casera tal cual y avisa de que hay que repasarla', () => {
    const escalado = scalePortion({ rawG: 100, measure: '1/3 de bandeja' }, 1.5);
    expect(escalado.portion.measure).toBe('1/3 de bandeja');
    expect(escalado.portion.rawG).toBe(150);
    expect(escalado.needsReview).toBe(true);
  });

  it('no avisa si el multiplicador es 1: la medida sigue siendo buena', () => {
    expect(scalePortion({ measure: '2 rebanadas' }, 1).needsReview).toBe(false);
  });

  it('rechaza multiplicadores que no tienen sentido', () => {
    expect(() => scalePortion({ rawG: 100 }, 0)).toThrow();
    expect(() => scalePortion({ rawG: 100 }, -1)).toThrow();
  });
});

describe('instantiate', () => {
  it('reparte la ración base entre los comensales', () => {
    const { sections } = instantiate(bloqueBiblioteca, [
      { profileId: 'cristina', multiplier: 1 },
      { profileId: 'andres', multiplier: 1.5 },
    ]);

    expect(sections[0]!.items[0]!.portions['cristina']).toEqual({ rawG: 100 });
    expect(sections[0]!.items[0]!.portions['andres']).toEqual({ rawG: 150 });
    expect(sections[0]!.items[1]!.portions['andres']).toEqual({ rawG: 225 });
  });

  it('conserva título, tipo de sección y notas', () => {
    const { sections } = instantiate(bloqueBiblioteca, [{ profileId: 'c', multiplier: 1 }]);
    expect(sections[0]!.title).toBe('Pollo al horno');
    expect(sections[0]!.kind).toBe('plato');
    expect(sections[0]!.items[0]!.foodKey).toBe('pollo');
  });

  it('señala los alimentos cuya medida casera hay que repasar', () => {
    const conMedida: LibraryBlock = {
      ...bloqueBiblioteca,
      sections: [
        {
          id: 's',
          kind: 'plato',
          items: [
            { id: 'con', label: 'Pan', base: { rawG: 40, measure: '2 rebanadas' } },
            { id: 'sin', label: 'Pollo', base: { rawG: 100 } },
          ],
        },
      ],
    };

    const { needsReview } = instantiate(conMedida, [{ profileId: 'a', multiplier: 1.5 }]);
    expect(needsReview).toEqual(['con']);
  });

  it('no repite un alimento en la lista de repaso aunque sean varios comensales', () => {
    const conMedida: LibraryBlock = {
      ...bloqueBiblioteca,
      sections: [
        { id: 's', kind: 'plato', items: [{ id: 'x', label: 'Pan', base: { measure: '2 reb' } }] },
      ],
    };

    const { needsReview } = instantiate(conMedida, [
      { profileId: 'a', multiplier: 1.5 },
      { profileId: 'b', multiplier: 0.75 },
    ]);
    expect(needsReview).toEqual(['x']);
  });
});

describe('toLibraryBlock', () => {
  const bloque: Block = {
    id: 'b1',
    planId: '2026-09',
    slot: 'cena',
    scope: 'shared',
    isOriginal: true,
    sections: [
      {
        id: 's1',
        kind: 'plato',
        title: 'Dorada al horno',
        items: [
          {
            id: 'i1',
            label: 'Dorada',
            portions: { cristina: { rawG: 150 }, andres: { rawG: 200 } },
          },
          { id: 'i2', label: 'Pan', portions: { andres: { rawG: 40 } } },
        ],
      },
      { id: 's2', kind: 'postre', items: [{ id: 'i3', label: 'Pera', portions: {} }] },
    ],
  };

  const newId = (prefix: string) => `${prefix}-nuevo`;

  it('usa la ración de la persona elegida como base', () => {
    const lib = toLibraryBlock(bloque, 'cristina', 'Dorada al horno', newId);
    expect(lib.sections[0]!.items[0]!.base).toEqual({ rawG: 150 });
  });

  it('deja fuera lo que esa persona no come', () => {
    // El pan solo lo toma Andrés: metido con ración vacía aparecería luego sin cantidad.
    const lib = toLibraryBlock(bloque, 'cristina', 'Dorada', newId);
    expect(lib.sections[0]!.items.map((item) => item.label)).toEqual(['Dorada']);
  });

  it('descarta las secciones que se quedan sin nada', () => {
    const lib = toLibraryBlock(bloque, 'cristina', 'Dorada', newId);
    expect(lib.sections).toHaveLength(1);
  });

  it('recuerda en qué franja se usaba', () => {
    expect(toLibraryBlock(bloque, 'andres', 'Dorada', newId).slots).toEqual(['cena']);
  });
});

describe('equivalentsFor', () => {
  const grupos: EquivalenceGroup[] = [
    {
      id: 'g1',
      name: 'Legumbres',
      archived: false,
      members: [
        { foodKey: 'lentejas', factor: 1 },
        { foodKey: 'garbanzos', factor: 1 },
        { foodKey: 'soja-texturizada', factor: 0.5, note: 'Pesa en seco' },
      ],
    },
    {
      id: 'g2',
      name: 'Archivado',
      archived: true,
      members: [
        { foodKey: 'lentejas', factor: 1 },
        { foodKey: 'quinoa', factor: 1 },
      ],
    },
  ];

  it('ofrece los demás del grupo, nunca el de partida', () => {
    const opciones = equivalentsFor('lentejas', { rawG: 140 }, grupos);
    expect(opciones.map((o) => o.foodKey)).toEqual(['garbanzos', 'soja-texturizada']);
  });

  it('a igual factor, misma cantidad', () => {
    const [garbanzos] = equivalentsFor('lentejas', { rawG: 140 }, grupos);
    expect(garbanzos!.portion).toEqual({ rawG: 140 });
  });

  it('aplica el factor: si uno cunde el doble, hace falta la mitad', () => {
    const soja = equivalentsFor('lentejas', { rawG: 140 }, grupos).find(
      (o) => o.foodKey === 'soja-texturizada',
    );
    expect(soja!.portion).toEqual({ rawG: 280 });
  });

  it('va en los dos sentidos', () => {
    const lentejas = equivalentsFor('soja-texturizada', { rawG: 70 }, grupos).find(
      (o) => o.foodKey === 'lentejas',
    );
    expect(lentejas!.portion).toEqual({ rawG: 35 });
  });

  it('descarta la medida casera, que no significa nada en otro alimento', () => {
    const [garbanzos] = equivalentsFor('lentejas', { rawG: 140, measure: '1 vaso' }, grupos);
    expect(garbanzos!.portion.measure).toBeUndefined();
  });

  it('ignora los grupos archivados', () => {
    const opciones = equivalentsFor('lentejas', { rawG: 140 }, grupos);
    expect(opciones.map((o) => o.foodKey)).not.toContain('quinoa');
  });

  it('no ofrece nada para un alimento sin clave de catálogo', () => {
    expect(equivalentsFor(undefined, { rawG: 100 }, grupos)).toEqual([]);
  });

  it('no ofrece nada si el alimento no está en ningún grupo', () => {
    expect(equivalentsFor('pollo', { rawG: 100 }, grupos)).toEqual([]);
  });

  it('dice de qué grupo sale y con qué nota', () => {
    const soja = equivalentsFor('lentejas', { rawG: 140 }, grupos).find(
      (o) => o.foodKey === 'soja-texturizada',
    );
    expect(soja!.groupName).toBe('Legumbres');
    expect(soja!.note).toBe('Pesa en seco');
  });
});
