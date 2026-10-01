import { describe, expect, it } from 'vitest';
import { ANDRES, CRISTINA, testPlan, WEEK_START } from './__fixtures__/plan';
import { CheckIndex, dayProgress, itemIdsOf, slotProgress, weekAdherence } from './progress';
import { findSlot, resolveWeek } from './resolve';
import type { Check, SlotKey, WeekOverride } from './schema';

const LUNES = '2026-09-28';

function semana(profileId: string, overrides: WeekOverride[] = []) {
  return resolveWeek({ plan: testPlan, profileId, weekStart: WEEK_START, overrides });
}

function checks(profileId: string, slot: SlotKey, itemIds: string[], date = LUNES): Check[] {
  return itemIds.map((itemId) => ({ profileId, date, slot, itemId, checked: true }));
}

describe('slotProgress', () => {
  it('cuenta solo los alimentos de esa persona', () => {
    const comidaC = findSlot(semana(CRISTINA), 0, 'comida');
    const comidaA = findSlot(semana(ANDRES), 0, 'comida');

    // Cristina tiene pan ese día; Andrés no.
    expect(itemIdsOf(comidaC!)).toHaveLength(5);
    expect(itemIdsOf(comidaA!)).toHaveLength(4);
  });

  it('la franja se completa al marcar su último alimento', () => {
    const comida = findSlot(semana(CRISTINA), 0, 'comida')!;
    const ids = itemIdsOf(comida);

    const casi = slotProgress(
      comida,
      new CheckIndex(checks(CRISTINA, 'comida', ids.slice(0, -1)), CRISTINA),
    );
    expect(casi).toMatchObject({ total: 5, done: 4, complete: false });

    const todo = slotProgress(comida, new CheckIndex(checks(CRISTINA, 'comida', ids), CRISTINA));
    expect(todo).toMatchObject({ total: 5, done: 5, complete: true, ratio: 1 });
  });

  it('los checks de la otra persona no cuentan', () => {
    const comida = findSlot(semana(CRISTINA), 0, 'comida')!;
    const deAndres = checks(ANDRES, 'comida', itemIdsOf(comida));
    expect(slotProgress(comida, new CheckIndex(deAndres, CRISTINA)).done).toBe(0);
  });

  it('los checks de otro día no cuentan', () => {
    const comida = findSlot(semana(CRISTINA), 0, 'comida')!;
    const otroDia = checks(CRISTINA, 'comida', itemIdsOf(comida), '2026-09-29');
    expect(slotProgress(comida, new CheckIndex(otroDia, CRISTINA)).done).toBe(0);
  });

  it('un check desmarcado no cuenta', () => {
    const comida = findSlot(semana(CRISTINA), 0, 'comida')!;
    const ids = itemIdsOf(comida);
    const mezcla: Check[] = ids.map((itemId, i) => ({
      profileId: CRISTINA,
      date: LUNES,
      slot: 'comida',
      itemId,
      checked: i !== 0,
    }));
    expect(slotProgress(comida, new CheckIndex(mezcla, CRISTINA))).toMatchObject({
      done: 4,
      complete: false,
    });
  });

  it('una celda vacía no está completa', () => {
    const domingo = findSlot(semana(CRISTINA), 6, 'comida')!;
    expect(slotProgress(domingo, new CheckIndex([], CRISTINA))).toMatchObject({
      total: 0,
      complete: false,
    });
  });
});

describe('dayProgress', () => {
  it('suma todas las franjas del día', () => {
    const week = semana(CRISTINA);
    const lunes = week.days[0]!;
    const todos = lunes.slots.flatMap((slot) => checks(CRISTINA, slot.cell.slot, itemIdsOf(slot)));

    // Desayuno 2 + snack 1 + comida 5 + cena 2 = 10 alimentos.
    expect(dayProgress(lunes, new CheckIndex([], CRISTINA))).toMatchObject({ total: 10, done: 0 });
    expect(dayProgress(lunes, new CheckIndex(todos, CRISTINA))).toMatchObject({
      total: 10,
      done: 10,
      complete: true,
    });
  });
});

describe('weekAdherence', () => {
  it('sin ningún check la adherencia es 0', () => {
    const adherencia = weekAdherence(semana(CRISTINA), []);
    expect(adherencia.overall.done).toBe(0);
    expect(adherencia.overall.ratio).toBe(0);
    expect(adherencia.completeDays).toBe(0);
  });

  it('marcar todo el lunes da un día completo', () => {
    const week = semana(CRISTINA);
    const todos = week.days[0]!.slots.flatMap((slot) =>
      checks(CRISTINA, slot.cell.slot, itemIdsOf(slot)),
    );

    const adherencia = weekAdherence(week, todos);
    expect(adherencia.completeDays).toBe(1);
    expect(adherencia.byDay[0]?.complete).toBe(true);
    expect(adherencia.byDay[1]?.complete).toBe(false);
  });

  it('desglosa por franja', () => {
    const week = semana(CRISTINA);
    const comida = findSlot(week, 0, 'comida')!;
    const adherencia = weekAdherence(week, checks(CRISTINA, 'comida', itemIdsOf(comida)));

    expect(adherencia.bySlot.comida?.done).toBe(5);
    expect(adherencia.bySlot.desayuno?.done).toBe(0);
    // La franja comida suma los dos días: 5 alimentos el lunes y 2 el martes.
    expect(adherencia.bySlot.comida?.total).toBe(7);
  });

  it('las ingestas libres no cuentan en el denominador', () => {
    const libre: WeekOverride[] = [
      {
        weekStart: WEEK_START,
        day: 0,
        slot: 'comida',
        scope: 'shared',
        blockId: null,
        isFree: true,
      },
    ];
    const conLibre = weekAdherence(semana(CRISTINA, libre), []);
    const sinLibre = weekAdherence(semana(CRISTINA), []);

    expect(conLibre.freeMeals).toBe(1);
    expect(conLibre.overall.total).toBe(sinLibre.overall.total - 5);
  });

  it('no pierde el historial al cambiar de semana', () => {
    const week = semana(CRISTINA);
    const comida = findSlot(week, 0, 'comida')!;
    const delLunes = checks(CRISTINA, 'comida', itemIdsOf(comida));

    const siguiente = resolveWeek({
      plan: testPlan,
      profileId: CRISTINA,
      weekStart: '2026-10-05',
    });

    // Los checks están fechados: cuentan en su semana y no en la siguiente.
    expect(weekAdherence(week, delLunes).overall.done).toBe(5);
    expect(weekAdherence(siguiente, delLunes).overall.done).toBe(0);
  });
});
