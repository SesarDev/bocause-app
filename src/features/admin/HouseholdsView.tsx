/**
 * Los hogares de la consulta, con su dieta vigente.
 *
 * De momento es la puerta al constructor. La ficha completa —adherencia de la semana,
 * historial, "ver como el cliente"— llega en la fase 17.
 */
import { Link } from 'react-router-dom';
import { shortDateOf } from '../../domain/format';
import { useHouseholds } from '../../data/builder';

export function HouseholdsView() {
  const households = useHouseholds();

  return (
    <section className="rounded-day bg-surface p-6">
      <h1 className="text-dish font-bold text-ink">Hogares</h1>
      <p className="mt-1 text-measure text-ink-muted">
        {households.data?.length ?? 0} en la consulta.
      </p>

      {households.isPending && <p className="mt-6 text-item text-ink-muted">Cargando…</p>}

      <ul className="mt-4 flex flex-col gap-3">
        {(households.data ?? []).map((household) => (
          <li
            key={household.id}
            className="flex flex-wrap items-center gap-3 rounded-block border border-line p-4"
          >
            <span className="flex-1">
              <span className="block text-item font-semibold text-ink">{household.name}</span>
              <span className="block text-measure text-ink-muted">
                {household.people.map((person) => person.displayName).join(' y ') || 'Sin personas'}
              </span>
            </span>

            <span className="text-measure text-ink-muted">
              {household.plan === null ? (
                'Sin dieta vigente'
              ) : (
                <>
                  {household.plan.name} · v{household.plan.version} · desde{' '}
                  {shortDateOf(household.plan.validFrom)}
                </>
              )}
            </span>

            <Link
              to={`/admin/hogares/${household.id}/dieta`}
              className="min-h-tap rounded-block bg-slot px-4 py-2 text-item font-semibold text-slot-ink"
            >
              Editar dieta
            </Link>
          </li>
        ))}
      </ul>

      <p className="mt-4 max-w-prose text-measure text-ink-muted">
        Crear hogares y personas, el seguimiento de la semana y "ver como el cliente" llegan en la
        fase 17.
      </p>
    </section>
  );
}
