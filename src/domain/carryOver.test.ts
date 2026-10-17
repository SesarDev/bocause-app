/**
 * Arrastre de los cambios del cliente al publicar una dieta nueva.
 *
 * Es lo más delicado del proyecto, así que las pruebas van por casos concretos y no por
 * mecánica: lo que se comprueba es qué ve la persona el lunes siguiente.
 */
import { describe, expect, it } from 'vitest';
import { blockFingerprint, carryOver } from './carryOver';
import { cellId } from './resolve';
import type { Block, Plan, TemplateCell, WeekOverride } from './schema';

/* ───────────────────────── Utilidades del escenario ───────────────────────── */

let contador = 0;
const newId = () => `nuevo-${++contador}`;

function bloque(id: string, planId: string, titulo: string, gramos: number): Block {
  return {
    id,
    planId,
    slot: 'comida',
    scope: 'shared',
    isOriginal: true,
    sections: [
      {
        id: `${id}-s`,
        kind: 'plato',
        title: titulo,
        items: [{ id: `${id}-i`, label: titulo, portions: { cristina: { rawG: gramos } } }],
      },
    ],
  };
}

function plan(id: string, bloques: Block[], template: TemplateCell[]): Plan {
  return {
    id,
    name: id,
    issuedOn: '2026-10-01',
    validFrom: '2026-10-05',
    profiles: [],
    blocks: bloques,
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

/** Dieta anterior: lunes lentejas, martes pollo. */
const lentejasViejo = bloque('v-lentejas', 'v1', 'Lentejas', 140);
const polloViejo = bloque('v-pollo', 'v1', 'Pollo', 150);
const prevPlan = plan(
  'v1',
  [lentejasViejo, polloViejo],
  [celda(0, 'v-lentejas'), celda(1, 'v-pollo')],
);

/** Dieta nueva: el lunes sigue siendo lentejas (mismo contenido, otro id); el martes cambia. */
const lentejasNuevo = bloque('n-lentejas', 'v2', 'Lentejas', 140);
const polloNuevo = bloque('n-pollo', 'v2', 'Pollo', 150);
const merluzaNueva = bloque('n-merluza', 'v2', 'Merluza', 200);

function base(overrides: Partial<Parameters<typeof carryOver>[0]> = {}) {
  return carryOver({
    prevPlan,
    prevEditedBlocks: [],
    prevTemplateCells: [celda(0, 'v-lentejas'), celda(1, 'v-pollo')],
    prevOverrides: [],
    nextPlan: plan(
      'v2',
      [lentejasNuevo, polloNuevo, merluzaNueva],
      [celda(0, 'n-lentejas'), celda(1, 'n-merluza')],
    ),
    validFrom: '2026-10-19',
    newId,
    ...overrides,
  });
}

/* ───────────────────────── Pruebas ───────────────────────── */

describe('blockFingerprint', () => {
  it('dos bloques con el mismo contenido son el mismo plato aunque cambie el id', () => {
    expect(blockFingerprint(lentejasViejo)).toBe(blockFingerprint(lentejasNuevo));
  });

  it('distingue si cambia una cantidad', () => {
    expect(blockFingerprint(lentejasViejo)).not.toBe(
      blockFingerprint(bloque('x', 'v2', 'Lentejas', 200)),
    );
  });

  it('una celda vacía tiene su propia huella', () => {
    expect(blockFingerprint(null)).toBe('(vacío)');
  });
});

describe('carryOver · sin cambios del cliente', () => {
  it('no escribe nada: la dieta nueva manda tal cual', () => {
    const resultado = base();
    expect(resultado.cells).toEqual([]);
    expect(resultado.blocks).toEqual([]);
    expect(resultado.conflicts).toEqual([]);
  });
});

describe('carryOver · el cliente cambió una celda que ella NO ha tocado', () => {
  it('conserva el cambio del cliente', () => {
    // El cliente puso el pollo también el lunes. El lunes no lo toca la dieta nueva.
    const resultado = base({
      prevTemplateCells: [celda(0, 'v-pollo'), celda(1, 'v-pollo')],
    });

    const lunes = resultado.cells.find((cell) => cell.day === 0);
    expect(lunes?.blockId).toBe('n-pollo'); // el mismo plato, ya con el id de la dieta nueva
    expect(resultado.conflicts).toEqual([]);
  });

  it('copia el bloque que el cliente había editado, con id nuevo', () => {
    const editado: Block = {
      ...lentejasViejo,
      id: 'v-lentejas-editado',
      isOriginal: false,
      originBlockId: 'v-lentejas',
      sections: [
        {
          id: 's',
          kind: 'plato',
          title: 'Lentejas',
          items: [{ id: 'i', label: 'Lentejas', portions: { cristina: { rawG: 180 } } }],
        },
      ],
    };

    const resultado = base({
      prevEditedBlocks: [editado],
      prevTemplateCells: [celda(0, 'v-lentejas-editado'), celda(1, 'v-pollo')],
    });

    expect(resultado.blocks).toHaveLength(1);
    const copia = resultado.blocks[0]!;
    expect(copia.id).not.toBe('v-lentejas-editado');
    expect(copia.planId).toBe('v2');
    expect(copia.sections[0]!.items[0]!.portions['cristina']).toEqual({ rawG: 180 });
    expect(resultado.cells.find((cell) => cell.day === 0)?.blockId).toBe(copia.id);
  });

  it('el bloque copiado apunta al original de la dieta NUEVA, para poder restaurar', () => {
    const editado: Block = {
      ...lentejasViejo,
      id: 'editado',
      isOriginal: false,
      originBlockId: 'v-lentejas',
    };

    const resultado = base({
      prevEditedBlocks: [editado],
      prevTemplateCells: [celda(0, 'editado'), celda(1, 'v-pollo')],
    });

    expect(resultado.blocks[0]!.originBlockId).toBe('n-lentejas');
  });

  it('no duplica un bloque usado en dos celdas', () => {
    const editado: Block = { ...lentejasViejo, id: 'editado', isOriginal: false };

    const resultado = base({
      prevEditedBlocks: [editado],
      prevTemplateCells: [celda(0, 'editado'), celda(1, 'editado')],
      nextPlan: plan(
        'v2',
        [lentejasNuevo, polloNuevo],
        [celda(0, 'n-lentejas'), celda(1, 'n-pollo')],
      ),
    });

    expect(resultado.blocks).toHaveLength(1);
    expect(new Set(resultado.cells.map((cell) => cell.blockId)).size).toBe(1);
  });
});

describe('carryOver · los dos cambiaron la misma celda', () => {
  const dosCambios = (keepClient?: Set<string>) =>
    base({
      // El cliente había puesto lentejas el martes; ella publica merluza ese día.
      prevTemplateCells: [celda(0, 'v-lentejas'), celda(1, 'v-lentejas')],
      ...(keepClient ? { keepClient } : {}),
    });

  it('lo marca como conflicto', () => {
    const resultado = dosCambios();
    expect(resultado.conflicts).toHaveLength(1);
    expect(resultado.conflicts[0]!.cell.day).toBe(1);
    expect(resultado.conflicts[0]!.nextBlockId).toBe('n-merluza');
  });

  it('por defecto gana la nutricionista: no se escribe la celda del cliente', () => {
    const resultado = dosCambios();
    expect(resultado.cells.find((cell) => cell.day === 1)).toBeUndefined();
  });

  it('si se decide mantener el cambio del cliente, se escribe el suyo', () => {
    const clave = cellId({ day: 1, slot: 'comida', scope: 'shared' });
    const resultado = dosCambios(new Set([clave]));
    expect(resultado.cells.find((cell) => cell.day === 1)?.blockId).toBe('n-lentejas');
  });
});

describe('carryOver · el plato del cliente ya no existe', () => {
  // El cliente tenía el pollo el lunes, y la dieta nueva no trae pollo por ningún lado.
  const sinPollo = () =>
    base({
      prevTemplateCells: [celda(0, 'v-pollo'), celda(1, 'v-pollo')],
      nextPlan: plan(
        'v2',
        [lentejasNuevo, merluzaNueva],
        [celda(0, 'n-lentejas'), celda(1, 'n-merluza')],
      ),
    });

  it('no arrastra nada', () => {
    expect(sinPollo().cells.find((cell) => cell.day === 0)).toBeUndefined();
  });

  it('lo avisa como conflicto aunque ella NO haya tocado esa celda', () => {
    // Sin esto, el plato que él se había puesto desaparecería en silencio.
    const lunes = sinPollo().conflicts.find((conflict) => conflict.cell.day === 0);
    expect(lunes).toBeDefined();
    expect(lunes!.orphan).toBe(true);
    expect(lunes!.clientBlockId).toBe('v-pollo');
  });

  it('tampoco arrastra sus overrides', () => {
    const resultado = base({
      prevTemplateCells: [celda(0, 'v-pollo'), celda(1, 'v-pollo')],
      prevOverrides: [
        {
          weekStart: '2026-10-26',
          day: 3,
          slot: 'comida',
          scope: 'shared',
          blockId: 'v-pollo',
          isFree: false,
        },
      ],
      nextPlan: plan(
        'v2',
        [lentejasNuevo, merluzaNueva],
        [celda(0, 'n-lentejas'), celda(1, 'n-merluza')],
      ),
    });
    expect(resultado.overrides).toEqual([]);
  });
});

describe('carryOver · celdas vaciadas', () => {
  it('se conserva que el cliente dejó una celda vacía', () => {
    // Vaciar una celda es una decisión, no la ausencia de una decisión: si se confunde con
    // "no hay fila", la publicación se la vuelve a llenar sin que nadie se entere.
    const resultado = base({ prevTemplateCells: [celda(0, null), celda(1, 'v-pollo')] });
    expect(resultado.cells.find((cell) => cell.day === 0)?.blockId).toBeNull();
  });

  it('vaciar una celda que ella cambia también es conflicto', () => {
    const resultado = base({ prevTemplateCells: [celda(0, 'v-lentejas'), celda(1, null)] });
    expect(resultado.conflicts.map((conflict) => conflict.cell.day)).toEqual([1]);
    expect(resultado.conflicts[0]!.clientBlockId).toBeNull();
  });

  it('si ella vacía una celda y el cliente no la había tocado, se queda vacía', () => {
    const resultado = base({
      nextPlan: plan('v2', [lentejasNuevo, polloNuevo], [celda(0, 'n-lentejas'), celda(1, null)]),
    });
    expect(resultado.cells).toEqual([]);
    expect(resultado.conflicts).toEqual([]);
  });
});

describe('carryOver · overrides de semana', () => {
  const override = (weekStart: string, day: number, blockId: string | null): WeekOverride => ({
    weekStart,
    day,
    slot: 'comida',
    scope: 'shared',
    blockId,
    isFree: false,
  });

  it('arrastra los de semanas que empiezan en validFrom o después', () => {
    const resultado = base({ prevOverrides: [override('2026-10-26', 0, 'v-pollo')] });
    expect(resultado.overrides).toHaveLength(1);
    expect(resultado.overrides[0]!.blockId).toBe('n-pollo');
  });

  it('NO toca las semanas anteriores: reescribiría el pasado', () => {
    const resultado = base({ prevOverrides: [override('2026-10-12', 0, 'v-pollo')] });
    expect(resultado.overrides).toEqual([]);
  });

  it('incluye la propia semana de validFrom', () => {
    const resultado = base({ prevOverrides: [override('2026-10-19', 0, 'v-pollo')] });
    expect(resultado.overrides).toHaveLength(1);
  });

  it('descarta el override de una celda que gana ella: taparía su cambio', () => {
    const resultado = base({
      prevTemplateCells: [celda(0, 'v-lentejas'), celda(1, 'v-lentejas')],
      prevOverrides: [override('2026-10-26', 1, 'v-lentejas')],
    });
    expect(resultado.overrides).toEqual([]);
  });

  it('conserva la ingesta libre marcada', () => {
    const libre = { ...override('2026-10-26', 0, null), isFree: true };
    const resultado = base({ prevOverrides: [libre] });
    expect(resultado.overrides[0]!.isFree).toBe(true);
  });
});
