/**
 * Las marcas de lectura del chat tienen que sobrevivir a la caché.
 *
 * Lo que devuelve una consulta se guarda en IndexedDB pasando por JSON. Con un `Map`,
 * la primera visita iba bien y la siguiente se encontraba un `{}`, reventaba en
 * `reads.data?.get is not a function` y dejaba la pantalla en blanco. De ahí estos tests.
 */
import { describe, expect, it } from 'vitest';
import { lastReadOf, readsFrom, type ChatReads } from './chat';

const filas = [
  { profile_id: 'p-cristina', role: 'cliente', last_read_at: '2026-10-17T10:00:00Z' },
  { profile_id: 'p-cristina', role: 'nutricionista', last_read_at: '2026-10-17T12:00:00Z' },
  { profile_id: 'p-andres', role: 'cliente', last_read_at: '2026-10-16T09:00:00Z' },
];

/** Lo que hace el persister: guardar y volver a leer. */
const porLaCache = (reads: ChatReads): ChatReads => JSON.parse(JSON.stringify(reads)) as ChatReads;

describe('readsFrom', () => {
  it('indexa por persona y papel', () => {
    const reads = readsFrom(filas);
    expect(lastReadOf(reads, 'p-cristina', 'cliente')).toBe('2026-10-17T10:00:00Z');
    expect(lastReadOf(reads, 'p-cristina', 'nutricionista')).toBe('2026-10-17T12:00:00Z');
    expect(lastReadOf(reads, 'p-andres', 'cliente')).toBe('2026-10-16T09:00:00Z');
  });

  it('sigue sirviendo después de pasar por la caché', () => {
    const reads = porLaCache(readsFrom(filas));
    expect(lastReadOf(reads, 'p-cristina', 'cliente')).toBe('2026-10-17T10:00:00Z');
  });

  it('sin filas no hay marcas', () => {
    expect(readsFrom([])).toEqual({});
  });
});

describe('lastReadOf', () => {
  it('es null si esa persona no ha leído nada en ese papel', () => {
    expect(lastReadOf(readsFrom(filas), 'p-andres', 'nutricionista')).toBeNull();
  });

  it('aguanta que la consulta todavía no haya respondido', () => {
    expect(lastReadOf(undefined, 'p-cristina', 'cliente')).toBeNull();
  });

  it('aguanta no saber todavía quién eres', () => {
    expect(lastReadOf(readsFrom(filas), null, 'cliente')).toBeNull();
  });
});
