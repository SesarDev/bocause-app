/**
 * Los hogares de la consulta.
 *
 * Crear hogares y personas va por RPC (`staff_create_household`, `staff_upsert_profile`) y
 * no por escritura directa: la 0002 limitó `profiles` a la columna `theme` con un permiso
 * por columna, y ese candado alcanza también a la nutricionista (ver 0004).
 *
 * El aviso de datos de prueba no es decorativo: hasta la revisión legal del hito K no hay
 * consentimiento ni política de privacidad, y aquí se guardan datos de salud de personas.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { shortDateOf } from '../../domain/format';
import { useCreateHousehold, useHouseholds, useUpsertProfile } from '../../data/builder';

const input = 'min-h-tap rounded-block border border-line bg-surface px-2 py-1 text-item text-ink';

function NuevoHogar() {
  const crear = useCreateHousehold();
  const [nombre, setNombre] = useState('');

  return (
    <form
      className="mt-4 flex flex-wrap items-center gap-2 rounded-block border border-line p-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (nombre.trim() === '') return;
        crear.mutate(nombre.trim(), { onSuccess: () => setNombre('') });
      }}
    >
      <label className="flex flex-1 items-center gap-2 text-measure text-ink">
        Hogar nuevo
        <input
          value={nombre}
          onChange={(event) => setNombre(event.target.value)}
          placeholder="Casa de…"
          className={`flex-1 ${input}`}
        />
      </label>
      <button
        type="submit"
        disabled={nombre.trim() === '' || crear.isPending}
        className="min-h-tap rounded-block bg-slot px-4 text-item font-semibold text-slot-ink disabled:opacity-40"
      >
        Crear
      </button>
      {crear.isError && (
        <p role="alert" className="w-full text-measure text-danger">
          No se pudo crear:{' '}
          {crear.error instanceof Error ? crear.error.message : 'error desconocido'}
        </p>
      )}
    </form>
  );
}

function NuevaPersona({ householdId }: { householdId: string }) {
  const guardar = useUpsertProfile();
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [multiplicador, setMultiplicador] = useState('1');

  const slug = nombre
    .trim()
    .toLocaleLowerCase('es-ES')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  return (
    <form
      className="mt-2 flex flex-wrap items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (slug === '') return;
        guardar.mutate(
          {
            householdId,
            slug,
            displayName: nombre.trim(),
            claimEmail: correo.trim() === '' ? null : correo.trim(),
            portionMultiplier: Number(multiplicador) || 1,
          },
          {
            onSuccess: () => {
              setNombre('');
              setCorreo('');
              setMultiplicador('1');
            },
          },
        );
      }}
    >
      <input
        value={nombre}
        onChange={(event) => setNombre(event.target.value)}
        placeholder="Nombre"
        className={`w-36 ${input}`}
        aria-label="Nombre de la persona"
      />
      <input
        type="email"
        value={correo}
        onChange={(event) => setCorreo(event.target.value)}
        placeholder="Correo (reserva el perfil)"
        className={`w-56 ${input}`}
        aria-label="Correo autorizado"
      />
      <label className="flex items-center gap-1 text-measure text-ink-muted">
        Ración
        <input
          type="number"
          step="0.05"
          min="0.05"
          value={multiplicador}
          onChange={(event) => setMultiplicador(event.target.value)}
          className={`w-20 ${input}`}
        />
      </label>
      <button
        type="submit"
        disabled={slug === '' || guardar.isPending}
        className="min-h-tap rounded-block border border-line px-3 text-measure font-semibold text-ink disabled:opacity-40"
      >
        Añadir persona
      </button>
      {guardar.isError && (
        <p role="alert" className="w-full text-measure text-danger">
          {guardar.error instanceof Error ? guardar.error.message : 'No se pudo guardar'}
        </p>
      )}
    </form>
  );
}

export function HouseholdsView() {
  const households = useHouseholds();
  const [busqueda, setBusqueda] = useState('');
  const [abierto, setAbierto] = useState<string | null>(null);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLocaleLowerCase('es-ES');
    if (q === '') return households.data ?? [];
    return (households.data ?? []).filter(
      (household) =>
        household.name.toLocaleLowerCase('es-ES').includes(q) ||
        household.people.some((persona) =>
          persona.displayName.toLocaleLowerCase('es-ES').includes(q),
        ),
    );
  }, [households.data, busqueda]);

  return (
    <section className="rounded-day bg-surface p-6">
      <h1 className="text-dish font-bold text-ink">Hogares</h1>
      <p className="mt-1 text-measure text-ink-muted">
        {households.data?.length ?? 0} en la consulta.
      </p>

      <p role="note" className="mt-3 rounded-block bg-free p-3 text-measure font-semibold text-ink">
        Usa solo datos de prueba hasta completar la revisión legal. Aquí se guardan datos de salud
        de personas y todavía no hay política de privacidad ni consentimiento.
      </p>

      <input
        type="search"
        value={busqueda}
        onChange={(event) => setBusqueda(event.target.value)}
        placeholder="Buscar por hogar o persona…"
        className={`mt-4 w-full max-w-sm ${input}`}
      />

      {households.isPending && <p className="mt-6 text-item text-ink-muted">Cargando…</p>}

      <ul className="mt-4 flex flex-col gap-3">
        {visibles.map((household) => (
          <li key={household.id} className="rounded-block border border-line p-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex-1">
                <Link
                  to={`/admin/hogares/${household.id}`}
                  className="block text-item font-semibold text-ink underline"
                >
                  {household.name}
                </Link>
                <span className="block text-measure text-ink-muted">
                  {household.people.length === 0
                    ? 'Sin personas'
                    : household.people
                        .map(
                          (persona) =>
                            `${persona.displayName}${
                              persona.portionMultiplier === 1
                                ? ''
                                : ` (×${persona.portionMultiplier})`
                            }`,
                        )
                        .join(' y ')}
                </span>
              </span>

              <span className="text-measure text-ink-muted">
                {household.plan === null ? (
                  'Sin dieta vigente'
                ) : (
                  <>
                    v{household.plan.version} · desde {shortDateOf(household.plan.validFrom)}
                  </>
                )}
              </span>

              <button
                type="button"
                onClick={() => setAbierto(abierto === household.id ? null : household.id)}
                className="min-h-tap text-measure font-semibold text-ink-muted underline"
              >
                Añadir persona
              </button>

              <Link
                to={`/admin/hogares/${household.id}/dieta`}
                className="min-h-tap rounded-block bg-slot px-4 py-2 text-item font-semibold text-slot-ink"
              >
                Editar dieta
              </Link>
            </div>

            {abierto === household.id && <NuevaPersona householdId={household.id} />}
          </li>
        ))}
      </ul>

      {visibles.length === 0 && !households.isPending && (
        <p className="mt-6 text-item text-ink-muted">Ningún hogar coincide con esa búsqueda.</p>
      )}

      <NuevoHogar />
    </section>
  );
}
