import { describe, expect, it } from 'vitest';
import {
  anchorFor,
  anchorLabel,
  groupByDay,
  lastMessage,
  unreadCount,
  type ChatMessage,
} from './chat';

function mensaje(partial: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'm1',
    authorRole: 'cliente',
    authorName: 'Cristina',
    body: 'Hola',
    anchor: null,
    createdAt: '2026-10-17T10:00:00.000Z',
    ...partial,
  };
}

describe('anchorLabel', () => {
  it('nombra la comida y el día', () => {
    expect(anchorLabel({ day: 1, slot: 'cena' })).toBe('Sobre la cena del martes');
  });

  it('añade el plato cuando se sabe', () => {
    expect(anchorLabel({ day: 3, slot: 'comida', title: 'Dorada al horno' })).toBe(
      'Sobre la comida del jueves · Dorada al horno',
    );
  });

  it('aguanta que falte el día', () => {
    expect(anchorLabel({ slot: 'desayuno' })).toBe('Sobre el desayuno');
  });

  it('no inventa coletilla si no hay nada que anclar', () => {
    expect(anchorLabel(null)).toBeNull();
    expect(anchorLabel({})).toBeNull();
  });

  it('no se rompe con una franja que no conoce', () => {
    expect(anchorLabel({ day: 0, slot: 'merienda' })).toBe('Sobre merienda del lunes');
  });
});

describe('unreadCount', () => {
  const mios = mensaje({ id: 'a', authorRole: 'cliente', createdAt: '2026-10-17T10:00:00Z' });
  const suyos = mensaje({
    id: 'b',
    authorRole: 'nutricionista',
    createdAt: '2026-10-17T11:00:00Z',
  });

  it('solo cuenta los de la otra parte', () => {
    // Lo que escribo yo no es una novedad para mí.
    expect(unreadCount([mios, suyos], null, 'cliente')).toBe(1);
    expect(unreadCount([mios, suyos], null, 'nutricionista')).toBe(1);
  });

  it('no cuenta lo anterior a la última lectura', () => {
    expect(unreadCount([mios, suyos], '2026-10-17T12:00:00Z', 'cliente')).toBe(0);
  });

  it('cuenta lo que llegó después', () => {
    expect(unreadCount([mios, suyos], '2026-10-17T10:30:00Z', 'cliente')).toBe(1);
  });

  it('sin haber leído nunca, cuenta todo lo ajeno', () => {
    const dos = [
      suyos,
      mensaje({ id: 'c', authorRole: 'nutricionista', createdAt: '2026-10-18T09:00:00Z' }),
    ];
    expect(unreadCount(dos, null, 'cliente')).toBe(2);
  });

  it('un hilo vacío no tiene nada sin leer', () => {
    expect(unreadCount([], null, 'cliente')).toBe(0);
  });
});

describe('groupByDay', () => {
  it('agrupa por día y ordena hacia abajo, como se lee una conversación', () => {
    const dias = groupByDay([
      mensaje({ id: 'tarde', createdAt: '2026-10-18T09:00:00Z' }),
      mensaje({ id: 'pronto', createdAt: '2026-10-17T10:00:00Z' }),
      mensaje({ id: 'medio', createdAt: '2026-10-17T18:00:00Z' }),
    ]);

    expect(dias.map((dia) => dia.date)).toEqual(['2026-10-17', '2026-10-18']);
    expect(dias[0]!.messages.map((m) => m.id)).toEqual(['pronto', 'medio']);
  });

  it('no muta la lista que recibe', () => {
    const entrada = [
      mensaje({ id: 'b', createdAt: '2026-10-18T09:00:00Z' }),
      mensaje({ id: 'a', createdAt: '2026-10-17T09:00:00Z' }),
    ];
    groupByDay(entrada);
    expect(entrada.map((m) => m.id)).toEqual(['b', 'a']);
  });

  it('con el hilo vacío devuelve nada', () => {
    expect(groupByDay([])).toEqual([]);
  });
});

describe('anchorFor', () => {
  it('coge el título del primer plato con nombre', () => {
    const anchor = anchorFor(
      { day: 1, slot: 'cena' },
      {
        sections: [
          { id: 's0', kind: 'pan', items: [] },
          { id: 's1', kind: 'plato', title: 'Dorada al horno', items: [] },
          { id: 's2', kind: 'plato', title: 'Ensalada', items: [] },
        ],
      },
    );

    expect(anchor).toEqual({ day: 1, slot: 'cena', title: 'Dorada al horno' });
    expect(anchorLabel(anchor)).toBe('Sobre la cena del martes · Dorada al horno');
  });

  it('sin bloque deja solo el día y la franja', () => {
    expect(anchorFor({ day: 6, slot: 'comida' }, null)).toEqual({ day: 6, slot: 'comida' });
  });

  it('sin ninguna sección con nombre tampoco inventa título', () => {
    const anchor = anchorFor(
      { day: 0, slot: 'desayuno' },
      {
        sections: [{ id: 's0', kind: 'plato', items: [] }],
      },
    );
    expect(anchor.title).toBeUndefined();
  });

  it('guarda la fecha cuando se le pasa, para saber de qué semana se hablaba', () => {
    expect(anchorFor({ day: 2, slot: 'comida' }, null, '2026-10-21').date).toBe('2026-10-21');
  });
});

describe('lastMessage', () => {
  it('devuelve el más reciente, venga en el orden que venga', () => {
    const ultimo = lastMessage([
      mensaje({ id: 'viejo', createdAt: '2026-10-17T09:00:00Z' }),
      mensaje({ id: 'nuevo', createdAt: '2026-10-18T09:00:00Z' }),
      mensaje({ id: 'medio', createdAt: '2026-10-17T20:00:00Z' }),
    ]);
    expect(ultimo?.id).toBe('nuevo');
  });

  it('es null si no hay nada', () => {
    expect(lastMessage([])).toBeNull();
  });
});
