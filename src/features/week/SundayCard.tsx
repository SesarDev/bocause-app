import { Icon } from '../../components/Icon';
import { dayNameOf, shortDateOf } from '../../domain/format';
import type { ResolvedDay } from '../../domain/resolve';

/**
 * El domingo no lleva plan: son las dos ingestas libres de la semana (así viene en el PDF).
 * En vez de siete franjas vacías, una tarjeta que dice de qué va y cuántas quedan.
 */
export function SundayCard({
  day,
  used,
  allowance,
  isToday,
}: {
  day: ResolvedDay;
  used: number;
  allowance: number;
  isToday: boolean;
}) {
  const left = Math.max(0, allowance - used);

  return (
    <article id={`dia-${day.day}`} data-day-anchor="" className="rounded-day bg-surface p-4">
      <header className="flex flex-wrap items-baseline gap-x-2">
        <h2 className="text-day font-extrabold tracking-[0.02em] text-ink">
          {dayNameOf(day.date)}
        </h2>
        <p className="text-measure text-ink-muted">{shortDateOf(day.date)}</p>
        {isToday && (
          <span className="rounded-chip bg-accent px-2 py-0.5 text-measure font-bold text-accent-ink">
            Hoy
          </span>
        )}
      </header>

      <div className="mt-3 flex items-start gap-3 rounded-block bg-free p-3">
        <Icon name="libre" size={22} />
        <div>
          <p className="text-dish font-bold text-ink">{allowance} ingestas libres a la semana</p>
          <p className="mt-1 text-item text-ink-muted">
            {used === 0
              ? 'Todavía no has usado ninguna esta semana.'
              : left === 0
                ? 'Ya has usado las dos de esta semana.'
                : `Has usado ${used} y te queda ${left}.`}
          </p>
        </div>
      </div>
    </article>
  );
}
