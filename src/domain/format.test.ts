import { describe, expect, it } from 'vitest';
import { CRISTINA, ANDRES } from './__fixtures__/plan';
import { dayNameOf, formatPortion, formatTotal, shortDateOf, totalForProfiles } from './format';
import type { FoodItem } from './schema';

describe('formatPortion', () => {
  it('enseña crudo y cocido cuando el plan da los dos', () => {
    expect(formatPortion({ rawG: 80, cookedG: 160 }).amount).toBe('80 g crudo / 160 g cocido');
  });

  it('con un solo peso no dice si es crudo', () => {
    expect(formatPortion({ rawG: 150 }).amount).toBe('150 g');
  });

  it('marca el cocido cuando es lo único que hay', () => {
    expect(formatPortion({ cookedG: 130 }).amount).toBe('130 g cocido');
  });

  it('entiende mililitros', () => {
    expect(formatPortion({ ml: 100 }).amount).toBe('100 ml');
  });

  it('separa la cantidad de la medida de casa', () => {
    expect(formatPortion({ rawG: 30, measure: '3 lonchas finas' })).toEqual({
      amount: '30 g',
      measure: '3 lonchas finas',
    });
  });

  it('no repite las unidades si la medida ya las dice', () => {
    // "Plátano (1 unidad mediana)": enseñar además "1 ud" sobra.
    expect(formatPortion({ units: 1, measure: '1 unidad mediana' })).toEqual({
      amount: null,
      measure: '1 unidad mediana',
    });
    expect(formatPortion({ units: 2, measure: '2 unidades grandes o 1 vaso' }).amount).toBeNull();
  });

  it('sí las enseña cuando la medida habla de otra cosa', () => {
    expect(formatPortion({ units: 2, measure: '1/2 bandeja' }).amount).toBe('2 ud');
    expect(formatPortion({ units: 3 }).amount).toBe('3 ud');
  });

  it('si la medida dice otro número, no se calla la cantidad', () => {
    expect(formatPortion({ units: 2, measure: '1 unidad mediana' }).amount).toBe('2 ud');
  });

  it('deja solo la medida cuando no hay número', () => {
    expect(formatPortion({ measure: 'al gusto' })).toEqual({ amount: null, measure: 'al gusto' });
  });

  it('una ración vacía no enseña nada', () => {
    expect(formatPortion({})).toEqual({ amount: null, measure: null });
  });
});

describe('totalForProfiles', () => {
  const pollo: FoodItem = {
    id: 'pollo',
    label: 'Pollo',
    portions: { [CRISTINA]: { rawG: 120 }, [ANDRES]: { rawG: 180 } },
  };

  it('suma lo de los dos para cocinar de una vez', () => {
    expect(totalForProfiles(pollo, [CRISTINA, ANDRES])).toEqual({ amount: 300, unit: 'g' });
  });

  it('con una sola persona devuelve lo suyo', () => {
    expect(totalForProfiles(pollo, [CRISTINA])).toEqual({ amount: 120, unit: 'g' });
  });

  it('ignora a quien no lo come', () => {
    const soloElla: FoodItem = {
      id: 'pan',
      label: 'Pan',
      portions: { [CRISTINA]: { rawG: 40 } },
    };
    expect(totalForProfiles(soloElla, [CRISTINA, ANDRES])).toEqual({ amount: 40, unit: 'g' });
  });

  it('no suma peras con manzanas: unidades distintas dan null', () => {
    const raro: FoodItem = {
      id: 'raro',
      label: 'Raro',
      portions: { [CRISTINA]: { rawG: 100 }, [ANDRES]: { units: 2 } },
    };
    expect(totalForProfiles(raro, [CRISTINA, ANDRES])).toBeNull();
  });

  it('sin cantidades numéricas devuelve null', () => {
    const alGusto: FoodItem = {
      id: 'sal',
      label: 'Sal',
      portions: { [CRISTINA]: { measure: 'al gusto' } },
    };
    expect(totalForProfiles(alGusto, [CRISTINA])).toBeNull();
  });
});

describe('formatTotal', () => {
  it('escribe la unidad detrás', () => {
    expect(formatTotal(300, 'g')).toBe('300 g');
    expect(formatTotal(5, 'ud')).toBe('5 ud');
  });
});

describe('fechas de la cabecera', () => {
  it('el nombre del día va en mayúsculas', () => {
    expect(dayNameOf('2026-09-28')).toBe('LUNES');
    expect(dayNameOf('2026-10-04')).toBe('DOMINGO');
  });

  it('la fecha corta no lleva año', () => {
    expect(shortDateOf('2026-09-28')).toBe('28 de septiembre');
    expect(shortDateOf('2026-10-01')).toBe('1 de octubre');
  });
});
