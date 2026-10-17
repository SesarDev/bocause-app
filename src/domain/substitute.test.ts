/**
 * Sustituciones por equivalentes.
 *
 * Lo que se comprueba es lo que acaba en el plato de cada uno: que cambiar lo mío no toque
 * lo del otro, que la lista de la compra se entere, y que se pueda volver atrás.
 */
import { describe, expect, it } from 'vitest';
import { equivalentsFor } from './library';
import { replacedLabel, substituteItem, type Replacement } from './substitute';
import { buildShoppingList } from './shopping';
import type { Block, EquivalenceGroup, Food, Portion } from './schema';

const grupos: EquivalenceGroup[] = [
  {
    id: 'g1',
    name: 'Legumbres',
    archived: false,
    members: [
      { foodKey: 'lentejas', factor: 1 },
      { foodKey: 'garbanzos', factor: 1 },
      { foodKey: 'soja', factor: 0.5, note: 'Pesa en seco' },
    ],
  },
];

/** Igual que hace la interfaz: pide los equivalentes y arma el reemplazo. */
function reemplazoA(foodKey: string, nombre: string): Replacement {
  return {
    foodKey,
    label: nombre,
    convert: (portion: Portion) => {
      const opcion = equivalentsFor('lentejas', portion, grupos).find(
        (candidate) => candidate.foodKey === foodKey,
      );
      return opcion?.portion ?? portion;
    },
  };
}

const bloqueCompartido: Block = {
  id: 'b1',
  planId: 'p',
  slot: 'comida',
  scope: 'shared',
  isOriginal: true,
  sections: [
    {
      id: 's1',
      kind: 'plato',
      title: 'Lentejas con verduras',
      items: [
        {
          id: 'i-lentejas',
          foodKey: 'lentejas',
          label: 'Lentejas',
          portions: { cristina: { rawG: 100 }, andres: { rawG: 140 } },
        },
        { id: 'i-tomate', label: 'Tomate', portions: { cristina: {}, andres: {} } },
      ],
    },
  ],
};

const newId = () => 'nuevo';

describe('substituteItem · para los dos', () => {
  const resultado = substituteItem(
    bloqueCompartido,
    'i-lentejas',
    reemplazoA('garbanzos', 'Garbanzos'),
    { mode: 'todos', profileId: 'cristina', newId },
  );
  const item = resultado.sections[0]!.items[0]!;

  it('cambia el alimento para todo el mundo', () => {
    expect(item.label).toBe('Garbanzos');
    expect(item.foodKey).toBe('garbanzos');
  });

  it('convierte la ración de cada persona por separado', () => {
    // A igual factor, misma cantidad, pero cada uno con la suya.
    expect(item.portions['cristina']).toEqual({ rawG: 100 });
    expect(item.portions['andres']).toEqual({ rawG: 140 });
  });

  it('recuerda de qué se cambió', () => {
    expect(item.replaces).toEqual({ foodKey: 'lentejas', label: 'Lentejas' });
    expect(replacedLabel(item)).toBe('En lugar de lentejas');
  });

  it('no toca los demás alimentos del plato', () => {
    expect(resultado.sections[0]!.items[1]!.label).toBe('Tomate');
  });

  it('no muta el bloque original', () => {
    expect(bloqueCompartido.sections[0]!.items[0]!.label).toBe('Lentejas');
  });

  it('aplica el factor cuando los alimentos no cunden igual', () => {
    const conSoja = substituteItem(
      bloqueCompartido,
      'i-lentejas',
      reemplazoA('soja', 'Soja texturizada'),
      { mode: 'todos', profileId: 'cristina', newId },
    );
    // La soja cunde el doble: hacen falta 200 g para igualar 100 g de lentejas.
    expect(conSoja.sections[0]!.items[0]!.portions['cristina']).toEqual({ rawG: 200 });
  });
});

describe('substituteItem · solo para mí', () => {
  const resultado = substituteItem(
    bloqueCompartido,
    'i-lentejas',
    reemplazoA('garbanzos', 'Garbanzos'),
    { mode: 'solo-yo', profileId: 'cristina', newId },
  );
  const items = resultado.sections[0]!.items;

  it('deja el original con la ración del otro, intacta', () => {
    const original = items.find((item) => item.label === 'Lentejas');
    expect(original?.portions).toEqual({ andres: { rawG: 140 } });
  });

  it('crea un alimento nuevo solo con mi ración', () => {
    const mio = items.find((item) => item.label === 'Garbanzos');
    expect(mio?.portions).toEqual({ cristina: { rawG: 100 } });
    expect(mio?.id).toBe('nuevo');
  });

  it('el otro sigue comiendo exactamente lo mismo que antes', () => {
    const antes = bloqueCompartido.sections[0]!.items[0]!.portions['andres'];
    const original = items.find((item) => item.label === 'Lentejas');
    expect(original?.portions['andres']).toEqual(antes);
  });

  it('si no quedaba nadie más, el original desaparece', () => {
    const soloMio: Block = {
      ...bloqueCompartido,
      sections: [
        {
          id: 's',
          kind: 'plato',
          items: [
            {
              id: 'i-lentejas',
              foodKey: 'lentejas',
              label: 'Lentejas',
              portions: { cristina: { rawG: 100 } },
            },
          ],
        },
      ],
    };

    const salida = substituteItem(soloMio, 'i-lentejas', reemplazoA('garbanzos', 'Garbanzos'), {
      mode: 'solo-yo',
      profileId: 'cristina',
      newId,
    });

    expect(salida.sections[0]!.items).toHaveLength(1);
    expect(salida.sections[0]!.items[0]!.label).toBe('Garbanzos');
  });

  it('no hace nada si ese alimento no lo como yo', () => {
    const salida = substituteItem(bloqueCompartido, 'i-lentejas', reemplazoA('garbanzos', 'G'), {
      mode: 'solo-yo',
      profileId: 'alguien-que-no-come',
      newId,
    });
    expect(salida.sections[0]!.items).toHaveLength(2);
  });
});

describe('substituteItem · casos límite', () => {
  it('devuelve el mismo bloque si el alimento no existe', () => {
    const salida = substituteItem(bloqueCompartido, 'no-existe', reemplazoA('garbanzos', 'G'), {
      mode: 'todos',
      profileId: 'cristina',
      newId,
    });
    expect(salida).toBe(bloqueCompartido);
  });

  it('volver al alimento de partida deja de marcarlo como sustitución', () => {
    // Sin esto quedaba un "Arroz integral en lugar de arroz integral".
    const ida = substituteItem(
      bloqueCompartido,
      'i-lentejas',
      reemplazoA('garbanzos', 'Garbanzos'),
      {
        mode: 'todos',
        profileId: 'cristina',
        newId,
      },
    );
    const vuelta = substituteItem(ida, 'i-lentejas', reemplazoA('lentejas', 'Lentejas'), {
      mode: 'todos',
      profileId: 'cristina',
      newId,
    });

    const item = vuelta.sections[0]!.items[0]!;
    expect(item.label).toBe('Lentejas');
    expect(item.replaces).toBeUndefined();
    expect(replacedLabel(item)).toBeNull();
  });

  it('sustituir dos veces sigue recordando el alimento del plan', () => {
    // Si guardara el paso intermedio, "En lugar de…" acabaría mintiendo.
    const una = substituteItem(
      bloqueCompartido,
      'i-lentejas',
      reemplazoA('garbanzos', 'Garbanzos'),
      {
        mode: 'todos',
        profileId: 'cristina',
        newId,
      },
    );
    const dos = substituteItem(una, 'i-lentejas', reemplazoA('soja', 'Soja'), {
      mode: 'todos',
      profileId: 'cristina',
      newId,
    });

    expect(dos.sections[0]!.items[0]!.replaces?.label).toBe('Lentejas');
  });
});

describe('la lista de la compra se entera de la sustitución', () => {
  const foods: Food[] = [
    { key: 'lentejas', name: 'Lentejas', section: 'despensa', unit: 'g', batchable: false },
    { key: 'garbanzos', name: 'Garbanzos', section: 'despensa', unit: 'g', batchable: false },
  ];

  /** Una semana mínima con un solo día y ese plato. */
  function semanaCon(block: Block) {
    return [
      {
        profileId: 'cristina',
        weekStart: '2026-10-12',
        days: [
          {
            date: '2026-10-12',
            day: 0,
            training: null,
            slots: [
              {
                cell: { day: 0, slot: 'comida' as const, scope: 'shared' },
                slot: 'comida' as const,
                // La fecha vive en la franja, no solo en el día: es la que usa la compra
                // para saber si entra en el rango pedido.
                date: '2026-10-12',
                block,
                source: 'original' as const,
                isFree: false,
              },
            ],
          },
        ],
      },
    ];
  }

  it('compra garbanzos y no lentejas', () => {
    const cambiado = substituteItem(
      bloqueCompartido,
      'i-lentejas',
      reemplazoA('garbanzos', 'Garbanzos'),
      { mode: 'todos', profileId: 'cristina', newId },
    );

    const lista = buildShoppingList({
      weeks: semanaCon(cambiado) as never,
      foods,
      from: '2026-10-12',
      // `to` es exclusivo: con la misma fecha que `from`, la comida quedaría fuera.
      to: '2026-10-13',
    });

    const etiquetas = lista.groups.flatMap((group) => group.lines.map((line) => line.foodKey));
    expect(etiquetas).toContain('garbanzos');
    expect(etiquetas).not.toContain('lentejas');
  });
});
