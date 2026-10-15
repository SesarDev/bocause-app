import { useMemo, useState } from 'react';
import { Icon, type IconName } from '../../components/Icon';
import { Sheet } from '../../components/Sheet';
import { currentWeekStart } from '../../domain/dates';
import { describeChanges, type ChangeGroup } from '../../domain/describeChange';
import { restoreCell } from '../../domain/edit';
import { SlotKey, type Recipe, type SupplementProtocol } from '../../domain/schema';
import { signOut, useMyProfile } from '../../data/auth';
import { buildBlockTitles, useChangeLog } from '../../data/changelog';
import { useRestoreCell } from '../../data/mutations';
import { useEditedBlocks, usePlan, useProfileDirectory, useProfiles } from '../../data/queries';
import { ChangeLogList } from '../changelog/ChangeLogList';
import { RecipeSheet } from '../recipes/RecipeSheet';
import { SupplementList } from '../training/TrainingSheet';

/**
 * Para cada recomendación del plan, el icono que le pega. Se decide por palabra clave
 * porque en el PDF son frases sueltas, no una lista con categorías.
 */
function iconFor(text: string): IconName {
  const lower = text.toLocaleLowerCase('es-ES');
  if (lower.includes('agua')) return 'agua';
  if (lower.includes('aceite') || lower.includes('aove')) return 'aceite';
  if (lower.includes('duerme') || lower.includes('horas')) return 'sueno';
  if (lower.includes('alcohol')) return 'alcohol';
  if (lower.includes('tecnolog')) return 'tecnologia';
  if (lower.includes('deportista') || lower.includes('entren')) return 'entreno';
  if (lower.includes('comodín') || lower.includes('comodin')) return 'libre';
  return 'hoy';
}

export function MoreView() {
  const weekStart = currentWeekStart();
  const { data: plan } = usePlan(weekStart);
  const { data: profiles } = useProfiles();
  const myProfile = useMyProfile(true);
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [protocols, setProtocols] = useState<SupplementProtocol[] | null>(null);
  const [verHistorial, setVerHistorial] = useState(false);

  /* ── Historial de cambios ── */
  const scopes = useProfileDirectory();
  const blocks = useEditedBlocks(plan?.id, scopes);
  const changeLog = useChangeLog();
  const restore = useRestoreCell();

  const grupos = useMemo(
    () => describeChanges(changeLog.data ?? [], buildBlockTitles(plan ?? null, blocks.data)),
    [changeLog.data, plan, blocks.data],
  );

  /**
   * Restaurar desde el historial deshace la celda entera (plantilla y semana), que es lo
   * que espera quien mira "qué cambió" y quiere volver atrás.
   *
   * El registro guarda el `scope` tal como está en la base de datos (el UUID del perfil) y
   * el dominio trabaja con slugs, así que hay que cruzar esa frontera aquí.
   */
  const restaurar = (group: ChangeGroup) => {
    if (!plan || !scopes) return;

    for (const cell of group.cells) {
      if (cell.day === undefined || cell.scope === undefined) continue;

      // El registro guarda la franja como texto, porque es una copia cruda de la fila. Se
      // valida antes de usarla: si algún día aparece una franja que el dominio no conoce,
      // mejor no restaurar nada que restaurar mal.
      const slot = SlotKey.safeParse(cell.slot);
      if (!slot.success) continue;

      const plan2 = restoreCell(
        { day: cell.day, slot: slot.data, scope: scopes.toDomainScope(cell.scope) },
        plan.template,
        { level: 'template', weekStart },
      );
      restore.mutate({ planId: plan.id, weekStart, plan: plan2 });
    }

    setVerHistorial(false);
  };

  const mine = plan?.profiles.find((profile) => profile.profileId === myProfile.data?.slug);
  const cheatMeals = (plan?.recipes ?? []).filter((item) => item.kind === 'cheat_meal');
  const otherRecipes = (plan?.recipes ?? []).filter((item) => item.kind !== 'cheat_meal');

  return (
    <div className="mt-3 flex flex-col gap-3">
      {/* Suplementación del perfil */}
      {mine && mine.supplements.length > 0 && (
        <section className="rounded-day bg-surface p-4">
          <h2 className="text-dish font-bold text-ink">Entreno y suplementación</h2>
          <p className="mt-1 text-measure text-ink-muted">
            Tu protocolo para cada tipo de entreno.
          </p>
          <button
            type="button"
            onClick={() => setProtocols(mine.supplements)}
            className="mt-3 flex min-h-tap w-full items-center gap-3 rounded-block border border-line px-4 py-3 text-left"
          >
            <Icon name="entreno" size={20} />
            <span className="flex-1 text-item font-semibold text-ink">
              Ver los {mine.supplements.length} protocolos
            </span>
          </button>
        </section>
      )}

      {/* Comodín proteico */}
      {mine && mine.comodin.length > 0 && (
        <section className="rounded-day bg-surface p-4">
          <h2 className="text-dish font-bold text-ink">Comodín proteico</h2>
          <p className="mt-1 text-measure text-ink-muted">
            Obligatorio una vez al día. Estas son tus opciones y sus cantidades.
          </p>
          <ul className="mt-3 flex flex-col gap-1">
            {mine.comodin.map((option) => (
              <li
                key={option.id}
                className="flex flex-wrap items-baseline gap-x-2 border-t border-line/70 py-2 first:border-t-0"
              >
                <span className="text-item font-medium text-ink">{option.label}</span>
                <span className="text-item font-semibold text-ink">{option.amount}</span>
                {option.measure && (
                  <span className="text-measure text-ink-muted">({option.measure})</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Recetas */}
      {(cheatMeals.length > 0 || otherRecipes.length > 0) && (
        <section className="rounded-day bg-surface p-4">
          <h2 className="text-dish font-bold text-ink">Recetas</h2>
          <ul className="mt-2 flex flex-col gap-2">
            {[...cheatMeals, ...otherRecipes].map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setRecipe(item)}
                  className="flex min-h-tap w-full items-center gap-3 rounded-block border border-line px-4 py-3 text-left"
                >
                  <Icon name="receta" size={20} />
                  <span className="flex-1">
                    <span className="block text-item font-semibold text-ink">{item.title}</span>
                    {item.kind === 'cheat_meal' && (
                      <span className="block text-measure text-ink-muted">Día del glotón</span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Recomendaciones del plan */}
      {plan && plan.rules.recommendations.length > 0 && (
        <section className="rounded-day bg-surface p-4">
          <h2 className="text-dish font-bold text-ink">Recomendaciones</h2>
          <ul className="mt-2 flex flex-col">
            {plan.rules.recommendations.map((text) => (
              <li key={text} className="flex gap-3 border-t border-line/70 py-3 first:border-t-0">
                <span className="grid size-9 shrink-0 place-items-center rounded-chip bg-slot text-slot-ink">
                  <Icon name={iconFor(text)} size={18} />
                </span>
                <span className="flex-1 text-item text-ink">{text}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Historial de cambios */}
      <section className="rounded-day bg-surface p-4">
        <h2 className="text-dish font-bold text-ink">Historial de cambios</h2>
        <p className="mt-1 text-measure text-ink-muted">
          Quién movió qué y cuándo, en toda la casa.
        </p>
        <button
          type="button"
          onClick={() => setVerHistorial(true)}
          className="mt-3 flex min-h-tap w-full items-center gap-3 rounded-block border border-line px-4 py-3 text-left"
        >
          <Icon name="semana" size={20} />
          <span className="flex-1 text-item font-semibold text-ink">
            {grupos.length === 0 ? 'Ver el historial' : `Ver los últimos ${grupos.length} cambios`}
          </span>
        </button>
      </section>

      {/* Cuenta */}
      <section className="rounded-day bg-surface p-4">
        <h2 className="text-dish font-bold text-ink">Cuenta</h2>
        <p className="mt-1 text-measure text-ink-muted">
          Estás como{' '}
          <strong className="text-ink">
            {profiles?.find((profile) => profile.slug === myProfile.data?.slug)?.displayName ??
              'alguien'}
          </strong>
          .
        </p>
        <button
          type="button"
          onClick={() => void signOut()}
          className="mt-3 flex min-h-tap w-full items-center gap-3 rounded-block border border-line px-4 py-3 text-left"
        >
          <Icon name="salir" size={20} />
          <span className="flex-1 text-item font-semibold text-ink">Cerrar sesión</span>
        </button>
      </section>

      <Sheet
        open={verHistorial}
        onClose={() => setVerHistorial(false)}
        title="Historial de cambios"
        tall
      >
        <ChangeLogList groups={grupos} isLoading={changeLog.isPending} onRestore={restaurar} />
      </Sheet>

      <RecipeSheet recipe={recipe} onClose={() => setRecipe(null)} />

      <Sheet
        open={protocols !== null}
        onClose={() => setProtocols(null)}
        title="Entreno y suplementación"
      >
        {protocols && <SupplementList protocols={protocols} />}
      </Sheet>
    </div>
  );
}
