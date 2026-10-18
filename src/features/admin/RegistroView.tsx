/**
 * Registro de toda la consulta: quién cambió qué y cuándo, en cada hogar.
 *
 * Lo escriben los triggers de Postgres, no la app, así que aquí aparece también lo que
 * llegó tarde desde un móvil sin cobertura. Es solo de añadir: nadie puede editarlo ni
 * borrarlo, tampoco desde aquí.
 *
 * Sirve para dos preguntas distintas: "¿qué ha pasado últimamente?" (sin filtros) y "¿este
 * cliente está tocando su dieta?" (filtrando por hogar y por quién). Los platos salen sin
 * nombre a propósito; para verlos con nombre está el Historial de cada hogar, que sí carga
 * su plan.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { describeChanges, type ActorRole } from '../../domain/describeChange';
import { useHouseholds } from '../../data/builder';
import { sinTitulos, useAllChanges } from '../../data/changelog';
import { ChangeLogList } from '../changelog/ChangeLogList';

const input = 'min-h-tap rounded-block border border-line bg-surface px-2 py-1 text-item text-ink';

type Quien = 'todos' | ActorRole;

export function RegistroView() {
  const households = useHouseholds();
  const cambios = useAllChanges(true);
  const [hogar, setHogar] = useState<string>('todos');
  const [quien, setQuien] = useState<Quien>('todos');

  const nombreDeHogar = useMemo(
    () => new Map((households.data ?? []).map((casa) => [casa.id, casa.name])),
    [households.data],
  );

  const filtrados = useMemo(
    () =>
      (cambios.data ?? []).filter(
        (entrada) =>
          (hogar === 'todos' || entrada.householdId === hogar) &&
          (quien === 'todos' || entrada.actorRole === quien),
      ),
    [cambios.data, hogar, quien],
  );

  // El hogar es de la transacción entera, así que se mira por `txId` después de agrupar.
  const hogarDeTx = useMemo(
    () => new Map(filtrados.map((entrada) => [entrada.txId, entrada.householdId])),
    [filtrados],
  );

  const grupos = useMemo(() => describeChanges(filtrados, sinTitulos), [filtrados]);

  return (
    <section className="rounded-day bg-surface p-6">
      <h1 className="text-dish font-bold text-ink">Registro</h1>
      <p className="mt-1 max-w-prose text-measure text-ink-muted">
        Lo último que se ha movido en la consulta. Lo escribe la base de datos, nadie puede
        borrarlo, y aparece aquí aunque se hiciera sin cobertura.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <label className="flex items-center gap-2 text-measure text-ink">
          Hogar
          <select
            value={hogar}
            onChange={(event) => setHogar(event.target.value)}
            className={input}
          >
            <option value="todos">Todos</option>
            {(households.data ?? []).map((casa) => (
              <option key={casa.id} value={casa.id}>
                {casa.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-measure text-ink">
          Quién
          <select
            value={quien}
            onChange={(event) => setQuien(event.target.value as Quien)}
            className={input}
          >
            <option value="todos">Todos</option>
            <option value="cliente">Los clientes</option>
            <option value="nutricionista">Vosotras</option>
            <option value="sistema">El sistema</option>
          </select>
        </label>

        {hogar !== 'todos' && (
          <Link
            to={`/admin/hogares/${hogar}`}
            className="min-h-tap self-center text-measure font-semibold text-ink-muted underline"
          >
            Ver la ficha de ese hogar
          </Link>
        )}
      </div>

      <div className="mt-2">
        <ChangeLogList
          groups={grupos}
          isLoading={cambios.isPending}
          labelOf={(group) =>
            hogar === 'todos' ? (nombreDeHogar.get(hogarDeTx.get(group.txId) ?? '') ?? null) : null
          }
          vacio={
            hogar === 'todos' && quien === 'todos'
              ? 'Todavía no hay cambios en ningún hogar.'
              : 'Nada con esos filtros.'
          }
        />
      </div>
    </section>
  );
}
