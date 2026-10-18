/**
 * "Ver como…": el borrador con los ojos del cliente, antes de publicarlo.
 *
 * Es el borrador tal cual, sin los ajustes de esa semana que haya hecho el cliente: lo que
 * se está mirando es lo que se va a publicar, no lo que hay hoy en su móvil. Para eso está
 * "Ver como cliente" en la ficha del hogar.
 */
import { useMemo } from 'react';
import { currentWeekStart } from '../../domain/dates';
import { resolveWeek } from '../../domain/resolve';
import type { Plan } from '../../domain/schema';
import { WeekPreview } from './WeekPreview';

export function BuilderPreview({
  plan,
  profileId,
  onProfile,
}: {
  plan: Plan;
  profileId: string;
  onProfile: (profileId: string) => void;
}) {
  const weekStart = currentWeekStart();

  const semana = useMemo(() => {
    try {
      return resolveWeek({ plan, profileId, weekStart });
    } catch {
      // Un perfil que ya no está en la dieta (se quitó en Configuración, o la dieta viene
      // de otro hogar). Mejor decirlo que romper la pantalla.
      return null;
    }
  }, [plan, profileId, weekStart]);

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-measure font-semibold text-ink">Ver como</span>
        {plan.profiles.map((perfil) => (
          <button
            key={perfil.profileId}
            type="button"
            onClick={() => onProfile(perfil.profileId)}
            aria-pressed={perfil.profileId === profileId}
            className={`min-h-tap rounded-chip px-3 text-measure font-semibold ${
              perfil.profileId === profileId
                ? 'bg-slot text-slot-ink'
                : 'border border-line text-ink'
            }`}
          >
            {perfil.displayName}
          </button>
        ))}
        <span className="text-measure text-ink-muted">
          Como lo verá en el móvil. Aquí no se puede marcar nada.
        </span>
      </div>

      {semana === null ? (
        <p className="mt-4 text-item text-ink-muted">
          Esa persona ya no está en la dieta. Elige otra arriba.
        </p>
      ) : (
        <WeekPreview week={semana} />
      )}
    </div>
  );
}
