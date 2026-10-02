import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../../components/Icon';
import { Sheet } from '../../components/Sheet';
import { currentWeekStart, dayIndexOf, todayIn } from '../../domain/dates';
import { canMarkFree, countFreeMeals } from '../../domain/freeMeals';
import { minutesNow, nextSlot } from '../../domain/mealTimes';
import { CheckIndex, dayProgress, type Progress } from '../../domain/progress';
import type { ResolvedSlot } from '../../domain/resolve';
import type { SlotKey } from '../../domain/schema';
import { useMyProfile } from '../../data/auth';
import { useApplyCells, useSetCheck } from '../../data/mutations';
import {
  useHouseholdWeeks,
  useProfileDirectory,
  useResolvedWeek,
  useWeekChecks,
  useWeekDailyLogs,
} from '../../data/queries';
import { useRealtimeSync } from '../../data/realtime';
import { useUiStore } from '../../stores/ui';
import { TodayTrackers } from '../trackers/Trackers';
import { CheckContext, type CheckApi } from './checkContext';
import { DayBar } from './DayBar';
import { DayCard } from './DayCard';
import { HouseDayCard } from './HouseDayCard';
import { SLOT_LABEL } from './slots';
import { SundayCard } from './SundayCard';

const EMPTY_PROGRESS: Progress = { total: 0, done: 0, ratio: 0, complete: false };

/**
 * Vista Semana. `onlyToday` la reutiliza la pestaña Hoy: la misma tarjeta de día, sin barra
 * de días y con los contadores de agua, aceite y comodín debajo.
 */
export function WeekView({ onlyToday = false }: { onlyToday?: boolean }) {
  const activeProfile = useUiStore((state) => state.activeProfile);
  const weekStart = currentWeekStart();
  const todayIndex = dayIndexOf(todayIn());
  const scrolled = useRef(false);
  const [menuSlot, setMenuSlot] = useState<ResolvedSlot | null>(null);

  const isHouse = activeProfile === 'casa';
  const profileSlug = isHouse ? undefined : (activeProfile ?? undefined);

  const { plan, week, isLoading, error } = useResolvedWeek(profileSlug, weekStart);
  const household = useHouseholdWeeks(weekStart);
  const directory = useProfileDirectory();
  const checks = useWeekChecks(weekStart, directory);
  const logs = useWeekDailyLogs(weekStart, directory);
  const myProfile = useMyProfile(true);

  const setCheck = useSetCheck();
  const applyCells = useApplyCells();

  useRealtimeSync(plan?.id, weekStart);

  // Cada uno marca lo suyo: viendo el plan de la otra persona o la vista Casa, solo se mira.
  const mySlug = myProfile.data?.slug;
  const editable = !isHouse && profileSlug !== undefined && profileSlug === mySlug;

  const checkIndexes = useMemo(() => {
    const rows = checks.data ?? [];
    const byProfile = new Map<string, CheckIndex>();
    for (const profile of plan?.profiles ?? []) {
      byProfile.set(profile.profileId, new CheckIndex(rows, profile.profileId));
    }
    return byProfile;
  }, [checks.data, plan]);

  const toggle = useCallback(
    (date: string, slot: SlotKey, itemId: string, next: boolean) => {
      if (!profileSlug) return;
      setCheck.mutate({ weekStart, profileSlug, date, slot, itemId, checked: next });
    },
    [setCheck, weekStart, profileSlug],
  );

  const checkApi = useMemo((): CheckApi | null => {
    if (!week) return null;
    const mine = checkIndexes.get(week.profileId);

    return {
      editable,
      isChecked: (date, slot, itemId) => mine?.has(date, slot, itemId) ?? false,
      toggle,
      toggleSlot: (date, slot, itemIds, next) => {
        for (const itemId of itemIds) toggle(date, slot, itemId, next);
      },
      checkedBy: (date, slot, itemId) =>
        (plan?.profiles ?? [])
          .filter(
            (profile) =>
              profile.profileId !== week.profileId &&
              checkIndexes.get(profile.profileId)?.has(date, slot, itemId),
          )
          .map((profile) => profile.displayName),
    };
  }, [week, checkIndexes, editable, toggle, plan]);

  const progress = useMemo((): Progress[] => {
    if (!week) return Array.from({ length: 7 }, () => EMPTY_PROGRESS);
    const index = checkIndexes.get(week.profileId) ?? new CheckIndex([], week.profileId);
    return week.days.map((day) => dayProgress(day, index));
  }, [week, checkIndexes]);

  const nextSlotKey = useMemo(() => {
    const slots = week?.days[todayIndex]?.slots.map((slot) => slot.cell.slot) ?? [];
    return slots.length > 0 ? nextSlot(slots, minutesNow(new Date())) : null;
  }, [week, todayIndex]);

  useEffect(() => {
    if (onlyToday || scrolled.current || !week) return;
    scrolled.current = true;
    document
      .getElementById(`dia-${todayIndex}`)
      ?.scrollIntoView({ block: 'start', behavior: 'auto' });
  }, [onlyToday, week, todayIndex]);

  if (isLoading || (isHouse && household.isLoading)) return <Message>Cargando el plan…</Message>;

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

  /* ── Vista Casa ── */
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
              checkIndexes={checkIndexes}
            />
          ))}
        </div>
      </>
    );
  }

  if (!week) return <Message>Elige un perfil para ver el plan.</Message>;

  const freeUsed = countFreeMeals(week);
  const days = onlyToday ? week.days.filter((day) => day.day === todayIndex) : week.days;

  const markFree = (slot: ResolvedSlot, next: boolean) => {
    applyCells.mutate({
      planId: plan.id,
      weekStart,
      upserts: [
        {
          level: 'week',
          row: {
            weekStart,
            day: slot.cell.day,
            slot: slot.cell.slot,
            scope: slot.cell.scope,
            blockId: slot.blockId,
            isFree: next,
          },
        },
      ],
    });
    setMenuSlot(null);
  };

  const canFree = menuSlot
    ? canMarkFree(week, plan.rules, menuSlot.cell) || menuSlot.isFree
    : false;

  return (
    <CheckContext.Provider value={checkApi}>
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
              onSlotMenu={setMenuSlot}
            />
          ),
        )}
      </div>

      {onlyToday && (
        <TodayTrackers
          plan={plan}
          profileSlug={week.profileId}
          weekStart={weekStart}
          date={todayIn()}
          logs={logs.data ?? []}
          editable={editable}
        />
      )}

      <Sheet
        open={menuSlot !== null}
        onClose={() => setMenuSlot(null)}
        title={menuSlot ? SLOT_LABEL[menuSlot.cell.slot] : ''}
      >
        {menuSlot && (
          <div className="pb-2">
            <button
              type="button"
              disabled={!canFree}
              onClick={() => markFree(menuSlot, !menuSlot.isFree)}
              className="flex min-h-tap w-full items-center gap-3 rounded-block border border-line px-4 py-3 text-left disabled:opacity-50"
            >
              <Icon name="libre" size={20} />
              <span className="flex-1 text-item font-semibold text-ink">
                {menuSlot.isFree ? 'Quitar la ingesta libre' : 'Marcar como ingesta libre'}
              </span>
            </button>
            <p className="mt-2 text-measure text-ink-muted">
              {menuSlot.isFree
                ? 'Volverá a contar como una comida del plan.'
                : canFree
                  ? `Has usado ${freeUsed} de ${plan.rules.freeMealsPerWeek} esta semana.`
                  : `Ya has usado las ${plan.rules.freeMealsPerWeek} de esta semana.`}
            </p>
            <p className="mt-3 text-measure text-ink-muted">
              Intercambiar y editar llegan en las fases 7 y 8.
            </p>
          </div>
        )}
      </Sheet>
    </CheckContext.Provider>
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
