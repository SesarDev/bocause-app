import { Icon } from '../../components/Icon';
import type { ItemChange } from '../../domain/diff';
import type { Food, FoodItem, ProfileId } from '../../domain/schema';
import {
  copyPortion,
  setPortionMeasure,
  setPortionNumber,
  toggleEater,
  type PortionField,
} from './draft';

const NUMBER_FIELDS: { field: PortionField; label: string; unit: string }[] = [
  { field: 'rawG', label: 'Crudo', unit: 'g' },
  { field: 'cookedG', label: 'Cocido', unit: 'g' },
  { field: 'ml', label: 'Líquido', unit: 'ml' },
  { field: 'units', label: 'Unidades', unit: 'ud' },
];

const CHANGE_STYLE: Record<ItemChange, string> = {
  igual: 'border-line',
  nuevo: 'border-accent bg-accent/10',
  cambiado: 'border-free bg-free/40',
};

export function ItemEditor({
  item,
  people,
  foods,
  change,
  canMoveUp,
  canMoveDown,
  onChange,
  onRemove,
  onMove,
}: {
  item: FoodItem;
  /** Personas del scope del bloque: una si es individual, las dos si es compartido. */
  people: { profileId: ProfileId; displayName: string }[];
  foods: readonly Food[];
  change: ItemChange;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onChange: (update: (item: FoodItem) => FoodItem) => void;
  onRemove: () => void;
  onMove: (delta: number) => void;
}) {
  const shared = people.length > 1;

  return (
    <li className={`rounded-block border p-3 ${CHANGE_STYLE[change]}`}>
      <div className="flex items-start gap-1">
        <span className="flex-1">
          <label className="block text-measure font-semibold text-ink" htmlFor={`label-${item.id}`}>
            Alimento
          </label>
          <input
            id={`label-${item.id}`}
            value={item.label}
            list="catalogo-alimentos"
            placeholder="Escribe o elige del catálogo"
            onChange={(event) => {
              const label = event.target.value;
              const match = foods.find(
                (food) => food.name.toLocaleLowerCase('es-ES') === label.toLocaleLowerCase('es-ES'),
              );
              onChange((current) => {
                const next = { ...current, label };
                if (match) next.foodKey = match.key;
                else delete next.foodKey;
                return next;
              });
            }}
            className="mt-1 min-h-tap w-full rounded-block border border-line bg-bg px-3 text-item text-ink"
          />
        </span>

        <span className="flex shrink-0 flex-col">
          <button
            type="button"
            disabled={!canMoveUp}
            onClick={() => onMove(-1)}
            aria-label="Subir alimento"
            className="grid size-9 place-items-center text-ink-muted disabled:opacity-30"
          >
            ↑
          </button>
          <button
            type="button"
            disabled={!canMoveDown}
            onClick={() => onMove(1)}
            aria-label="Bajar alimento"
            className="grid size-9 place-items-center text-ink-muted disabled:opacity-30"
          >
            ↓
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Quitar ${item.label || 'alimento'}`}
            className="grid size-9 place-items-center text-danger"
          >
            ×
          </button>
        </span>
      </div>

      {item.foodKey && (
        <p className="mt-1 text-measure text-ink-muted">Del catálogo: {item.foodKey}</p>
      )}

      {people.map((person, index) => {
        const portion = item.portions[person.profileId];
        const eats = portion !== undefined;
        const other = people[index === 0 ? 1 : 0];

        return (
          <div key={person.profileId} className="mt-3 border-t border-line/70 pt-2">
            <div className="flex items-center gap-2">
              <label className="flex flex-1 items-center gap-2 text-item font-semibold text-ink">
                <input
                  type="checkbox"
                  checked={eats}
                  onChange={(event) =>
                    onChange((current) =>
                      toggleEater(current, person.profileId, event.target.checked),
                    )
                  }
                  className="size-5 accent-[var(--color-check)]"
                />
                {shared ? person.displayName : 'Cantidad'}
              </label>

              {shared && eats && other && item.portions[other.profileId] && (
                <button
                  type="button"
                  onClick={() =>
                    onChange((current) => copyPortion(current, other.profileId, person.profileId))
                  }
                  className="min-h-tap rounded-chip border border-line px-2 text-measure font-semibold text-ink"
                >
                  Copiar de {other.displayName}
                </button>
              )}
            </div>

            {eats && (
              <>
                <div className="mt-2 grid grid-cols-4 gap-2">
                  {NUMBER_FIELDS.map(({ field, label, unit }) => (
                    <span key={field}>
                      <label
                        className="block text-[0.6875rem] font-semibold text-ink-muted"
                        htmlFor={`${item.id}-${person.profileId}-${field}`}
                      >
                        {label}
                      </label>
                      <input
                        id={`${item.id}-${person.profileId}-${field}`}
                        inputMode="decimal"
                        value={portion[field] ?? ''}
                        placeholder={unit}
                        onChange={(event) =>
                          onChange((current) =>
                            setPortionNumber(current, person.profileId, field, event.target.value),
                          )
                        }
                        className="min-h-tap w-full rounded-block border border-line bg-bg px-2 text-measure text-ink"
                      />
                    </span>
                  ))}
                </div>

                <label
                  className="mt-2 block text-[0.6875rem] font-semibold text-ink-muted"
                  htmlFor={`${item.id}-${person.profileId}-medida`}
                >
                  Medida de casa
                </label>
                <input
                  id={`${item.id}-${person.profileId}-medida`}
                  value={portion.measure ?? ''}
                  placeholder="3 lonchas finas, al gusto…"
                  onChange={(event) =>
                    onChange((current) =>
                      setPortionMeasure(current, person.profileId, event.target.value),
                    )
                  }
                  className="min-h-tap w-full rounded-block border border-line bg-bg px-3 text-measure text-ink"
                />
              </>
            )}
          </div>
        );
      })}

      {change !== 'igual' && (
        <p className="mt-2 flex items-center gap-1 text-measure font-semibold text-ink-muted">
          <Icon name="libre" size={13} />
          {change === 'nuevo' ? 'Añadido' : 'Cambiado'}
        </p>
      )}
    </li>
  );
}
