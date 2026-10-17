/**
 * Publicar una dieta.
 *
 * Lo importante de esta pantalla no es el botón: es **enseñar antes de confirmar** qué va a
 * pasar con los cambios que el cliente lleva haciendo. `carryOver` decide; aquí solo se
 * muestra y se deja decidir celda a celda cuando los dos han tocado lo mismo.
 *
 * Por defecto gana la nutricionista (decisión 3 de `docs/PLAN.md`), pero nunca en silencio.
 */
import { useMemo, useState } from 'react';
import { carryOver, type Conflict } from '../../domain/carryOver';
import { DAY_NAMES, addDays, currentWeekStart } from '../../domain/dates';
import { cellId } from '../../domain/resolve';
import type { Plan } from '../../domain/schema';
import { usePublishPlan } from '../../data/builder';
import {
  useEditedBlocks,
  usePlan,
  useProfileDirectory,
  useTemplateCells,
  useWeekOverrides,
} from '../../data/queries';

function tituloDe(plan: Plan | null | undefined, blockId: string | null): string {
  if (plan == null || blockId === null) return 'nada';
  const block = plan.blocks.find((candidate) => candidate.id === blockId);
  if (block === undefined) return '(ya no existe)';
  return block.sections.find((section) => section.title !== undefined)?.title ?? 'sin nombre';
}

export function PublishPanel({
  householdId,
  borrador,
  onCerrar,
}: {
  householdId: string;
  borrador: Plan;
  onCerrar: () => void;
}) {
  // Por defecto, el lunes que viene: publicar a mitad de semana partiría la semana en dos
  // dietas, y la base de datos lo rechaza igualmente.
  const [validFrom, setValidFrom] = useState(() => addDays(currentWeekStart(), 7));
  const [mantenerCliente, setMantenerCliente] = useState<Set<string>>(new Set());

  const scopes = useProfileDirectory();
  const planVigente = usePlan();
  const bloques = useEditedBlocks(planVigente.data?.id, scopes);
  const celdas = useTemplateCells(planVigente.data?.id, scopes);
  const overrides = useWeekOverrides(planVigente.data?.id, validFrom, scopes);
  const publish = usePublishPlan();

  const resultado = useMemo(() => {
    if (!planVigente.data) return null;
    return carryOver({
      prevPlan: planVigente.data,
      prevEditedBlocks: bloques.data ?? [],
      prevTemplateCells: celdas.data ?? [],
      prevOverrides: overrides.data ?? [],
      nextPlan: borrador,
      validFrom,
      keepClient: mantenerCliente,
    });
  }, [
    planVigente.data,
    bloques.data,
    celdas.data,
    overrides.data,
    borrador,
    validFrom,
    mantenerCliente,
  ]);

  const alternar = (conflict: Conflict) => {
    const clave = cellId(conflict.cell);
    const siguiente = new Set(mantenerCliente);
    if (siguiente.has(clave)) siguiente.delete(clave);
    else siguiente.add(clave);
    setMantenerCliente(siguiente);
  };

  const publicar = () => {
    if (resultado === null || scopes === undefined) return;
    publish.mutate(
      {
        householdId,
        planId: crypto.randomUUID(),
        plan: borrador,
        validFrom,
        cells: borrador.template,
        carry: resultado,
        scopes,
      },
      { onSuccess: onCerrar },
    );
  };

  const esLunes = new Date(`${validFrom}T00:00:00Z`).getUTCDay() === 1;

  return (
    <aside className="mt-5 rounded-block border border-line p-4">
      <header className="flex flex-wrap items-center gap-2">
        <h2 className="flex-1 text-item font-bold text-ink">Publicar la dieta</h2>
        <button
          type="button"
          onClick={onCerrar}
          className="min-h-tap text-measure font-semibold text-ink-muted underline"
        >
          Cancelar
        </button>
      </header>

      <label className="mt-3 flex flex-wrap items-center gap-2 text-measure text-ink">
        Empieza el
        <input
          type="date"
          value={validFrom}
          onChange={(event) => setValidFrom(event.target.value)}
          className="min-h-tap rounded-block border border-line bg-surface px-2 text-item text-ink"
        />
        {!esLunes && (
          <span className="text-danger">Tiene que ser lunes: las semanas empiezan en lunes.</span>
        )}
      </label>

      {resultado === null ? (
        <p className="mt-4 text-item text-ink-muted">Cargando la dieta vigente…</p>
      ) : (
        <>
          <p className="mt-4 text-item text-ink">
            Se conservan <strong>{resultado.cells.length}</strong> cambios del cliente
            {resultado.blocks.length > 0 && (
              <>
                {' '}
                y <strong>{resultado.blocks.length}</strong> platos que había editado
              </>
            )}
            {resultado.overrides.length > 0 && (
              <>
                , además de <strong>{resultado.overrides.length}</strong> ajustes de semanas futuras
              </>
            )}
            .
          </p>

          {resultado.conflicts.length === 0 ? (
            <p className="mt-2 text-measure text-ink-muted">
              No hay conflictos: no has tocado ninguna celda que el cliente hubiera cambiado.
            </p>
          ) : (
            <div className="mt-4">
              <h3 className="text-measure font-extrabold tracking-[0.06em] text-ink-muted uppercase">
                {resultado.conflicts.length}{' '}
                {resultado.conflicts.length === 1 ? 'conflicto' : 'conflictos'}
              </h3>
              <p className="mt-1 max-w-prose text-measure text-ink-muted">
                Celdas que habéis cambiado los dos. Gana lo tuyo salvo que marques lo contrario.
              </p>

              <ul className="mt-2 flex flex-col gap-2">
                {resultado.conflicts.map((conflict) => {
                  const clave = cellId(conflict.cell);
                  const delCliente = tituloDe(planVigente.data, conflict.clientBlockId);
                  const tuyo = tituloDe(borrador, conflict.nextBlockId);

                  return (
                    <li
                      key={clave}
                      className="flex flex-wrap items-center gap-2 border-t border-line/60 pt-2"
                    >
                      <span className="flex-1 text-measure text-ink">
                        <strong className="font-semibold">
                          {conflict.cell.slot.toUpperCase()} · {DAY_NAMES[conflict.cell.day]}
                        </strong>{' '}
                        — el cliente tenía {delCliente}; tú pones {tuyo}.
                        {conflict.orphan && (
                          <span className="text-danger">
                            {' '}
                            Su plato no existe en la dieta nueva, así que no se puede mantener.
                          </span>
                        )}
                      </span>

                      {!conflict.orphan && (
                        <label className="flex items-center gap-1 text-measure text-ink">
                          <input
                            type="checkbox"
                            checked={mantenerCliente.has(clave)}
                            onChange={() => alternar(conflict)}
                          />
                          Mantener el suyo
                        </label>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {publish.isError && (
            <p role="alert" className="mt-3 text-measure text-danger">
              No se pudo publicar:{' '}
              {publish.error instanceof Error ? publish.error.message : 'error desconocido'}
            </p>
          )}

          <button
            type="button"
            disabled={!esLunes || publish.isPending || scopes === undefined}
            onClick={publicar}
            className="mt-4 min-h-tap rounded-block bg-slot px-4 text-item font-semibold text-slot-ink disabled:opacity-40"
          >
            {publish.isPending ? 'Publicando…' : 'Publicar'}
          </button>
        </>
      )}
    </aside>
  );
}
