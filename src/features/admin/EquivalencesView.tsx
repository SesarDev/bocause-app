/**
 * Grupos de equivalencia: por qué puede cambiarse un alimento y en qué cantidad.
 *
 * La app **no inventa equivalencias** (regla de CLAUDE.md): aquí solo se guarda lo que
 * decide la nutricionista. El factor dice cuánto cunde cada alimento dentro del grupo; con
 * factores iguales, misma cantidad. La vista previa enseña el resultado antes de guardar,
 * porque un factor mal puesto se traduce en que alguien coma el doble de lo que debe.
 */
import { useMemo, useState } from 'react';
import { equivalentsFor } from '../../domain/library';
import type { EquivalenceGroup, Food } from '../../domain/schema';
import { useEquivalenceGroups, useFoods, useSaveEquivalenceGroup } from '../../data/library';

const input = 'min-h-tap rounded-block border border-line bg-surface px-2 py-1 text-item text-ink';

function nombreDe(foods: readonly Food[], key: string): string {
  return foods.find((food) => food.key === key)?.name ?? key;
}

function unidadDe(foods: readonly Food[], key: string): string {
  return foods.find((food) => food.key === key)?.unit ?? 'g';
}

/** Vista previa: "140 g de lentejas → 140 g de garbanzos". */
function Preview({ group, foods }: { group: EquivalenceGroup; foods: readonly Food[] }) {
  const origen = group.members[0];
  if (origen === undefined || group.members.length < 2) {
    return (
      <p className="text-measure text-ink-muted">
        Añade al menos dos alimentos para ver la equivalencia.
      </p>
    );
  }

  const cantidad = 100;
  const opciones = equivalentsFor(origen.foodKey, { rawG: cantidad }, [group]);

  return (
    <ul className="flex flex-col gap-1">
      {opciones.map((opcion) => (
        <li key={opcion.foodKey} className="text-measure text-ink">
          {cantidad} {unidadDe(foods, origen.foodKey)} de{' '}
          <strong className="font-semibold">{nombreDe(foods, origen.foodKey)}</strong> →{' '}
          {opcion.portion.rawG} {unidadDe(foods, opcion.foodKey)} de{' '}
          <strong className="font-semibold">{nombreDe(foods, opcion.foodKey)}</strong>
          {opcion.note !== undefined && <span className="text-ink-muted"> · {opcion.note}</span>}
        </li>
      ))}
    </ul>
  );
}

function GroupCard({ group, foods }: { group: EquivalenceGroup; foods: readonly Food[] }) {
  const save = useSaveEquivalenceGroup();
  const [draft, setDraft] = useState<EquivalenceGroup>(group);
  const sucio = JSON.stringify(draft) !== JSON.stringify(group);

  const sinUsar = foods.filter(
    (food) => !draft.members.some((member) => member.foodKey === food.key),
  );

  return (
    <article className="rounded-block border border-line p-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={draft.name}
          onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          className={`flex-1 min-w-48 ${input} font-semibold`}
          aria-label="Nombre del grupo"
        />
        <button
          type="button"
          disabled={!sucio || draft.name.trim() === ''}
          onClick={() => save.mutate(draft)}
          className="min-h-tap rounded-block bg-slot px-4 text-item font-semibold text-slot-ink disabled:opacity-40"
        >
          Guardar
        </button>
        <button
          type="button"
          onClick={() => save.mutate({ ...draft, archived: !draft.archived })}
          className="min-h-tap text-measure font-semibold text-ink-muted underline"
        >
          {draft.archived ? 'Desarchivar' : 'Archivar'}
        </button>
      </div>

      <input
        value={draft.description ?? ''}
        onChange={(event) => setDraft({ ...draft, description: event.target.value })}
        placeholder="Para qué sirve este grupo (opcional)"
        className={`mt-2 w-full ${input}`}
        aria-label="Descripción del grupo"
      />

      <ul className="mt-3 flex flex-col gap-2">
        {draft.members.map((member, index) => (
          <li key={member.foodKey} className="flex flex-wrap items-center gap-2">
            <span className="flex-1 min-w-40 text-item text-ink">
              {nombreDe(foods, member.foodKey)}
            </span>

            <label className="flex items-center gap-1 text-measure text-ink-muted">
              Factor
              <input
                type="number"
                step="0.05"
                min="0.05"
                value={member.factor}
                onChange={(event) => {
                  const factor = Number(event.target.value);
                  if (factor <= 0) return;
                  const members = [...draft.members];
                  members[index] = { ...member, factor };
                  setDraft({ ...draft, members });
                }}
                className={`w-24 ${input}`}
              />
            </label>

            <input
              value={member.note ?? ''}
              onChange={(event) => {
                const members = [...draft.members];
                members[index] = { ...member, note: event.target.value };
                setDraft({ ...draft, members });
              }}
              placeholder="Nota (opcional)"
              className={`w-48 ${input}`}
              aria-label={`Nota de ${nombreDe(foods, member.foodKey)}`}
            />

            <button
              type="button"
              onClick={() =>
                setDraft({
                  ...draft,
                  members: draft.members.filter((m) => m.foodKey !== member.foodKey),
                })
              }
              className="min-h-tap text-measure font-semibold text-ink-muted underline"
            >
              Quitar
            </button>
          </li>
        ))}
      </ul>

      <select
        value=""
        onChange={(event) => {
          const foodKey = event.target.value;
          if (foodKey === '') return;
          setDraft({ ...draft, members: [...draft.members, { foodKey, factor: 1 }] });
        }}
        className={`mt-3 ${input}`}
        aria-label="Añadir alimento al grupo"
      >
        <option value="">Añadir alimento…</option>
        {sinUsar.map((food) => (
          <option key={food.key} value={food.key}>
            {food.name}
          </option>
        ))}
      </select>

      <div className="mt-4 rounded-block bg-bg p-3">
        <h3 className="text-measure font-extrabold tracking-[0.06em] text-ink-muted uppercase">
          Cómo queda
        </h3>
        <div className="mt-1">
          <Preview group={draft} foods={foods} />
        </div>
      </div>
    </article>
  );
}

export function EquivalencesView() {
  const groups = useEquivalenceGroups();
  const foods = useFoods();
  const save = useSaveEquivalenceGroup();

  const lista = useMemo(() => groups.data ?? [], [groups.data]);

  return (
    <section className="rounded-day bg-surface p-6">
      <header className="flex flex-wrap items-baseline gap-3">
        <h1 className="text-dish font-bold text-ink">Equivalencias</h1>
        <p className="flex-1 text-measure text-ink-muted">
          Qué puede cambiarse por qué, y en qué cantidad. La app no inventa ninguna: solo existen
          las que pongas aquí.
        </p>
        <button
          type="button"
          onClick={() =>
            save.mutate({
              id: crypto.randomUUID(),
              name: 'Grupo nuevo',
              members: [],
              archived: false,
            })
          }
          className="min-h-tap rounded-block bg-slot px-4 text-item font-semibold text-slot-ink"
        >
          Nuevo grupo
        </button>
      </header>

      {groups.isPending && <p className="mt-6 text-item text-ink-muted">Cargando…</p>}

      {lista.length === 0 && !groups.isPending && (
        <p className="mt-6 max-w-prose text-item text-ink-muted">
          No hay ningún grupo todavía. El seed no los crea a propósito: las equivalencias son
          criterio tuyo, no algo que la app pueda deducir del plan.
        </p>
      )}

      <div className="mt-4 flex flex-col gap-4">
        {lista.map((group) => (
          <GroupCard key={group.id} group={group} foods={foods.data ?? []} />
        ))}
      </div>
    </section>
  );
}
