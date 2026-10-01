/**
 * El esquema es la puerta de entrada de todo dato externo (seed, Supabase, importación).
 * Estos tests valen además como prueba de que el plan de prueba tiene la forma del real:
 * si el fixture dejara de pasar el esquema, los demás tests estarían midiendo una ficción.
 */
import { describe, expect, it } from 'vitest';
import { testPlan } from './__fixtures__/plan';
import { Block, Check, DailyLog, MealNote, Plan, ShoppingItem } from './schema';

describe('Plan', () => {
  it('el plan de prueba cumple el esquema', () => {
    expect(() => Plan.parse(testPlan)).not.toThrow();
  });

  it('exige al menos un perfil', () => {
    expect(Plan.safeParse({ ...testPlan, profiles: [] }).success).toBe(false);
  });

  it('exige fechas ISO', () => {
    expect(Plan.safeParse({ ...testPlan, validFrom: '28/09/2026' }).success).toBe(false);
  });

  it('exige que training tenga los siete días', () => {
    const profiles = testPlan.profiles.map((profile) => ({ ...profile, training: ['Gimnasio'] }));
    expect(Plan.safeParse({ ...testPlan, profiles }).success).toBe(false);
  });
});

describe('Block', () => {
  const bloque = testPlan.blocks[0];

  it('acepta un bloque del plan', () => {
    expect(Block.safeParse(bloque).success).toBe(true);
  });

  it('no acepta un bloque sin secciones', () => {
    expect(Block.safeParse({ ...bloque, sections: [] }).success).toBe(false);
  });

  it('no acepta una franja inventada', () => {
    expect(Block.safeParse({ ...bloque, slot: 'merienda' }).success).toBe(false);
  });

  it('no acepta cantidades negativas', () => {
    const roto = {
      ...bloque,
      sections: [
        {
          id: 's',
          kind: 'plato',
          items: [{ id: 'i', label: 'Algo', portions: { cristina: { rawG: -10 } } }],
        },
      ],
    };
    expect(Block.safeParse(roto).success).toBe(false);
  });
});

describe('registro diario', () => {
  it('acepta un check', () => {
    expect(
      Check.safeParse({
        profileId: 'cristina',
        date: '2026-09-28',
        slot: 'comida',
        itemId: 'comida-lun-pollo',
        checked: true,
      }).success,
    ).toBe(true);
  });

  it('pone los valores por defecto del registro diario', () => {
    const log = DailyLog.parse({
      profileId: 'andres',
      date: '2026-09-28',
      comodinOptionId: null,
    });
    expect(log).toMatchObject({ comodinDone: false, waterMl: 0, aoveSpoons: 0 });
  });

  it('no acepta agua negativa', () => {
    expect(
      DailyLog.safeParse({
        profileId: 'andres',
        date: '2026-09-28',
        comodinOptionId: null,
        waterMl: -1,
      }).success,
    ).toBe(false);
  });

  it('limita el hambre de 1 a 5 y la nota a 500 caracteres', () => {
    const base = { profileId: 'cristina', date: '2026-09-28', slot: 'cena' as const };
    expect(MealNote.safeParse({ ...base, hunger: 3 }).success).toBe(true);
    expect(MealNote.safeParse({ ...base, hunger: 6 }).success).toBe(false);
    expect(MealNote.safeParse({ ...base, text: 'x'.repeat(501) }).success).toBe(false);
  });
});

describe('ShoppingItem', () => {
  it('acepta una línea automática y pone los valores por defecto', () => {
    const item = ShoppingItem.parse({
      id: 'uno',
      weekStart: '2026-09-28',
      source: 'auto',
      foodKey: 'pollo',
      label: 'Pollo',
      section: 'carniceria',
    });
    expect(item).toMatchObject({ checked: false, inPantry: false });
  });

  it('no acepta una sección de súper inventada', () => {
    expect(
      ShoppingItem.safeParse({
        id: 'uno',
        weekStart: '2026-09-28',
        source: 'auto',
        label: 'Pollo',
        section: 'congeladores',
      }).success,
    ).toBe(false);
  });
});
