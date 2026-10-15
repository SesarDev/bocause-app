/**
 * Las claves de caché tienen que llevar el hogar.
 *
 * No es un detalle de estilo: la caché se persiste en IndexedDB y sobrevive al cambio de
 * sesión, así que una clave sin hogar serviría los datos de una casa a otra. Hoy, con un
 * solo hogar, un descuido aquí no se notaría; se notaría en la fase 17, cuando la
 * nutricionista mire a varios clientes seguidos. Por eso se comprueba ahora.
 */
import { describe, expect, it } from 'vitest';
import { keysFor, NO_HOUSEHOLD, ROOT } from './keys';
import { mutationKeys } from './mutations';

const CASA = '450d2bf4-870e-4ecc-ac25-aad8ae09a879';
const OTRA = 'ffffffff-0000-4000-8000-000000000000';

/** Todas las claves de un hogar, con argumentos de ejemplo. */
function allKeys(householdId: string | null): { name: string; key: readonly unknown[] }[] {
  const keys = keysFor(householdId);
  return [
    { name: 'all', key: keys.all },
    { name: 'profiles', key: keys.profiles() },
    { name: 'plan', key: keys.plan('2026-10-15') },
    { name: 'blocks', key: keys.blocks('plan-1') },
    { name: 'templateCells', key: keys.templateCells('plan-1') },
    { name: 'weekOverrides', key: keys.weekOverrides('plan-1', '2026-10-12') },
    { name: 'checks', key: keys.checks('2026-10-12') },
    { name: 'dailyLogs', key: keys.dailyLogs('2026-10-12') },
    { name: 'shoppingItems', key: keys.shoppingItems('2026-10-12') },
  ];
}

describe('claves de consulta', () => {
  it('todas empiezan por la raíz y el hogar', () => {
    for (const { name, key } of allKeys(CASA)) {
      expect(key.slice(0, 2), `la clave "${name}" no lleva el hogar`).toEqual([ROOT, CASA]);
    }
  });

  it('dos hogares nunca comparten clave', () => {
    const casa = allKeys(CASA);
    const otra = allKeys(OTRA);

    for (const [index, entry] of casa.entries()) {
      expect(entry.key, `la clave "${entry.name}" se repite entre hogares`).not.toEqual(
        otra[index]!.key,
      );
    }
  });

  it('sin hogar usa una rama aparte, no la raíz pelada', () => {
    for (const { name, key } of allKeys(null)) {
      expect(key[1], `la clave "${name}" sin hogar`).toBe(NO_HOUSEHOLD);
    }
  });

  it('distingue planes, semanas y fechas distintas', () => {
    const keys = keysFor(CASA);
    expect(keys.blocks('a')).not.toEqual(keys.blocks('b'));
    expect(keys.checks('2026-10-12')).not.toEqual(keys.checks('2026-10-19'));
    expect(keys.weekOverrides('a', '2026-10-12')).not.toEqual(
      keys.weekOverrides('a', '2026-10-19'),
    );
  });
});

describe('claves de mutación', () => {
  /**
   * Al revés que las de consulta: identifican qué función ejecutar, no sobre qué datos.
   * Se registran una vez al cargar el módulo y son lo que permite que una mutación guardada
   * sin cobertura reencuentre su función al reabrir la app. Si llevaran el hogar, una
   * mutación pendiente dejaría de reconocerse al cambiar de hogar y no se ejecutaría nunca.
   */
  it('no llevan el hogar', () => {
    for (const [name, key] of Object.entries(mutationKeys)) {
      expect(key[0], `la mutación "${name}"`).toBe(ROOT);
      expect(key[1], `la mutación "${name}"`).toBe('mutation');
      expect(key).not.toContain(CASA);
    }
  });

  it('cada mutación tiene una clave distinta', () => {
    const serialized = Object.values(mutationKeys).map((key) => key.join('/'));
    expect(new Set(serialized).size).toBe(serialized.length);
  });
});
