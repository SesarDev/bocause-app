import { describe, expect, it } from 'vitest';
import { pruneUnusedBlocks, unusedBlockCount } from './draft';
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
