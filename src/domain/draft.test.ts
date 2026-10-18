import { describe, expect, it } from 'vitest';
import { blankPlan, duplicatePlan, pruneUnusedBlocks, unusedBlockCount } from './draft';
import type { Block, Plan, TemplateCell } from './schema';

function bloque(id: string, origen?: string): Block {
  return {
    id,
    planId: 'p',
    slot: 'comida',
    scope: 'shared',
    isOriginal: origen === undefined,
    ...(origen !== undefined ? { originBlockId: origen } : {}),
    sections: [{ id: `${id}-s`, kind: 'plato', items: [] }],
  };
}

function plan(blocks: Block[], template: TemplateCell[]): Plan {
  return {
    id: 'p',
    name: 'p',
    issuedOn: '2026-10-01',
    validFrom: '2026-10-05',
    profiles: [],
    blocks,
    template,
    recipes: [],
    foods: [],
    rules: {
      aoveSpoonsPerWeek: 14,
      freeMealsPerWeek: 2,
      waterLitersPerDay: '2-3',
      recommendations: [],
    },
  } as unknown as Plan;
}

const celda = (day: number, blockId: string | null): TemplateCell => ({
  day,
  slot: 'comida',
  scope: 'shared',
  blockId,
});

describe('pruneUnusedBlocks', () => {
  it('quita los bloques a los que no apunta ninguna celda', () => {
    // Lo que pasa al cambiar una celda varias veces: quedan los descartes.
    const resultado = pruneUnusedBlocks(
      plan([bloque('usado'), bloque('descarte-1'), bloque('descarte-2')], [celda(0, 'usado')]),
    );

    expect(resultado.blocks.map((block) => block.id)).toEqual(['usado']);
  });

  it('conserva el original del que desciende un bloque en uso', () => {
    // Es el destino de "Restaurar original": borrarlo dejaría esa vuelta sin a dónde ir.
    const resultado = pruneUnusedBlocks(
      plan([bloque('original'), bloque('copia', 'original')], [celda(0, 'copia')]),
    );

    expect(resultado.blocks.map((block) => block.id).sort()).toEqual(['copia', 'original']);
  });

  it('no se lleva nada si todo está en uso', () => {
    const entrada = plan([bloque('a'), bloque('b')], [celda(0, 'a'), celda(1, 'b')]);
    expect(pruneUnusedBlocks(entrada).blocks).toHaveLength(2);
  });

  it('devuelve el mismo objeto cuando no sobra nada', () => {
    // Para que comparar por identidad no diga que hubo cambios donde no los hubo.
    const entrada = plan([bloque('a')], [celda(0, 'a')]);
    expect(pruneUnusedBlocks(entrada)).toBe(entrada);
  });

  it('aguanta celdas vacías', () => {
    const resultado = pruneUnusedBlocks(plan([bloque('a')], [celda(0, null)]));
    expect(resultado.blocks).toEqual([]);
  });

  it('no toca la plantilla', () => {
    const template = [celda(0, 'a'), celda(1, null)];
    const resultado = pruneUnusedBlocks(plan([bloque('a'), bloque('sobra')], template));
    expect(resultado.template).toEqual(template);
  });
});

describe('unusedBlockCount', () => {
  it('cuenta lo que sobra sin tocar el plan', () => {
    const entrada = plan([bloque('usado'), bloque('x'), bloque('y')], [celda(0, 'usado')]);
    expect(unusedBlockCount(entrada)).toBe(2);
    expect(entrada.blocks).toHaveLength(3);
  });

  it('es cero cuando está todo limpio', () => {
    expect(unusedBlockCount(plan([bloque('a')], [celda(0, 'a')]))).toBe(0);
  });
});

/* ─────────────────────── Empezar una dieta ─────────────────────── */

describe('blankPlan', () => {
  const gente = [
    { profileId: 'cristina', displayName: 'Cristina' },
    { profileId: 'andres', displayName: 'Andrés' },
  ];

  const vacia = () =>
    blankPlan({
      id: 'nueva',
      name: 'Noviembre 2026',
      issuedOn: '2026-10-18',
      validFrom: '2026-11-02',
      people: gente,
    });

  it('nace sin una sola comida', () => {
    const nueva = vacia();
    expect(nueva.blocks).toEqual([]);
    expect(nueva.template).toEqual([]);
    expect(nueva.recipes).toEqual([]);
  });

  it('da a cada persona las tres comidas del día, y nada más', () => {
    expect(vacia().profiles.map((perfil) => perfil.slots)).toEqual([
      ['desayuno', 'comida', 'cena'],
      ['desayuno', 'comida', 'cena'],
    ]);
  });

  it('reserva los siete días de entreno, aunque estén vacíos', () => {
    // `training` mide 7 por esquema: con menos, el plan no valida al guardar el borrador.
    expect(vacia().profiles[0]!.training).toEqual([null, null, null, null, null, null, null]);
  });

  it('trae las reglas del plan por defecto', () => {
    expect(vacia().rules.aoveMaxSpoonsPerWeek).toBe(14);
    expect(vacia().rules.freeMealsPerWeek).toBe(2);
  });

  it('se queda el catálogo que se le pase', () => {
    // `plan.foods` agrupa la lista de la compra y autocompleta el editor: una dieta nueva
    // sin catálogo nacería con las dos cosas peor que la anterior.
    const foods = [{ key: 'pera', name: 'Pera', section: 'fruta', batchable: false }] as never;
    const conCatalogo = blankPlan({
      id: 'nueva',
      name: 'Noviembre 2026',
      issuedOn: '2026-10-18',
      validFrom: '2026-11-02',
      people: gente,
      foods,
    });
    expect(conCatalogo.foods).toHaveLength(1);
  });
});

describe('duplicatePlan', () => {
  const origen: Plan = {
    ...plan(
      [
        {
          id: 'b-cena',
          planId: 'viejo',
          slot: 'cena',
          scope: 'shared',
          isOriginal: true,
          sections: [
            {
              id: 's1',
              kind: 'plato',
              items: [
                {
                  id: 'i1',
                  label: 'Dorada',
                  portions: { ana: { rawG: 150 }, luis: { rawG: 200 } },
                },
                { id: 'i2', label: 'Pan', portions: { luis: { rawG: 40 } } },
              ],
            },
          ],
        },
        {
          id: 'b-desayuno',
          planId: 'viejo',
          slot: 'desayuno',
          scope: 'luis',
          isOriginal: true,
          sections: [
            {
              id: 's2',
              kind: 'plato',
              items: [{ id: 'i3', label: 'Avena', portions: { luis: { rawG: 60 } } }],
            },
          ],
        },
      ],
      [
        { day: 0, slot: 'cena', scope: 'shared', blockId: 'b-cena' },
        { day: 0, slot: 'desayuno', scope: 'luis', blockId: 'b-desayuno' },
      ],
    ),
    profiles: [
      {
        profileId: 'ana',
        displayName: 'Ana',
        slots: ['cena'],
        training: [null, null, null, null, null, null, null],
        supplements: [],
        comodin: [],
      },
      {
        profileId: 'luis',
        displayName: 'Luis',
        slots: ['desayuno', 'cena'],
        training: [null, null, null, null, null, null, null],
        supplements: [],
        comodin: [],
      },
    ],
  };

  let contador = 0;
  const copiar = (mapping: Record<string, string | null>) =>
    duplicatePlan(origen, {
      id: 'nuevo',
      name: 'Copia',
      issuedOn: '2026-10-18',
      mapping,
      people: [
        { profileId: 'cristina', displayName: 'Cristina' },
        { profileId: 'andres', displayName: 'Andrés' },
      ],
      newId: () => `nuevo-${++contador}`,
    });

  it('cambia de dueño los perfiles, los bloques y las celdas', () => {
    const copia = copiar({ ana: 'cristina', luis: 'andres' });

    expect(copia.profiles.map((p) => [p.profileId, p.displayName])).toEqual([
      ['cristina', 'Cristina'],
      ['andres', 'Andrés'],
    ]);
    expect(copia.template.find((cell) => cell.slot === 'desayuno')?.scope).toBe('andres');
    expect(copia.blocks.find((b) => b.slot === 'cena')?.sections[0]!.items[0]!.portions).toEqual({
      cristina: { rawG: 150 },
      andres: { rawG: 200 },
    });
  });

  it('renueva los ids de bloque y los enlaza desde la plantilla', () => {
    const copia = copiar({ ana: 'cristina', luis: 'andres' });
    const ids = copia.blocks.map((block) => block.id);

    expect(ids).not.toContain('b-cena');
    expect(
      copia.template
        .map((cell) => cell.blockId)
        .filter(Boolean)
        .sort(),
    ).toEqual(ids.sort());
    expect(copia.blocks.every((block) => block.planId === 'nuevo')).toBe(true);
  });

  it('deja fuera a quien no viaja, con su franja y su ración', () => {
    // El hogar de destino tiene una sola persona: la comida de la otra no es de nadie.
    const copia = copiar({ ana: 'cristina', luis: null });

    expect(copia.profiles.map((p) => p.profileId)).toEqual(['cristina']);
    expect(copia.template.some((cell) => cell.slot === 'desayuno')).toBe(false);
    expect(copia.blocks).toHaveLength(1);

    const items = copia.blocks[0]!.sections[0]!.items;
    expect(items.map((item) => item.label)).toEqual(['Dorada']);
    expect(items[0]!.portions).toEqual({ cristina: { rawG: 150 } });
  });

  it('no toca el plan de partida', () => {
    copiar({ ana: 'cristina', luis: 'andres' });
    expect(origen.blocks[0]!.id).toBe('b-cena');
    expect(origen.profiles[0]!.profileId).toBe('ana');
  });
});
