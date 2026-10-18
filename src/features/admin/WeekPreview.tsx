/**
 * Una semana vista como la ve el cliente, y sin poder tocar nada.
 *
 * Usa los mismos componentes que el móvil (`DayCard`), no una maqueta parecida: lo único
 * que sirve para saber si una dieta se entiende es verla como se va a ver. Por eso va en un
 * marco del ancho de un teléfono.
 *
 * Que sea de solo lectura no se consigue con un flag que haya que acordarse de respetar:
 * aquí no se montan ni los menús ni los contextos de check y sustitución, así que no hay
 * nada que pulsar. Un cambio accidental en la dieta de otra persona no es un detalle.
 */
import { todayIn } from '../../domain/dates';
import type { ResolvedWeek } from '../../domain/resolve';
import { DayCard } from '../week/DayCard';

export function WeekPreview({ week, aviso }: { week: ResolvedWeek; aviso?: string }) {
  const hoy = todayIn();

  return (
    <div className="mt-3 w-full max-w-[26rem]">
      {aviso !== undefined && (
        <p className="rounded-t-day bg-slot px-3 py-2 text-measure font-semibold text-slot-ink">
          {aviso}
        </p>
      )}

      <div className={`bg-bg p-3 ${aviso === undefined ? 'rounded-day' : 'rounded-b-day'}`}>
        <div className="flex flex-col gap-3">
          {week.days.map((day) => (
            <DayCard
              key={day.day}
              day={day}
              profileId={week.profileId}
              isToday={day.date === hoy}
              nextSlotKey={null}
              onSlotMenu={() => undefined}
              onTraining={() => undefined}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
