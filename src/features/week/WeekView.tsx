import { useEffect, useMemo, useRef } from 'react';
import { currentWeekStart, dayIndexOf, todayIn } from '../../domain/dates';
import { countFreeMeals } from '../../domain/freeMeals';
import { minutesNow, nextSlot } from '../../domain/mealTimes';
import { CheckIndex, dayProgress, type Progress } from '../../domain/progress';
import {
  useHouseholdWeeks,
  useProfileDirectory,
  useResolvedWeek,
  useWeekChecks,
} from '../../data/queries';
import { useRealtimeSync } from '../../data/realtime';
import { useUiStore } from '../../stores/ui';
import { DayBar } from './DayBar';
import { DayCard } from './DayCard';
import { HouseDayCard } from './HouseDayCard';
import { SundayCard } from './SundayCard';

const EMPTY_PROGRESS: Progress = { total: 0, done: 0, ratio: 0, complete: false };

/**
 * Vista Semana. `onlyToday` la reutiliza la pestaña Hoy: es la misma tarjeta, pero una sola
 * y sin barra de días (PLAN.md, fase 5).
 */
export function WeekView({ onlyToday = false }: { onlyToday?: boolean }) {
  const activeProfile = useUiStore((state) => state.activeProfile);
  const weekStart = currentWeekStart();
  const today = todayIn();
  const todayIndex = dayIndexOf(today);
  const scrolled = useRef(false);

  const isHouse = activeProfile === 'casa';
  const profileSlug = isHouse ? undefined : (activeProfile ?? undefined);

  const { plan, week, isLoading, error } = useResolvedWeek(profileSlug, weekStart);
  const household = useHouseholdWeeks(weekStart);
  const directory = useProfileDirectory();
  const checks = useWeekChecks(weekStart, directory);

  useRealtimeSync(plan?.id, weekStart);

  const progress = useMemo((): Progress[] => {
    if (!week) return Array.from({ length: 7 }, () => EMPTY_PROGRESS);
    const index = new CheckIndex(checks.data ?? [], week.profileId);
    return week.days.map((day) => dayProgress(day, index));
  }, [week, checks.data]);

  const nextSlotKey = useMemo(() => {
    const slots = week?.days[todayIndex]?.slots.map((slot) => slot.cell.slot) ?? [];
    return slots.length > 0 ? nextSlot(slots, minutesNow(new Date())) : null;
  }, [week, todayIndex]);

  // Al abrir la semana, se baja sola al día de hoy. Solo la primera vez.
  useEffect(() => {
    if (onlyToday || scrolled.current || !week) return;
    scrolled.current = true;
    document
      .getElementById(`dia-${todayIndex}`)
      ?.scrollIntoView({ block: 'start', behavior: 'auto' });
  }, [onlyToday, week, todayIndex]);

  if (isLoading || (isHouse && household.isLoading)) {
    return <Message>Cargando el plan…</Message>;
  }

  if (error) {
    return (
      <Message tone="error">
        No se pudo cargar el plan. Comprueba la conexión; lo último que se vio sigue guardado.
      </Message>
    );
  }

  if (!plan) {
    return (
      <Message>
        No hay ningún plan activo para esta semana. Ejecuta <code>npm run seed</code> para cargar el
        de septiembre.
      </Message>
    );
  }

  const goToDay = (day: number) =>
    document.getElementById(`dia-${day}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' });

  /* ── Vista Casa: solo comida y cena, con las dos raciones ── */
  if (isHouse) {
    const people = household.weeks.map((weekOf) => ({
      profileId: weekOf.profileId,
      displayName:
        plan.profiles.find((profile) => profile.profileId === weekOf.profileId)?.displayName ??
        weekOf.profileId,
    }));
    const days = onlyToday ? [todayIndex] : [0, 1, 2, 3, 4, 5, 6];

    return (
      <>
        {!onlyToday && <DayBar progress={progress} todayIndex={todayIndex} onPick={goToDay} />}
        <div className="mt-3 flex flex-col gap-3">
          {days.map((day) => (
            <HouseDayCard
              key={day}
              day={day}
              weeks={household.weeks}
              people={people}
              isToday={day === todayIndex}
            />
          ))}
        </div>
      </>
    );
  }

  if (!week) {
    return <Message>Elige un perfil para ver el plan.</Message>;
  }

  const freeUsed = countFreeMeals(week);
  const days = onlyToday ? week.days.filter((day) => day.day === todayIndex) : week.days;

  return (
    <>
      {!onlyToday && <DayBar progress={progress} todayIndex={todayIndex} onPick={goToDay} />}

      <div className="mt-3 flex flex-col gap-3">
        {days.map((day) =>
          day.slots.every((slot) => slot.block === null && !slot.isFree) ? (
            <SundayCard
              key={day.day}
              day={day}
              used={freeUsed}
              allowance={plan.rules.freeMealsPerWeek}
              isToday={day.day === todayIndex}
            />
          ) : (
            <DayCard
              key={day.day}
              day={day}
              profileId={week.profileId}
              isToday={day.day === todayIndex}
              nextSlotKey={nextSlotKey}
            />
          ),
        )}
      </div>
    </>
  );
}

function Message({
  children,
  tone = 'normal',
}: {
  children: React.ReactNode;
  tone?: 'normal' | 'error';
}) {
  return (
    <p
      role={tone === 'error' ? 'alert' : undefined}
      className={`mt-8 rounded-day bg-surface p-6 text-center text-item ${
        tone === 'error' ? 'text-danger' : 'text-ink-muted'
      }`}
    >
      {children}
    </p>
  );
}
