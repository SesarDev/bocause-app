import { ProgressRing } from '../../components/ProgressRing';
import { DAY_INITIALS } from '../../domain/dates';
import type { Progress } from '../../domain/progress';

/**
 * Barra de días pegada bajo la cabecera. Cada día lleva su anillo de progreso y tocarlo
 * lleva a esa tarjeta: con siete días en vertical, bajar a mano cansa.
 */
export function DayBar({
  progress,
  todayIndex,
  onPick,
}: {
  progress: Progress[];
  todayIndex: number | null;
  onPick: (day: number) => void;
}) {
  return (
    <nav
      aria-label="Días de la semana"
      className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-10 -mx-4 border-b border-line bg-bg/95 px-4 py-2 backdrop-blur"
    >
      <ul className="mx-auto flex max-w-screen-sm justify-between">
        {DAY_INITIALS.map((initial, day) => {
          const ratio = progress[day]?.ratio ?? 0;
          const complete = progress[day]?.complete ?? false;
          const isToday = day === todayIndex;

          return (
            <li key={day}>
              <button
                type="button"
                onClick={() => onPick(day)}
                aria-current={isToday ? 'date' : undefined}
                className="grid min-h-tap w-10 place-items-center"
              >
                <ProgressRing ratio={ratio}>
                  <span
                    className={`text-measure font-extrabold ${
                      isToday ? 'text-ink' : 'text-ink-muted'
                    }`}
                  >
                    {initial}
                  </span>
                </ProgressRing>
                <span className="sr-only">
                  {complete ? 'día completo' : `${Math.round(ratio * 100)} por ciento`}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
