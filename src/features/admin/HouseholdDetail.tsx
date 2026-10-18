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
import { resolveWeek } from '../../domain/resolve';
import type { Plan } from '../../domain/schema';
import { useHouseholds, useSetPlanStatus } from '../../data/builder';
import {
  useEditedBlocks,
  useHouseholdWeeks,
  usePlan,
  usePlanVersions,
  useProfileDirectory,
  useWeekChecks,
} from '../../data/queries';
import { setActiveHousehold } from '../../data/scope';
import { ChangeLogList } from '../changelog/ChangeLogList';
import { WeekPreview } from './WeekPreview';

type Pestana = 'dieta' | 'como-cliente' | 'historial' | 'seguimiento';

/**
 * Una versión publicada, leída. Se resuelve sin overrides ni bloques editados a propósito:
 * esto es lo que ella publicó, no lo que el cliente hizo luego con ello.
 */
function VersionLeida({ plan, etiqueta }: { plan: Plan; etiqueta: string }) {
  const weekStart = currentWeekStart();
  const [quien, setQuien] = useState(plan.profiles[0]?.profileId ?? '');

  const semana = useMemo(() => {
    try {
      return resolveWeek({ plan, profileId: quien, weekStart });
    } catch {
      return null;
    }
  }, [plan, quien, weekStart]);

  return (
    <div className="mt-3 border-t border-line pt-3">
      <div className="flex flex-wrap gap-2">
        {plan.profiles.map((perfil) => (
          <button
            key={perfil.profileId}
            type="button"
            onClick={() => setQuien(perfil.profileId)}
            aria-pressed={perfil.profileId === quien}
            className={`min-h-tap rounded-chip px-3 text-measure font-semibold ${
              perfil.profileId === quien ? 'bg-slot text-slot-ink' : 'border border-line text-ink'
            }`}
          >
            {perfil.displayName}
          </button>
        ))}
      </div>

      {semana === null ? (
        <p className="mt-3 text-item text-ink-muted">Esa persona no estaba en esta versión.</p>
      ) : (
        <WeekPreview week={semana} aviso={`${etiqueta} · tal como se publicó`} />
      )}
    </div>
  );
}

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
  const versiones = usePlanVersions(householdId === '' ? null : householdId);
  const estado = useSetPlanStatus();

  const [verVersion, setVerVersion] = useState<string | null>(null);
  const [archivando, setArchivando] = useState<string | null>(null);
  const [comoCliente, setComoCliente] = useState<string | null>(null);

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
            ['como-cliente', 'Ver como cliente'],
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
          <Link
            to={`/admin/hogares/${householdId}/dieta`}
            className="inline-block min-h-tap rounded-block bg-slot px-4 py-2 text-item font-semibold text-slot-ink"
          >
            Abrir el constructor
          </Link>

          <h2 className="mt-5 text-item font-bold text-ink">Versiones publicadas</h2>
          <p className="mt-1 max-w-prose text-measure text-ink-muted">
            Cada publicación deja una copia entera e intocable. Las anteriores se pueden mirar, pero
            no cambiar: son lo que comió esta casa.
          </p>

          {versiones.isPending && <p className="mt-3 text-item text-ink-muted">Cargando…</p>}

          {!versiones.isPending && (versiones.data ?? []).length === 0 && (
            <p className="mt-3 text-item text-ink-muted">
              Todavía no se ha publicado ninguna dieta para este hogar.
            </p>
          )}

          <ul className="mt-3 flex flex-col gap-2">
            {(versiones.data ?? []).map((version) => {
              const vigente = version.status === 'active' && version.validTo === null;
              const abierta = verVersion === version.plan.id;

              return (
                <li key={version.plan.id} className="rounded-block border border-line p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="flex-1 text-item text-ink">
                      <strong className="font-semibold">Versión {version.version}</strong> ·{' '}
                      {version.plan.name} · desde {shortDateOf(version.validFrom)}
                      {version.validTo !== null && <> hasta {shortDateOf(version.validTo)}</>}
                      {version.status === 'archived' && (
                        <span className="ml-2 text-ink-muted">archivada</span>
                      )}
                      {vigente && <span className="ml-2 font-semibold text-ink">vigente</span>}
                    </span>

                    <button
                      type="button"
                      onClick={() => setVerVersion(abierta ? null : version.plan.id)}
                      aria-expanded={abierta}
                      className="min-h-tap rounded-block border border-line px-3 text-measure font-semibold text-ink"
                    >
                      {abierta ? 'Cerrar' : 'Ver'}
                    </button>

                    {version.status === 'active' ? (
                      <button
                        type="button"
                        onClick={() => setArchivando(version.plan.id)}
                        className="min-h-tap text-measure font-semibold text-ink-muted underline"
                      >
                        Archivar
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => estado.mutate({ planId: version.plan.id, status: 'active' })}
                        className="min-h-tap text-measure font-semibold text-ink-muted underline"
                      >
                        Reactivar
                      </button>
                    )}
                  </div>

                  {archivando === version.plan.id && (
                    <p className="mt-3 flex flex-wrap items-center gap-2 text-measure text-ink">
                      {vigente
                        ? 'Si la archivas, estas personas se quedan sin dieta en su móvil hasta que publiques otra.'
                        : '¿Archivar esta versión?'}
                      <button
                        type="button"
                        onClick={() => {
                          estado.mutate({ planId: version.plan.id, status: 'archived' });
                          setArchivando(null);
                        }}
                        className="min-h-tap rounded-block border border-danger px-3 text-measure font-semibold text-danger"
                      >
                        Archivar
                      </button>
                      <button
                        type="button"
                        onClick={() => setArchivando(null)}
                        className="min-h-tap text-measure font-semibold text-ink-muted underline"
                      >
                        No
                      </button>
                    </p>
                  )}

                  {abierta && (
                    <VersionLeida plan={version.plan} etiqueta={`Versión ${version.version}`} />
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {pestana === 'como-cliente' && (
        <div className="mt-4">
          <p className="max-w-prose text-measure text-ink-muted">
            Su semana tal cual la tiene hoy en el móvil, con los cambios que haya hecho él. No se
            puede tocar nada desde aquí: marcar comidas es suyo.
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            {weeks.map((semana) => (
              <button
                key={semana.profileId}
                type="button"
                onClick={() => setComoCliente(semana.profileId)}
                aria-pressed={semana.profileId === (comoCliente ?? weeks[0]?.profileId)}
                className={`min-h-tap rounded-chip px-3 text-measure font-semibold ${
                  semana.profileId === (comoCliente ?? weeks[0]?.profileId)
                    ? 'bg-slot text-slot-ink'
                    : 'border border-line text-ink'
                }`}
              >
                {household.people.find((persona) => persona.slug === semana.profileId)
                  ?.displayName ?? semana.profileId}
              </button>
            ))}
          </div>

          {weeks.length === 0 ? (
            <p className="mt-4 text-item text-ink-muted">
              Este hogar no tiene dieta vigente, así que no hay nada que ver.
            </p>
          ) : (
            (() => {
              const elegida = weeks.find((semana) => semana.profileId === comoCliente) ?? weeks[0]!;
              const nombre =
                household.people.find((persona) => persona.slug === elegida.profileId)
                  ?.displayName ?? elegida.profileId;
              return <WeekPreview week={elegida} aviso={`Vista de ${nombre} · solo lectura`} />;
            })()
          )}
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
