/**
 * Catálogo de alimentos.
 *
 * Importa más de lo que parece: la sección decide en qué orden aparece en la lista de la
 * compra (y por tanto el recorrido del súper), la unidad decide cómo se suman las
 * cantidades, y `batchable` es lo que luego sugiere cocinar de más.
 */
import { useMemo, useState } from 'react';
import { SupermarketSection, type Food } from '../../domain/schema';
import { useArchiveFood, useFoods, useSaveFood } from '../../data/library';

const SECCIONES = SupermarketSection.options;

const ETIQUETAS: Record<string, string> = {
  fruteria: 'Frutería',
  verduleria: 'Verdulería',
  carniceria: 'Carnicería',
  charcuteria: 'Charcutería',
  pescaderia: 'Pescadería',
  lacteos_huevos: 'Lácteos y huevos',
  panaderia: 'Panadería',
  despensa: 'Despensa',
  congelados: 'Congelados',
  suplementos: 'Suplementos',
  otros: 'Otros',
};

const input = 'min-h-tap rounded-block border border-line bg-surface px-2 py-1 text-item text-ink';

export function FoodsView() {
  const foods = useFoods();
  const save = useSaveFood();
  const archive = useArchiveFood();
  const [busqueda, setBusqueda] = useState('');

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLocaleLowerCase('es-ES');
    const todos = foods.data ?? [];
    return q === ''
      ? todos
      : todos.filter(
          (food) => food.name.toLocaleLowerCase('es-ES').includes(q) || food.key.includes(q),
        );
  }, [foods.data, busqueda]);

  const editar = (food: Food, cambio: Partial<Food>) => save.mutate({ ...food, ...cambio });

  return (
    <section className="rounded-day bg-surface p-6">
      <header className="flex flex-wrap items-baseline gap-3">
        <h1 className="text-dish font-bold text-ink">Alimentos</h1>
        <p className="flex-1 text-measure text-ink-muted">
          {foods.data?.length ?? 0} en el catálogo. La sección marca el orden en la lista de la
          compra; la unidad, cómo se suman las cantidades.
        </p>
      </header>

      <input
        type="search"
        value={busqueda}
        onChange={(event) => setBusqueda(event.target.value)}
        placeholder="Buscar alimento…"
        className={`mt-4 w-full max-w-sm ${input}`}
      />

      {foods.isPending && <p className="mt-6 text-item text-ink-muted">Cargando el catálogo…</p>}

      {foods.data?.length === 0 && (
        <p className="mt-6 text-item text-ink-muted">
          El catálogo está vacío. Se siembra con <code>npm run library:seed</code>.
        </p>
      )}

      {visibles.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-item">
            <thead>
              <tr className="border-b border-line text-left text-measure text-ink-muted">
                <th className="py-2 pr-3 font-semibold">Nombre</th>
                <th className="py-2 pr-3 font-semibold">Sección</th>
                <th className="py-2 pr-3 font-semibold">Unidad</th>
                <th className="py-2 pr-3 font-semibold">Batch</th>
                <th className="py-2 pr-3 font-semibold">Días</th>
                <th className="py-2 font-semibold" />
              </tr>
            </thead>
            <tbody>
              {visibles.map((food) => (
                <tr key={food.key} className="border-b border-line/60">
                  <td className="py-1.5 pr-3">
                    <input
                      defaultValue={food.name}
                      onBlur={(event) => {
                        const name = event.target.value.trim();
                        if (name !== '' && name !== food.name) editar(food, { name });
                      }}
                      className={`w-full min-w-48 ${input}`}
                      aria-label={`Nombre de ${food.name}`}
                    />
                  </td>
                  <td className="py-1.5 pr-3">
                    <select
                      value={food.section}
                      onChange={(event) =>
                        editar(food, { section: event.target.value as Food['section'] })
                      }
                      className={input}
                      aria-label={`Sección de ${food.name}`}
                    >
                      {SECCIONES.map((seccion) => (
                        <option key={seccion} value={seccion}>
                          {ETIQUETAS[seccion] ?? seccion}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-1.5 pr-3">
                    <select
                      value={food.unit}
                      onChange={(event) =>
                        editar(food, { unit: event.target.value as Food['unit'] })
                      }
                      className={input}
                      aria-label={`Unidad de ${food.name}`}
                    >
                      <option value="g">g</option>
                      <option value="ml">ml</option>
                      <option value="ud">ud</option>
                    </select>
                  </td>
                  <td className="py-1.5 pr-3">
                    <input
                      type="checkbox"
                      checked={food.batchable}
                      onChange={(event) => editar(food, { batchable: event.target.checked })}
                      className="size-5"
                      aria-label={`${food.name} apto para batch cooking`}
                    />
                  </td>
                  <td className="py-1.5 pr-3">
                    <input
                      type="number"
                      min={1}
                      defaultValue={food.keepsDays ?? ''}
                      onBlur={(event) => {
                        const valor = event.target.value.trim();
                        const dias = valor === '' ? undefined : Number(valor);
                        if (dias !== food.keepsDays) {
                          editar(food, dias === undefined ? {} : { keepsDays: dias });
                        }
                      }}
                      className={`w-20 ${input}`}
                      aria-label={`Días que aguanta ${food.name}`}
                    />
                  </td>
                  <td className="py-1.5 text-right">
                    <button
                      type="button"
                      onClick={() => archive.mutate(food.key)}
                      className="min-h-tap text-measure font-semibold text-ink-muted underline"
                    >
                      Archivar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-measure text-ink-muted">
        Archivar no borra: un alimento puede estar dentro de dietas ya publicadas y borrarlo dejaría
        esas raciones sin referencia.
      </p>
    </section>
  );
}
