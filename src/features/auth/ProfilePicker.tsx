import { Icon } from '../../components/Icon';
import { signOut, useAvailableProfiles, useClaimProfile } from '../../data/auth';

/**
 * "¿Quién eres?": vincula el usuario con su perfil del hogar. Solo se puede elegir un
 * perfil libre, y solo una vez: a partir de ahí las políticas de la base de datos deciden
 * qué puede editar cada uno.
 */
export function ProfilePicker() {
  const { data: profiles, isLoading, error } = useAvailableProfiles(true);
  const claim = useClaimProfile();

  return (
    <main className="mx-auto flex min-h-dvh max-w-screen-sm flex-col justify-center px-6">
      <section className="rounded-day bg-surface p-6">
        <h1 className="text-dish font-bold text-ink">¿Quién eres?</h1>
        <p className="mt-2 text-item text-ink-muted">
          Elige tu perfil. Se queda guardado en este móvil y no hace falta volver a elegirlo.
        </p>

        {isLoading && <p className="mt-6 text-item text-ink-muted">Cargando perfiles…</p>}

        {error !== null && (
          <p role="alert" className="mt-6 text-measure text-danger">
            No se pudieron cargar los perfiles. ¿Está el hogar creado en Supabase?
          </p>
        )}

        <ul className="mt-6 flex flex-col gap-3">
          {(profiles ?? []).map((profile) => (
            <li key={profile.id}>
              <button
                type="button"
                disabled={profile.taken || claim.isPending}
                onClick={() => claim.mutate(profile.id)}
                className="flex min-h-tap w-full items-center gap-3 rounded-block border border-line px-4 py-3 text-left disabled:opacity-50"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-chip bg-slot text-slot-ink">
                  <Icon name="perfil" size={20} />
                </span>
                <span className="flex-1">
                  <span className="block text-item font-semibold text-ink">
                    {profile.displayName}
                  </span>
                  {profile.taken && (
                    <span className="block text-measure text-ink-muted">Ya está ocupado</span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>

        {profiles?.length === 0 && !isLoading && (
          <p className="mt-6 text-item text-ink-muted">
            No hay ningún perfil disponible para tu correo. Revisa que el hogar esté creado y que tu
            correo sea el que tiene asignado.
          </p>
        )}

        {claim.isError && (
          <p role="alert" className="mt-4 text-measure text-danger">
            {claim.error instanceof Error ? claim.error.message : 'No se pudo elegir el perfil'}
          </p>
        )}

        <button
          type="button"
          onClick={() => void signOut()}
          className="mt-6 min-h-tap text-measure font-semibold text-ink-muted underline"
        >
          Salir y entrar con otro correo
        </button>
      </section>
    </main>
  );
}
