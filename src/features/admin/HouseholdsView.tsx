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
import { useCreateClientAccount, useCreateHousehold, useHouseholds } from '../../data/builder';

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

/**
 * Alta de una persona: su perfil **y su cuenta**.
 *
 * El usuario y la contraseña se los das tú y se los dices tú. No hay registro, no hay
 * correo de confirmación y no hay "he olvidado mi contraseña": a cambio, nadie puede
 * entrar y elegir ser quien no es.
 */
function NuevaPersona({ householdId }: { householdId: string }) {
  const crear = useCreateClientAccount();
  const [nombre, setNombre] = useState('');
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [multiplicador, setMultiplicador] = useState('1');
  const [hecho, setHecho] = useState<string | null>(null);

  const comoSlug = (texto: string) =>
    texto
      .trim()
      .toLocaleLowerCase('es-ES')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

  const slug = comoSlug(nombre);
  // El usuario se propone a partir del nombre, pero se puede cambiar: en dos hogares puede
  // haber dos Martas, y el usuario es único en toda la consulta.
  const usuarioFinal = usuario.trim() === '' ? slug : comoSlug(usuario);
  const cortaLaContrasena = password.length > 0 && password.length < 6;

  return (
    <form
      className="mt-2 flex flex-wrap items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (slug === '' || password.length < 6) return;
        crear.mutate(
          {
            householdId,
            slug,
            displayName: nombre.trim(),
            usuario: usuarioFinal,
            password,
            portionMultiplier: Number(multiplicador) || 1,
          },
          {
            onSuccess: () => {
              setHecho(`${nombre.trim()} ya puede entrar como "${usuarioFinal}".`);
              setNombre('');
              setUsuario('');
              setPassword('');
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
        value={usuario}
        onChange={(event) => setUsuario(event.target.value)}
        placeholder={slug === '' ? 'Usuario' : `Usuario (${slug})`}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        className={`w-40 ${input}`}
        aria-label="Usuario para entrar"
      />
      <input
        type="text"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="Contraseña"
        autoComplete="off"
        className={`w-40 ${input}`}
        aria-label="Contraseña"
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
        disabled={slug === '' || password.length < 6 || crear.isPending}
        className="min-h-tap rounded-block border border-line px-3 text-measure font-semibold text-ink disabled:opacity-40"
      >
        {crear.isPending ? 'Creando…' : 'Añadir persona'}
      </button>

      {/* La contraseña se ve mientras se escribe a propósito: la estás dictando en voz alta,
          y una contraseña tapada que se teclea mal no se descubre hasta que alguien no puede
          entrar. */}
      {cortaLaContrasena && (
        <p className="w-full text-measure text-ink-muted">
          La contraseña necesita al menos 6 caracteres.
        </p>
      )}

      {hecho !== null && !crear.isPending && (
        <p role="status" className="w-full text-measure text-ink">
          {hecho} Apúntalo: la contraseña no se puede volver a ver.
        </p>
      )}

      {crear.isError && (
        <p role="alert" className="w-full max-w-prose text-measure text-danger">
          {crear.error instanceof Error ? crear.error.message : 'No se pudo crear la cuenta'}
        </p>
      )}
    </form>
  );
}

/**
 * Darle acceso a alguien que ya tiene perfil pero todavía no tiene cuenta.
 *
 * Pasa con los hogares sembrados y con cualquier persona creada antes de que existieran las
 * cuentas: tiene su dieta, pero no puede entrar a verla. Es la misma alta que la de una
 * persona nueva, conservando su perfil (y con él sus checks y su historial).
 */
function DarAcceso({
  householdId,
  persona,
}: {
  householdId: string;
  persona: { slug: string; displayName: string; portionMultiplier: number };
}) {
  const crear = useCreateClientAccount();
  const [abierto, setAbierto] = useState(false);
  const [usuario, setUsuario] = useState(persona.slug);
  const [password, setPassword] = useState('');

  if (!abierto) {
    return (
      <p className="flex flex-wrap items-center gap-2 text-measure text-ink-muted">
        <strong className="font-semibold text-ink">{persona.displayName}</strong> no tiene cuenta:
        no puede entrar a ver su dieta.
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="min-h-tap font-semibold text-ink underline"
        >
          Darle acceso
        </button>
      </p>
    );
  }

  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (password.length < 6) return;
        crear.mutate(
          {
            householdId,
            slug: persona.slug,
            displayName: persona.displayName,
            usuario,
            password,
            portionMultiplier: persona.portionMultiplier,
          },
          { onSuccess: () => setAbierto(false) },
        );
      }}
    >
      <span className="text-measure text-ink">{persona.displayName} entra como</span>
      <input
        value={usuario}
        onChange={(event) => setUsuario(event.target.value)}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        className={`w-36 ${input}`}
        aria-label={`Usuario de ${persona.displayName}`}
      />
      <input
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="Contraseña"
        autoComplete="off"
        className={`w-36 ${input}`}
        aria-label={`Contraseña de ${persona.displayName}`}
      />
      <button
        type="submit"
        disabled={password.length < 6 || crear.isPending}
        className="min-h-tap rounded-block border border-line px-3 text-measure font-semibold text-ink disabled:opacity-40"
      >
        {crear.isPending ? 'Creando…' : 'Crear cuenta'}
      </button>
      <button
        type="button"
        onClick={() => setAbierto(false)}
        className="min-h-tap text-measure font-semibold text-ink-muted underline"
      >
        Cancelar
      </button>
      {crear.isError && (
        <span role="alert" className="w-full text-measure text-danger">
          {crear.error instanceof Error ? crear.error.message : 'No se pudo crear la cuenta'}
        </span>
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

            {/* Quién puede entrar y quién no. Un perfil sin cuenta no es un error —se crean
                así al sembrar un hogar— pero esa persona no puede ver su dieta, y eso hay
                que verlo de un vistazo. */}
            {household.people.some((persona) => persona.userId === null) && (
              <ul className="mt-2 flex flex-col gap-1">
                {household.people
                  .filter((persona) => persona.userId === null)
                  .map((persona) => (
                    <li key={persona.id}>
                      <DarAcceso householdId={household.id} persona={persona} />
                    </li>
                  ))}
              </ul>
            )}

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
