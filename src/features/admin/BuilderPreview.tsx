/**
 * "Ver como…": el borrador con los ojos del cliente.
 *
 * Usa los mismos componentes que la app del móvil (`DayCard`), no una maqueta parecida: lo
 * único que sirve para saber si una dieta se entiende es verla como se va a ver. Por eso va
 * dentro de un marco estrecho, con el ancho de un teléfono.
 *
 * Es una vista muerta: sin checks, sin menús y sin nada que escribir. Los contextos de
 * check y de sustitución se quedan vacíos a propósito (ambos aceptan `null`), así que las
 * casillas salen apagadas y no hay nada que tocar.
 */
import { useMemo } from 'react';
import { currentWeekStart, todayIn } from '../../domain/dates';
import { resolveWeek } from '../../domain/resolve';
import type { Plan } from '../../domain/schema';
import { DayCard } from '../week/DayCard';

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
  const hoy = todayIn();

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
        /* El ancho de un móvil: una dieta que se lee bien en 1400 px puede no caber en 390. */
        <div className="mt-4 w-full max-w-[26rem] rounded-day bg-bg p-3">
          <div className="flex flex-col gap-3">
            {semana.days.map((day) => (
              <DayCard
                key={day.day}
                day={day}
                profileId={semana.profileId}
                isToday={day.date === hoy}
                nextSlotKey={null}
                onSlotMenu={() => undefined}
                onTraining={() => undefined}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
