import { describe, expect, it } from 'vitest';
import {
  addDays,
  currentWeekStart,
  dayIndexOf,
  daysBetween,
  isIsoDate,
  isoWeekDates,
  todayIn,
  weekStartOf,
} from './dates';

describe('dayIndexOf', () => {
  it('pone el lunes a 0 y el domingo a 6', () => {
    // 28/09/2026 es el lunes propuesto como validFrom del plan de septiembre.
    expect(dayIndexOf('2026-09-28')).toBe(0);
    expect(dayIndexOf('2026-10-03')).toBe(5);
    expect(dayIndexOf('2026-09-27')).toBe(6);
  });
});

describe('weekStartOf', () => {
  it('devuelve el lunes de esa semana', () => {
    expect(weekStartOf('2026-09-30')).toBe('2026-09-28');
    expect(weekStartOf('2026-10-04')).toBe('2026-09-28');
  });

  it('es idempotente: el lunes de un lunes es él mismo', () => {
    expect(weekStartOf('2026-09-28')).toBe('2026-09-28');
  });

  it('cruza el cambio de mes y de año', () => {
    expect(weekStartOf('2026-01-01')).toBe('2025-12-29');
  });
});

describe('isoWeekDates', () => {
  it('da los siete días de lunes a domingo', () => {
    expect(isoWeekDates('2026-09-28')).toEqual([
      '2026-09-28',
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
    ]);
  });

  it('normaliza si le pasas un día cualquiera de la semana', () => {
    expect(isoWeekDates('2026-10-01')).toEqual(isoWeekDates('2026-09-28'));
  });
});

describe('cambio de hora en Madrid', () => {
  // El 29/03/2026 y el 25/10/2026 son los domingos en que Madrid cambia la hora.
  // La aritmética va en UTC justamente para que esos días no desplacen el calendario.
  it('la semana del cambio de hora de primavera sigue teniendo 7 días correlativos', () => {
    const week = isoWeekDates('2026-03-23');
    expect(week).toHaveLength(7);
    expect(week.at(-1)).toBe('2026-03-29');
    expect(daysBetween('2026-03-23', '2026-03-29')).toBe(6);
  });

  it('la semana del cambio de hora de otoño también', () => {
    expect(isoWeekDates('2026-10-19').at(-1)).toBe('2026-10-25');
    expect(addDays('2026-10-24', 1)).toBe('2026-10-25');
    expect(daysBetween('2026-10-19', '2026-10-25')).toBe(6);
  });
});

describe('addDays', () => {
  it('suma y resta cruzando meses', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDays('2026-10-01', -1)).toBe('2026-09-30');
  });

  it('respeta los años bisiestos', () => {
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
  });
});

describe('todayIn', () => {
  it('usa el día de Madrid, no el de UTC, en horario de verano', () => {
    // 22:30 UTC del 1 de julio ya es día 2 en Madrid (UTC+2).
    expect(todayIn(new Date('2026-07-01T22:30:00Z'))).toBe('2026-07-02');
  });

  it('y en horario de invierno', () => {
    // 23:30 UTC del 1 de enero ya es día 2 en Madrid (UTC+1).
    expect(todayIn(new Date('2026-01-01T23:30:00Z'))).toBe('2026-01-02');
  });

  it('antes de medianoche en Madrid sigue siendo el día anterior', () => {
    expect(todayIn(new Date('2026-01-01T12:00:00Z'))).toBe('2026-01-01');
  });
});

describe('currentWeekStart', () => {
  it('combina el día de Madrid con el lunes de su semana', () => {
    // Domingo 4/10/2026 a las 23:30 UTC ya es lunes 5 en Madrid: semana nueva.
    expect(currentWeekStart(new Date('2026-10-04T23:30:00Z'))).toBe('2026-10-05');
    expect(currentWeekStart(new Date('2026-10-04T12:00:00Z'))).toBe('2026-09-28');
  });
});

describe('isIsoDate', () => {
  it('acepta fechas reales', () => {
    expect(isIsoDate('2026-09-28')).toBe(true);
    expect(isIsoDate('2024-02-29')).toBe(true);
  });

  it('rechaza formas inválidas y fechas que no existen', () => {
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('2026-13-01')).toBe(false);
    expect(isIsoDate('28/09/2026')).toBe(false);
    expect(isIsoDate(null)).toBe(false);
  });
});
