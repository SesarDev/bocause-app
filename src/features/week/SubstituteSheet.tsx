/**
 * "Sustituir por…": cambiar un alimento por un equivalente.
 *
 * Las opciones y las cantidades no se inventan aquí: salen de los grupos de equivalencia
 * que define la nutricionista (`equivalentsFor`). Si un alimento no está en ninguno, esta
 * hoja no se abre.
 *
 * Dos decisiones que la persona tiene que poder tomar, y por eso están a la vista:
 *
 * - **Para los dos / Solo para mí**, en los platos compartidos. Cambiar las lentejas por
 *   garbanzos no tiene por qué cambiárselas también al otro.
 * - **Solo esta semana / Todo el plan**, el mismo patrón que el intercambio y la edición.
 */
import { useState } from 'react';
import { Sheet } from '../../components/Sheet';
import { formatPortion } from '../../domain/format';
import { equivalentsFor } from '../../domain/library';
import { substituteItem, type SubstitutionMode } from '../../domain/substitute';
import type { SwapLevel } from '../../domain/swap';
import type { Block, EquivalenceGroup, Food, FoodItem, ProfileId } from '../../domain/schema';

export function SubstituteSheet({
  open,
  block,
  item,
  profileId,
  shared,
  groups,
  foods,
  onClose,
  onApply,
}: {
  open: boolean;
  block: Block | null;
  item: FoodItem | null;
  profileId: ProfileId;
  shared: boolean;
  groups: readonly EquivalenceGroup[];
  foods: readonly Food[];
  onClose: () => void;
  onApply: (block: Block, level: SwapLevel) => void;
}) {
  const [mode, setMode] = useState<SubstitutionMode>('todos');
  const [level, setLevel] = useState<SwapLevel>('week');

  const miPortion = item?.portions[profileId];
  const opciones =
    item === null || miPortion === undefined ? [] : equivalentsFor(item.foodKey, miPortion, groups);

  /**
   * El nombre del catálogo. Si el grupo apunta a un alimento que ya no está (archivado, o
   * una clave escrita a mano), se compone uno legible: enseñar "pasta-integral" a alguien
   * que está decidiendo qué cena es enseñarle las tripas de la base de datos.
   */
  const nombreDe = (foodKey: string) => {
    const delCatalogo = foods.find((food) => food.key === foodKey)?.name;
    if (delCatalogo !== undefined) return delCatalogo;
    const apaño = foodKey.replace(/-/g, ' ');
    return apaño.charAt(0).toLocaleUpperCase('es-ES') + apaño.slice(1);
  };

  const aplicar = (foodKey: string) => {
    if (block === null || item === null) return;

    const cambiado = substituteItem(
      block,
      item.id,
      {
        foodKey,
        label: nombreDe(foodKey),
        // Cada persona convierte SU ración: en un plato compartido no comen lo mismo.
        convert: (portion) =>
          equivalentsFor(item.foodKey, portion, groups).find(
            (candidate) => candidate.foodKey === foodKey,
          )?.portion ?? portion,
      },
      { mode: shared ? mode : 'todos', profileId, newId: () => crypto.randomUUID() },
    );

    onApply(cambiado, level);
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title={item === null ? '' : `Cambiar ${item.label}`}>
      {item !== null && (
        <div className="pb-2">
          {opciones.length === 0 ? (
            <p className="text-item text-ink-muted">
              No hay equivalentes para este alimento. Los define tu nutricionista.
            </p>
          ) : (
            <>
              {shared && (
                <div className="flex gap-2">
                  {(
                    [
                      ['todos', 'Para los dos'],
                      ['solo-yo', 'Solo para mí'],
                    ] as const
                  ).map(([clave, texto]) => (
                    <button
                      key={clave}
                      type="button"
                      onClick={() => setMode(clave)}
                      aria-pressed={mode === clave}
                      className={`min-h-tap flex-1 rounded-block px-3 text-item font-semibold ${
                        mode === clave ? 'bg-slot text-slot-ink' : 'border border-line text-ink'
                      }`}
                    >
                      {texto}
                    </button>
                  ))}
                </div>
              )}

              <div className="mt-2 flex gap-2">
                {(
                  [
                    ['week', 'Solo esta semana'],
                    ['template', 'Todo el plan'],
                  ] as const
                ).map(([clave, texto]) => (
                  <button
                    key={clave}
                    type="button"
                    onClick={() => setLevel(clave)}
                    aria-pressed={level === clave}
                    className={`min-h-tap flex-1 rounded-block px-3 text-measure font-semibold ${
                      level === clave ? 'bg-slot text-slot-ink' : 'border border-line text-ink'
                    }`}
                  >
                    {texto}
                  </button>
                ))}
              </div>

              <ul className="mt-4 flex flex-col gap-2">
                {opciones.map((opcion) => {
                  const { amount } = formatPortion(opcion.portion);
                  return (
                    <li key={opcion.foodKey}>
                      <button
                        type="button"
                        onClick={() => aplicar(opcion.foodKey)}
                        className="flex min-h-tap w-full flex-wrap items-baseline gap-x-2 rounded-block border border-line px-4 py-3 text-left"
                      >
                        <span className="flex-1 text-item font-semibold text-ink">
                          {nombreDe(opcion.foodKey)}
                        </span>
                        {amount !== '' && (
                          <span className="text-item font-semibold text-ink">{amount}</span>
                        )}
                        <span className="w-full text-measure text-ink-muted">
                          {opcion.groupName}
                          {opcion.note !== undefined && ` · ${opcion.note}`}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      )}
    </Sheet>
  );
}
