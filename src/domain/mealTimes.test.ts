import { describe, expect, it } from 'vitest';
import { minutesNow, minutesOf, nextSlot, sortSlotsByTime } from './mealTimes';

const CRISTINA_SLOTS = ['desayuno', 'snack', 'snack2', 'comida', 'cena'] as const;
const ANDRES_SLOTS = ['desayuno', 'almuerzo', 'comida', 'cena'] as const;

describe('nextSlot', () => {
  it('a primera hora toca el desayuno', () => {
    expect(nextSlot(CRISTINA_SLOTS, minutesOf('07:00'))).toBe('desayuno');
  });

  it('a media mañana toca el snack', () => {
    expect(nextSlot(CRISTINA_SLOTS, minutesOf('09:30'))).toBe('snack');
  });

  it('justo a la hora de una franja, esa misma es la siguiente', () => {
    expect(nextSlot(CRISTINA_SLOTS, minutesOf('14:30'))).toBe('comida');
  });

  it('por la tarde toca el segundo snack', () => {
    expect(nextSlot(CRISTINA_SLOTS, minutesOf('15:00'))).toBe('snack2');
  });

  it('después de cenar ya no queda nada', () => {
    expect(nextSlot(CRISTINA_SLOTS, minutesOf('22:30'))).toBeNull();
  });

  it('usa solo las franjas de esa persona', () => {
    // Andrés no tiene snack2: después de comer, lo siguiente es la cena.
    expect(nextSlot(ANDRES_SLOTS, minutesOf('15:00'))).toBe('cena');
  });
});

describe('sortSlotsByTime', () => {
  it('ordena por hora, no por como vengan', () => {
    expect(sortSlotsByTime(['cena', 'desayuno', 'comida'])).toEqual(['desayuno', 'comida', 'cena']);
  });

  it('el snack 2 de Cristina va después de la comida', () => {
    expect(sortSlotsByTime(CRISTINA_SLOTS)).toEqual([
      'desayuno',
      'snack',
      'comida',
      'snack2',
      'cena',
    ]);
  });
});

describe('minutesNow', () => {
  it('usa la hora de Madrid, no la de UTC', () => {
    // 12:00 UTC en julio son las 14:00 en Madrid.
    expect(minutesNow(new Date('2026-07-01T12:00:00Z'))).toBe(14 * 60);
    // En enero, las 13:00.
    expect(minutesNow(new Date('2026-01-01T12:00:00Z'))).toBe(13 * 60);
  });
});
