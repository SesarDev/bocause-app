import { describe, expect, it } from 'vitest';
import { ANDRES, CRISTINA, testPlan } from './__fixtures__/plan';
import { blockIsEmpty, diffBlocks } from './diff';
import type { Block } from './schema';

const original = testPlan.blocks.find((block) => block.id === 'comida-lun') as Block;
const clone = (): Block => structuredClone(original);

describe('diffBlocks', () => {
  it('sin tocar nada no hay cambios', () => {
    const diff = diffBlocks(original, clone());
    expect(diff.hasChanges).toBe(false);
    expect([...diff.items.values()].every((change) => change === 'igual')).toBe(true);
  });

  it('cambiar una cantidad marca el alimento como cambiado', () => {
    const draft = clone();
    draft.sections[0]!.items[0]!.portions[CRISTINA]!.rawG = 200;

    const diff = diffBlocks(original, draft);
    expect(diff.items.get('comida-lun-pollo')).toBe('cambiado');
    expect(diff.hasChanges).toBe(true);
  });

  it('cambiar la medida casera también cuenta', () => {
    const draft = clone();
    draft.sections[0]!.items[0]!.portions[ANDRES]!.measure = 'dos filetes';
    expect(diffBlocks(original, draft).items.get('comida-lun-pollo')).toBe('cambiado');
  });

  it('cambiar el nombre cuenta', () => {
    const draft = clone();
    draft.sections[0]!.items[0]!.label = 'Pavo';
    expect(diffBlocks(original, draft).items.get('comida-lun-pollo')).toBe('cambiado');
  });

  it('quitarle la ración a una persona cuenta como cambio', () => {
    const draft = clone();
    delete draft.sections[0]!.items[0]!.portions[ANDRES];
    expect(diffBlocks(original, draft).items.get('comida-lun-pollo')).toBe('cambiado');
  });

  it('un alimento añadido sale como nuevo', () => {
    const draft = clone();
    draft.sections[0]!.items.push({
      id: 'nuevo-1',
      label: 'Perejil',
      portions: { [CRISTINA]: { measure: 'al gusto' } },
    });

    const diff = diffBlocks(original, draft);
    expect(diff.items.get('nuevo-1')).toBe('nuevo');
    expect(diff.items.get('comida-lun-pollo')).toBe('igual');
  });

  it('un alimento quitado aparece en removedItems', () => {
    const draft = clone();
    draft.sections[0]!.items = draft.sections[0]!.items.filter(
      (item) => item.id !== 'comida-lun-arroz',
    );

    const diff = diffBlocks(original, draft);
    expect(diff.removedItems.map((item) => item.id)).toEqual(['comida-lun-arroz']);
    expect(diff.hasChanges).toBe(true);
  });

  it('cambiar el título de un plato se detecta', () => {
    const draft = clone();
    draft.sections[0]!.title = 'Pollo con quinoa';
    expect(diffBlocks(original, draft).changedTitles.has('comida-lun-plato')).toBe(true);
  });

  it('quitar una sección entera se detecta', () => {
    const draft = clone();
    draft.sections = draft.sections.filter((section) => section.kind !== 'postre');

    const diff = diffBlocks(original, draft);
    expect(diff.removedSections.map((section) => section.kind)).toEqual(['postre']);
  });

  it('reordenar cuenta como cambio aunque el contenido sea el mismo', () => {
    const draft = clone();
    draft.sections = [draft.sections[1]!, draft.sections[0]!, draft.sections[2]!];
    expect(diffBlocks(original, draft).hasChanges).toBe(true);
  });

  it('sin original, todo es nuevo', () => {
    const diff = diffBlocks(null, clone());
    expect([...diff.items.values()].every((change) => change === 'nuevo')).toBe(true);
    expect(diff.hasChanges).toBe(true);
  });
});

describe('blockIsEmpty', () => {
  it('detecta un bloque sin ningún alimento', () => {
    const draft = clone();
    for (const section of draft.sections) section.items = [];
    expect(blockIsEmpty(draft)).toBe(true);
  });

  it('con un solo alimento ya no está vacío', () => {
    expect(blockIsEmpty(original)).toBe(false);
  });
});
