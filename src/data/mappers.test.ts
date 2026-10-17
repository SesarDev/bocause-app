/**
 * La frontera entre la base de datos y el dominio.
 *
 * Aquí viven los dos sitios donde un id puede venir por dos caminos distintos: el del plan
 * (fila contra JSON) y el scope (UUID contra slug). Las dos veces, equivocarse no da un
 * error claro: da un 403 de RLS, o datos que se escriben en el sitio de otro.
 */
import { describe, expect, it } from 'vitest';
import { buildProfileDirectory, toBlock, toPlan, toProfile } from './mappers';
import type { Plan } from '../domain/schema';

const planJson: Plan = {
  id: '2026-09',
  name: 'Septiembre 2026',
  issuedOn: '2026-08-28',
  validFrom: '2026-09-28',
  profiles: [
    {
      profileId: 'cristina',
      displayName: 'Cristina',
      slots: ['desayuno', 'comida', 'cena'],
      training: [null, null, null, null, null, null, null],
      supplements: [],
      comodin: [],
    },
  ],
  blocks: [],
  template: [],
  recipes: [],
  foods: [],
  rules: {
    aoveMaxSpoonsPerWeek: 14,
    freeMealsPerWeek: 2,
    waterLitersMin: 2,
    waterLitersMax: 3,
    comodinRequired: true,
    recommendations: [],
  },
};

describe('toPlan', () => {
  it('se queda con el id de la fila, no con el del JSON', () => {
    // El hogar demo se siembra con "demo-2026-09" para no pisar el plan de casa, pero el
    // JSON de dentro sigue diciendo "2026-09". Con el de dentro, la app escribía las
    // celdas contra un plan que no existe y RLS las rechazaba: en ese hogar no se podía
    // editar nada.
    const plan = toPlan({ id: 'demo-2026-09', data: planJson } as never);
    expect(plan.id).toBe('demo-2026-09');
  });

  it('con los dos ids iguales no cambia nada', () => {
    expect(toPlan({ id: '2026-09', data: planJson } as never).id).toBe('2026-09');
  });
});

describe('toBlock', () => {
  const scopes = buildProfileDirectory([
    toProfile({
      id: '11111111-1111-1111-1111-111111111111',
      user_id: null,
      household_id: 'h1',
      slug: 'cristina',
      display_name: 'Cristina',
    }),
  ]);

  it('traduce el scope de UUID a slug', () => {
    const block = toBlock(
      {
        id: 'b1',
        plan_id: '2026-09',
        slot: 'desayuno',
        scope: '11111111-1111-1111-1111-111111111111',
        origin_block_id: null,
        content: { sections: [{ id: 's1', kind: 'plato', items: [] }] },
      } as never,
      scopes,
    );

    expect(block.scope).toBe('cristina');
    expect(block.isOriginal).toBe(false);
  });

  it('deja "shared" como está', () => {
    const block = toBlock(
      {
        id: 'b2',
        plan_id: '2026-09',
        slot: 'cena',
        scope: 'shared',
        origin_block_id: 'cena-1-shared',
        content: { sections: [{ id: 's1', kind: 'plato', items: [] }] },
      } as never,
      scopes,
    );

    expect(block.scope).toBe('shared');
    expect(block.originBlockId).toBe('cena-1-shared');
  });
});

describe('toProfile', () => {
  it('sin multiplicador guardado, come la ración base', () => {
    const profile = toProfile({
      id: 'p1',
      user_id: null,
      household_id: 'h1',
      slug: 'andres',
      display_name: 'Andrés',
    });
    expect(profile.portionMultiplier).toBe(1);
  });

  it('respeta el multiplicador del hogar', () => {
    const profile = toProfile({
      id: 'p1',
      user_id: null,
      household_id: 'h1',
      slug: 'cristina',
      display_name: 'Cristina',
      portion_multiplier: 0.75,
    });
    expect(profile.portionMultiplier).toBe(0.75);
  });
});
