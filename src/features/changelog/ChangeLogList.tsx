/**
 * El historial de cambios del hogar, agrupado por día.
 *
 * Vive fuera de la vista Más a propósito: la ficha del hogar de la fase 17 enseñará esta
 * misma lista, así que no sabe nada de dónde se la pinta.
 */
import { actorLabel, type ChangeGroup } from '../../domain/describeChange';
import { dayNameOf, shortDateOf } from '../../domain/format';
import { todayIn } from '../../domain/dates';

/** La fecha de una entrada, en día del calendario. */
function diaDe(createdAt: string): string {
  return createdAt.slice(0, 10);
}

function horaDe(createdAt: string): string {
  return new Date(createdAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

function tituloDelDia(dia: string): string {
  if (dia === todayIn()) return 'Hoy';
  return `${dayNameOf(dia)} ${shortDateOf(dia)}`;
}

export function ChangeLogList({
  groups,
  onRestore,
  labelOf,
  isLoading = false,
  vacio = 'Todavía no hay cambios. Aquí aparecerá cada vez que alguien mueva una comida o edite un plato.',
}: {
  groups: readonly ChangeGroup[];
  /** Si no se pasa, la lista es de solo lectura (ficha del hogar, fase 17). */
  onRestore?: (group: ChangeGroup) => void;
  /** Coletilla de cada línea. En el registro de la consulta entera, el hogar. */
  labelOf?: (group: ChangeGroup) => string | null;
  isLoading?: boolean;
  vacio?: string;
}) {
  if (isLoading) {
    return <p className="py-6 text-item text-ink-muted">Cargando el historial…</p>;
  }

  if (groups.length === 0) {
    return <p className="py-6 text-item text-ink-muted">{vacio}</p>;
  }

  // Agrupar por día conserva el orden, porque los grupos ya vienen de más nuevo a más viejo.
  const porDia = new Map<string, ChangeGroup[]>();
  for (const group of groups) {
    const dia = diaDe(group.createdAt);
    const lista = porDia.get(dia);
    if (lista) lista.push(group);
    else porDia.set(dia, [group]);
  }

  return (
    <div className="flex flex-col gap-5 pb-4">
      {[...porDia.entries()].map(([dia, delDia]) => (
        <section key={dia}>
          <h3 className="text-measure font-extrabold tracking-[0.06em] text-ink-muted uppercase">
            {tituloDelDia(dia)}
          </h3>

          <ul className="mt-1">
            {delDia.map((group) => (
              <li
                key={group.id}
                className="flex flex-wrap items-baseline gap-x-2 border-t border-line/70 py-2.5 first:border-t-0"
              >
                <span className="flex-1 text-item text-ink">
                  <strong className="font-semibold">{actorLabel(group)}</strong> {group.text}
                  {labelOf !== undefined && labelOf(group) !== null && (
                    <span className="ml-2 rounded-chip bg-bg px-2 py-0.5 text-measure text-ink-muted">
                      {labelOf(group)}
                    </span>
                  )}
                </span>

                <span className="text-measure text-ink-muted">{horaDe(group.createdAt)}</span>

                {onRestore !== undefined && group.kind !== 'other' && (
                  <button
                    type="button"
                    onClick={() => onRestore(group)}
                    className="min-h-tap w-full text-left text-measure font-semibold text-ink-muted underline"
                  >
                    Restaurar original
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
