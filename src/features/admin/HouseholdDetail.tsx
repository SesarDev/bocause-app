/**
 * Ficha de un hogar: su dieta, su historial y cómo le está yendo la semana.
 *
 * Todo lo que se ve aquí es **de solo lectura**, salvo el enlace al constructor. Marcar
 * comidas es del cliente: si la nutricionista pudiera hacerlo por él, el seguimiento dejaría
 * de significar nada.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { describeChanges } from '../../domain/describeChange';
import { currentWeekStart } from '../../domain/dates';
import { shortDateOf } from '../../domain/format';
import { weekAdherence } from '../../domain/progress';
import { buildBlockTitles, useChangeLog } from '../../data/changelog';
import { useHouseholds } from '../../data/builder';
import {
  useEditedBlocks,
  useHouseholdWeeks,
  usePlan,
  useProfileDirectory,
  useWeekChecks,
} from '../../data/queries';
import { setActiveHousehold } from '../../data/scope';
import { ChangeLogList } from '../changelog/ChangeLogList';

type Pestana = 'dieta' | 'historial' | 'seguimiento';

export function HouseholdDetail() {
  const { householdId = '' } = useParams();
  const [pestana, setPestana] = useState<Pestana>('dieta');

  useEffect(() => {
    if (householdId !== '') setActiveHousehold(householdId);
    return () => setActiveHousehold(null);
  }, [householdId]);

  const households = useHouseholds();
  const household = households.data?.find((candidate) => candidate.id === householdId) ?? null;

  const weekStart = currentWeekStart();
  const plan = usePlan(weekStart);
  const scopes = useProfileDirectory();
  const blocks = useEditedBlocks(plan.data?.id, scopes);
  const checks = useWeekChecks(weekStart, scopes);
  const { weeks } = useHouseholdWeeks(weekStart);
  const changeLog = useChangeLog();

  const grupos = useMemo(
    () => describeChanges(changeLog.data ?? [], buildBlockTitles(plan.data ?? null, blocks.data)),
    [changeLog.data, plan.data, blocks.data],
  );

  const adherencias = useMemo(
    () => weeks.map((week) => ({ week, adherencia: weekAdherence(week, checks.data ?? []) })),
    [weeks, checks.data],
  );

  if (household === null) {
    return (
      <section className="rounded-day bg-surface p-6">
        <p className="text-item text-ink-muted">
          {households.isPending ? 'Cargando…' : 'Ese hogar no existe.'}
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-day bg-surface p-6">
      <header className="flex flex-wrap items-center gap-3">
        <span className="flex-1">
          <h1 className="text-dish font-bold text-ink">{household.name}</h1>
          <p className="text-measure text-ink-muted">
            {household.people.map((persona) => persona.displayName).join(' y ') || 'Sin personas'}
          </p>
        </span>
        <Link to="/admin/hogares" className="text-measure font-semibold text-ink-muted underline">
          Volver
        </Link>
      </header>

      <nav aria-label="Secciones del hogar" className="mt-4 flex gap-1 border-b border-line">
        {(
          [
            ['dieta', 'Dieta'],
            ['historial', 'Historial'],
            ['seguimiento', 'Seguimiento'],
          ] as const
        ).map(([clave, titulo]) => (
          <button
            key={clave}
            type="button"
            onClick={() => setPestana(clave)}
            aria-current={pestana === clave}
            className={`min-h-tap rounded-t-block px-4 text-item font-semibold ${
              pestana === clave ? 'bg-slot text-slot-ink' : 'text-ink-muted hover:bg-bg'
            }`}
          >
            {titulo}
          </button>
        ))}
      </nav>

      {pestana === 'dieta' && (
        <div className="mt-4">
          {household.plan === null ? (
            <p className="text-item text-ink-muted">Este hogar no tiene dieta vigente.</p>
          ) : (
            <p className="text-item text-ink">
              <strong className="font-semibold">{household.plan.name}</strong> · versión{' '}
              {household.plan.version} · vigente desde {shortDateOf(household.plan.validFrom)}.
            </p>
          )}

          <Link
            to={`/admin/hogares/${householdId}/dieta`}
            className="mt-4 inline-block min-h-tap rounded-block bg-slot px-4 py-2 text-item font-semibold text-slot-ink"
          >
            Abrir el constructor
          </Link>

          <p className="mt-4 max-w-prose text-measure text-ink-muted">
            Las versiones anteriores en solo lectura llegan cuando haya más de una publicada.
          </p>
        </div>
      )}

      {pestana === 'historial' && (
        <div className="mt-4">
          <ChangeLogList groups={grupos} isLoading={changeLog.isPending} />
        </div>
      )}

      {pestana === 'seguimiento' && (
        <div className="mt-4">
          <p className="text-measure text-ink-muted">
            Semana del {shortDateOf(weekStart)}. Solo lectura: marcar comidas es del cliente.
          </p>

          {adherencias.length === 0 && (
            <p className="mt-3 text-item text-ink-muted">Sin datos de esta semana todavía.</p>
          )}

          <ul className="mt-3 flex flex-col gap-3">
            {adherencias.map(({ week, adherencia }) => (
              <li key={week.profileId} className="rounded-block border border-line p-4">
                <p className="text-item font-semibold text-ink">
                  {household.people.find((persona) => persona.slug === week.profileId)
                    ?.displayName ?? week.profileId}
                </p>

                <p className="mt-1 text-measure text-ink-muted">
                  {adherencia.overall.done} de {adherencia.overall.total} alimentos marcados
                  {adherencia.overall.total > 0 && (
                    <>
                      {' '}
                      · {Math.round((adherencia.overall.done / adherencia.overall.total) * 100)}%
                    </>
                  )}
                  {adherencia.completeDays > 0 && <> · {adherencia.completeDays} días completos</>}
                  {adherencia.freeMeals > 0 && <> · {adherencia.freeMeals} ingestas libres</>}
                </p>

                <div className="mt-2 flex gap-1">
                  {adherencia.byDay.map((dia, index) => (
                    <span
                      key={index}
                      title={`${dia.done} de ${dia.total}`}
                      className="h-2 flex-1 rounded-chip bg-line"
                    >
                      <span
                        className="block h-2 rounded-chip bg-accent"
                        style={{
                          width: dia.total === 0 ? '0%' : `${(dia.done / dia.total) * 100}%`,
                        }}
                      />
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
