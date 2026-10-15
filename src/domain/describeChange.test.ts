import { describe, expect, it } from 'vitest';
import { actorLabel, describeChanges, type ChangeEntry } from './describeChange';

const TITULOS: Record<string, string> = {
  'bloque-lentejas': 'Lentejas con verduras',
  'bloque-pollo': 'Pollo al horno',
  'bloque-pasta': 'Pasta con boloñesa',
};

const lookup = (id: string | null) => (id === null ? null : (TITULOS[id] ?? null));

function entrada(partial: Partial<ChangeEntry> = {}): ChangeEntry {
  return {
    id: 'e1',
    txId: 'tx1',
    createdAt: '2026-10-15T10:00:00Z',
    actorRole: 'cliente',
    actorName: 'Andrés',
    table: 'week_overrides',
    op: 'UPDATE',
    cell: { day: 1, slot: 'comida', scope: 'shared', weekStart: '2026-10-12' },
    beforeBlockId: 'bloque-lentejas',
    afterBlockId: 'bloque-pollo',
    source: 'app',
    ...partial,
  };
}

describe('describeChanges', () => {
  it('describe un cambio de una comida con el antes y el después', () => {
    const [grupo] = describeChanges([entrada()], lookup);

    expect(grupo!.text).toBe(
      'cambió la comida del martes (solo esta semana): Lentejas con verduras → Pollo al horno',
    );
    expect(grupo!.kind).toBe('cell');
  });

  it('distingue "solo esta semana" de "todo el plan"', () => {
    const [grupo] = describeChanges([entrada({ table: 'template_cells' })], lookup);
    expect(grupo!.text).toContain('(todo el plan)');
  });

  it('agrupa un intercambio en una sola frase', () => {
    const grupos = describeChanges(
      [
        entrada({
          id: 'a',
          cell: { day: 0, slot: 'comida', scope: 'shared' },
          beforeBlockId: 'bloque-lentejas',
          afterBlockId: 'bloque-pollo',
        }),
        entrada({
          id: 'b',
          cell: { day: 1, slot: 'comida', scope: 'shared' },
          beforeBlockId: 'bloque-pollo',
          afterBlockId: 'bloque-lentejas',
        }),
      ],
      lookup,
    );

    expect(grupos).toHaveLength(1);
    expect(grupos[0]!.kind).toBe('swap');
    expect(grupos[0]!.text).toBe('intercambió la comida del lunes y del martes (solo esta semana)');
  });

  it('reconoce el intercambio aunque una celda no tuviera cambio previo', () => {
    // Es la mitad de los casos reales: una celda ya estaba cambiada (UPDATE, con `before`)
    // y la otra no (INSERT, sin `before`). Solo se puede comprobar un lado del cruce.
    const grupos = describeChanges(
      [
        entrada({
          id: 'a',
          op: 'UPDATE',
          cell: { day: 0, slot: 'comida', scope: 'shared' },
          beforeBlockId: 'bloque-lentejas',
          afterBlockId: 'bloque-pollo',
        }),
        entrada({
          id: 'b',
          op: 'INSERT',
          cell: { day: 1, slot: 'comida', scope: 'shared' },
          beforeBlockId: null,
          afterBlockId: 'bloque-lentejas',
        }),
      ],
      lookup,
    );

    expect(grupos[0]!.kind).toBe('swap');
  });

  it('sin ningún cruce comprobable NO afirma que hubo intercambio', () => {
    // Dos INSERT: no se sabe qué había antes en ninguna de las dos. Mejor quedarse corto
    // que contar algo que no consta.
    const grupos = describeChanges(
      [
        entrada({
          id: 'a',
          op: 'INSERT',
          cell: { day: 0, slot: 'comida', scope: 'shared' },
          beforeBlockId: null,
          afterBlockId: 'bloque-pollo',
        }),
        entrada({
          id: 'b',
          op: 'INSERT',
          cell: { day: 1, slot: 'comida', scope: 'shared' },
          beforeBlockId: null,
          afterBlockId: 'bloque-lentejas',
        }),
      ],
      lookup,
    );

    expect(grupos[0]!.kind).not.toBe('swap');
    expect(grupos[0]!.text).toBe('cambió 2 comidas (solo esta semana)');
  });

  it('una restauración que deshace varias celdas las cuenta todas', () => {
    const grupos = describeChanges(
      [
        entrada({ id: 'a', source: 'restaurar', cell: { day: 0, slot: 'comida' } }),
        entrada({ id: 'b', source: 'restaurar', cell: { day: 1, slot: 'comida' } }),
      ],
      lookup,
    );
    expect(grupos[0]!.text).toBe('restauró 2 comidas');
  });

  it('dos cambios a la vez que NO se cruzan no son un intercambio', () => {
    const grupos = describeChanges(
      [
        entrada({ id: 'a', cell: { day: 0, slot: 'comida' }, afterBlockId: 'bloque-pollo' }),
        entrada({ id: 'b', cell: { day: 1, slot: 'comida' }, afterBlockId: 'bloque-pasta' }),
      ],
      lookup,
    );

    expect(grupos[0]!.kind).not.toBe('swap');
    expect(grupos[0]!.text).toBe('cambió 2 comidas (solo esta semana)');
  });

  it('separa lo que ocurrió en transacciones distintas', () => {
    const grupos = describeChanges(
      [entrada({ id: 'a', txId: 'tx1' }), entrada({ id: 'b', txId: 'tx2' })],
      lookup,
    );
    expect(grupos).toHaveLength(2);
  });

  it('ordena lo más reciente primero', () => {
    const grupos = describeChanges(
      [
        entrada({ id: 'viejo', txId: 'tx1', createdAt: '2026-10-10T10:00:00Z' }),
        entrada({ id: 'nuevo', txId: 'tx2', createdAt: '2026-10-15T10:00:00Z' }),
      ],
      lookup,
    );
    expect(grupos.map((g) => g.id)).toEqual(['nuevo', 'viejo']);
  });

  it('reconoce una restauración', () => {
    const [grupo] = describeChanges([entrada({ source: 'restaurar' })], lookup);
    expect(grupo!.text).toBe('restauró la comida del martes');
  });

  it('describe la edición de un plato', () => {
    const [grupo] = describeChanges(
      [entrada({ table: 'blocks', cell: { slot: 'cena' }, afterBlockId: 'bloque-pasta' })],
      lookup,
    );
    expect(grupo!.text).toBe('editó el plato "Pasta con boloñesa"');
    expect(grupo!.kind).toBe('block');
  });

  it('aguanta que ya no se sepa el título de un bloque', () => {
    const [grupo] = describeChanges(
      [entrada({ beforeBlockId: 'borrado-hace-meses', afterBlockId: 'bloque-pollo' })],
      lookup,
    );
    expect(grupo!.text).toBe('cambió la comida del martes (solo esta semana): Pollo al horno');
  });

  it('cuenta una celda vaciada', () => {
    const [grupo] = describeChanges([entrada({ op: 'DELETE', afterBlockId: null })], lookup);
    expect(grupo!.text).toBe('quitó la comida del martes (solo esta semana)');
  });
});

describe('actorLabel', () => {
  const grupo = (partial: Partial<ChangeEntry>) => describeChanges([entrada(partial)], lookup)[0]!;

  it('usa el nombre cuando se sabe', () => {
    expect(actorLabel(grupo({ actorName: 'Cristina' }))).toBe('Cristina');
  });

  it('no inventa nombres para la nutricionista', () => {
    expect(actorLabel(grupo({ actorRole: 'nutricionista', actorName: null }))).toBe(
      'Tu nutricionista',
    );
  });

  it('distingue lo que hizo el sistema', () => {
    expect(actorLabel(grupo({ actorRole: 'sistema', actorName: null }))).toBe('El sistema');
  });
});
