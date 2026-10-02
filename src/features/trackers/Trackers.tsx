import { useState } from 'react';
import { Icon } from '../../components/Icon';
import { Sheet } from '../../components/Sheet';
import { useLongPress } from '../../components/useLongPress';
import { minutesNow, minutesOf } from '../../domain/mealTimes';
import type { ComodinOption, DailyLog, Plan } from '../../domain/schema';
import { useUpdateDailyLog } from '../../data/mutations';

type Common = {
  weekStart: string;
  profileSlug: string;
  date: string;
  log: DailyLog | undefined;
  editable: boolean;
};

const EMPTY: Pick<DailyLog, 'waterMl' | 'aoveSpoons' | 'comodinDone' | 'comodinOptionId'> = {
  waterMl: 0,
  aoveSpoons: 0,
  comodinDone: false,
  comodinOptionId: null,
};

/* ─────────────────────── Comodín proteico ─────────────────────── */

/**
 * El comodín es obligatorio una vez al día (regla del plan). A partir de las 20:00 avisa,
 * sin alarmismo: un recordatorio, no un reproche.
 */
export function ComodinCard({
  options,
  ...common
}: Common & { options: readonly ComodinOption[] }) {
  const update = useUpdateDailyLog();
  const log = { ...EMPTY, ...common.log };
  const late = minutesNow(new Date()) >= minutesOf('20:00');

  const choose = (option: ComodinOption) => {
    const same = log.comodinOptionId === option.id;
    update.mutate({
      weekStart: common.weekStart,
      profileSlug: common.profileSlug,
      date: common.date,
      patch: same
        ? { comodinOptionId: null, comodinDone: false }
        : { comodinOptionId: option.id, comodinDone: true },
    });
  };

  return (
    <section className="rounded-day bg-surface p-4">
      <header className="flex items-center gap-2">
        <h3 className="text-dish font-bold text-ink">Comodín proteico</h3>
        {log.comodinDone ? (
          <span className="rounded-chip bg-accent px-2 py-0.5 text-measure font-bold text-accent-ink">
            Hecho
          </span>
        ) : (
          late && (
            <span className="rounded-chip bg-free px-2 py-0.5 text-measure font-semibold text-ink">
              Te falta hoy
            </span>
          )
        )}
      </header>
      <p className="mt-1 text-measure text-ink-muted">
        Obligatorio una vez al día, en la comida, la cena o cuando prefieras.
      </p>

      <ul className="mt-3 flex flex-wrap gap-2">
        {options.map((option) => {
          const picked = log.comodinOptionId === option.id;
          return (
            <li key={option.id}>
              <button
                type="button"
                disabled={!common.editable}
                onClick={() => choose(option)}
                aria-pressed={picked}
                className={`flex min-h-tap items-center gap-1.5 rounded-chip border px-3 py-1.5 text-left disabled:opacity-60 ${
                  picked ? 'border-check bg-check text-check-tick' : 'border-line text-ink'
                }`}
              >
                <span className="text-measure font-semibold">{option.label}</span>
                <span className={`text-measure ${picked ? '' : 'text-ink-muted'}`}>
                  {option.amount}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ─────────────────────── Aceite de oliva ─────────────────────── */

export function AoveCard({
  weeklySpoons,
  max,
  ...common
}: Common & { weeklySpoons: number; max: number }) {
  const update = useUpdateDailyLog();
  const log = { ...EMPTY, ...common.log };

  const set = (next: number) =>
    update.mutate({
      weekStart: common.weekStart,
      profileSlug: common.profileSlug,
      date: common.date,
      patch: { aoveSpoons: Math.max(0, next) },
    });

  const ratio = Math.min(1, weeklySpoons / max);

  return (
    <section className="rounded-day bg-surface p-4">
      <header className="flex items-center gap-2">
        <h3 className="mr-auto text-dish font-bold text-ink">Aceite de oliva</h3>
        <button
          type="button"
          disabled={!common.editable || log.aoveSpoons === 0}
          onClick={() => set(log.aoveSpoons - 1)}
          aria-label="Quitar una cucharada"
          className="grid size-tap place-items-center rounded-chip border border-line text-lg font-bold text-ink disabled:opacity-40"
        >
          −
        </button>
        <span aria-live="polite" className="w-10 text-center text-dish font-bold text-ink">
          {log.aoveSpoons}
        </span>
        <button
          type="button"
          disabled={!common.editable}
          onClick={() => set(log.aoveSpoons + 1)}
          aria-label="Añadir una cucharada"
          className="grid size-tap place-items-center rounded-chip bg-accent text-lg font-bold text-accent-ink disabled:opacity-40"
        >
          +
        </button>
      </header>

      <p className="mt-2 text-measure text-ink-muted">
        {weeklySpoons} de {max} cucharadas esta semana
      </p>
      <div className="mt-1 h-2 overflow-hidden rounded-chip bg-line">
        <div
          className={`h-full rounded-chip transition-[width] ${
            weeklySpoons > max ? 'bg-danger' : 'bg-accent'
          }`}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
    </section>
  );
}

/* ─────────────────────── Agua ─────────────────────── */

const GLASS_ML = 250;

export function WaterCard({
  minLiters,
  maxLiters,
  ...common
}: Common & { minLiters: number; maxLiters: number }) {
  const update = useUpdateDailyLog();
  const [open, setOpen] = useState(false);
  const log = { ...EMPTY, ...common.log };

  const set = (next: number) =>
    update.mutate({
      weekStart: common.weekStart,
      profileSlug: common.profileSlug,
      date: common.date,
      patch: { waterMl: Math.max(0, next) },
    });

  // Un toque suma un vaso; mantener pulsado abre la corrección.
  const press = useLongPress(
    () => common.editable && setOpen(true),
    () => common.editable && set(log.waterMl + GLASS_ML),
  );

  const liters = log.waterMl / 1000;
  const ratio = Math.min(1, liters / maxLiters);

  return (
    <section className="rounded-day bg-surface p-4">
      <header className="flex items-baseline gap-2">
        <h3 className="mr-auto text-dish font-bold text-ink">Agua</h3>
        <span aria-live="polite" className="text-dish font-bold text-ink">
          {liters.toLocaleString('es-ES', { maximumFractionDigits: 2 })} L
        </span>
      </header>

      <p className="mt-1 text-measure text-ink-muted">
        Objetivo {minLiters}-{maxLiters} L al día
      </p>
      <div className="mt-1 h-2 overflow-hidden rounded-chip bg-line">
        <div
          className={`h-full rounded-chip transition-[width] ${
            liters >= minLiters ? 'bg-accent' : 'bg-check'
          }`}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>

      <button
        type="button"
        {...press}
        disabled={!common.editable}
        className="mt-3 flex min-h-tap w-full items-center justify-center gap-2 rounded-chip bg-accent px-4 font-bold text-accent-ink disabled:opacity-60"
      >
        <Icon name="agua" size={16} />
        Añadir un vaso (250 ml)
      </button>
      <p className="mt-1 text-center text-measure text-ink-muted">Mantén pulsado para corregir</p>

      <Sheet open={open} onClose={() => setOpen(false)} title="Corregir el agua de hoy">
        <div className="flex items-center justify-center gap-4 py-2">
          <button
            type="button"
            onClick={() => set(log.waterMl - GLASS_ML)}
            disabled={log.waterMl === 0}
            aria-label="Quitar un vaso"
            className="grid size-tap place-items-center rounded-chip border border-line text-lg font-bold text-ink disabled:opacity-40"
          >
            −
          </button>
          <span className="text-day font-extrabold text-ink">
            {liters.toLocaleString('es-ES', { maximumFractionDigits: 2 })} L
          </span>
          <button
            type="button"
            onClick={() => set(log.waterMl + GLASS_ML)}
            aria-label="Añadir un vaso"
            className="grid size-tap place-items-center rounded-chip bg-accent text-lg font-bold text-accent-ink"
          >
            +
          </button>
        </div>
        <button
          type="button"
          onClick={() => set(0)}
          className="mt-2 min-h-tap w-full text-measure font-semibold text-ink-muted underline"
        >
          Poner a cero
        </button>
      </Sheet>
    </section>
  );
}

/* ─────────────────────── Conjunto ─────────────────────── */

export function TodayTrackers({
  plan,
  profileSlug,
  weekStart,
  date,
  logs,
  editable,
}: {
  plan: Plan;
  profileSlug: string;
  weekStart: string;
  date: string;
  logs: DailyLog[];
  editable: boolean;
}) {
  const mine = logs.filter((log) => log.profileId === profileSlug);
  const today = mine.find((log) => log.date === date);
  const weeklySpoons = mine.reduce((total, log) => total + log.aoveSpoons, 0);
  const profile = plan.profiles.find((candidate) => candidate.profileId === profileSlug);

  const common = { weekStart, profileSlug, date, log: today, editable };

  return (
    <div className="mt-3 flex flex-col gap-3">
      {profile && profile.comodin.length > 0 && (
        <ComodinCard {...common} options={profile.comodin} />
      )}
      <AoveCard {...common} weeklySpoons={weeklySpoons} max={plan.rules.aoveMaxSpoonsPerWeek} />
      <WaterCard
        {...common}
        minLiters={plan.rules.waterLitersMin}
        maxLiters={plan.rules.waterLitersMax}
      />
    </div>
  );
}
