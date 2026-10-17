import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../../components/Icon';
import { Sheet } from '../../components/Sheet';
import { DaySkeleton, LoadingAnnounce } from '../../components/Skeleton';
import { Toast, type ToastState } from '../../components/Toast';
import { currentWeekStart, dayIndexOf, todayIn } from '../../domain/dates';
import { forkBlock, restoreCell } from '../../domain/edit';
import { canMarkFree, countFreeMeals } from '../../domain/freeMeals';
import { minutesNow, nextSlot } from '../../domain/mealTimes';
import { CheckIndex, dayProgress, type Progress } from '../../domain/progress';
import { anchorFor, type ChatAnchor } from '../../domain/chat';
import { cellId, isSharedSlot, type ResolvedSlot } from '../../domain/resolve';
import { swapCells, type SwapCell, type SwapLevel } from '../../domain/swap';
import type { Block, FoodItem, SlotKey, TemplateCell, WeekOverride } from '../../domain/schema';
import { brand } from '../../config/brand';
import { useMyProfile } from '../../data/auth';
import { useEquivalenceGroups, useFoods, useLibraryBlocks } from '../../data/library';
import { useApplyCells, useRestoreCell, useSaveBlock, useSetCheck } from '../../data/mutations';
import {
  useEditedBlocks,
  useHouseholdWeeks,
  useProfileDirectory,
  useResolvedWeek,
  useTemplateCells,
  useWeekChecks,
  useWeekDailyLogs,
  useWeekOverrides,
} from '../../data/queries';
import { useRealtimeSync } from '../../data/realtime';
import { useUiStore } from '../../stores/ui';
import { ChatSheet } from '../chat/ChatSheet';
import { BlockEditor } from '../editor/BlockEditor';
import { emptyBlock, newId } from '../editor/draft';
import { SwapSheet } from '../swap/SwapSheet';
import { TrainingSheet } from '../training/TrainingSheet';
import { TodayTrackers } from '../trackers/Trackers';
import { CheckContext, type CheckApi } from './checkContext';
import { SubstituteContext, type SubstituteApi } from './substituteContext';
import { SubstituteSheet } from './SubstituteSheet';
import { DayBar } from './DayBar';
import { LibrarySheet, type Comensales } from './LibrarySheet';
import { DayCard } from './DayCard';
import { HouseDayCard } from './HouseDayCard';
import { SLOT_LABEL } from './slots';
import { SundayCard } from './SundayCard';

const EMPTY_PROGRESS: Progress = { total: 0, done: 0, ratio: 0, complete: false };

export function WeekView({ onlyToday = false }: { onlyToday?: boolean }) {
  const activeProfile = useUiStore((state) => state.activeProfile);
  const weekStart = currentWeekStart();
  const todayIndex = dayIndexOf(todayIn());
  const scrolled = useRef(false);

  const [menuSlot, setMenuSlot] = useState<ResolvedSlot | null>(null);
  const [swapOrigin, setSwapOrigin] = useState<ResolvedSlot | null>(null);
  const [editorSlot, setEditorSlot] = useState<ResolvedSlot | null>(null);
  const [training, setTraining] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  /** Chat con la nutricionista. Con ancla si se abrió desde el menú de una franja. */
  const [chatAnchor, setChatAnchor] = useState<ChatAnchor | null>(null);
  const [verChat, setVerChat] = useState(false);
  /** La celda que se va a cambiar por un bloque de la biblioteca. */
  const [libraryFor, setLibraryFor] = useState<ResolvedSlot | null>(null);

  const isHouse = activeProfile === 'casa';
  const profileSlug = isHouse ? undefined : (activeProfile ?? undefined);

  const { plan, week, isLoading, error, planQuery } = useResolvedWeek(profileSlug, weekStart);
  const household = useHouseholdWeeks(weekStart);
  const directory = useProfileDirectory();
  const checks = useWeekChecks(weekStart, directory);
  const logs = useWeekDailyLogs(weekStart, directory);
  const overrides = useWeekOverrides(plan?.id, weekStart, directory);
  const templateCells = useTemplateCells(plan?.id, directory);
  const editedBlocks = useEditedBlocks(plan?.id, directory);
  const myProfile = useMyProfile(true);

  const setCheck = useSetCheck();
  const applyCells = useApplyCells();
  const restore = useRestoreCell();
  const grupos = useEquivalenceGroups();
  const catalogo = useFoods();
  const biblioteca = useLibraryBlocks();
  const [sustituyendo, setSustituyendo] = useState<{
    block: Block;
    item: FoodItem;
    date: string;
  } | null>(null);
  const saveBlock = useSaveBlock();

  useRealtimeSync(plan?.id, weekStart);

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

  /* ── Sustituir un alimento por un equivalente (fase 18) ── */

  const substituteApi = useMemo(
    (): SubstituteApi => ({
      // Solo se ofrece cuando de verdad hay opciones: con foodKey, en algún grupo vivo, y
      // mirando tu propio plan. Enseñar un botón que luego dice "no hay equivalentes" es
      // peor que no enseñarlo.
      canSubstitute: (item) =>
        // La función se puede apagar entera al clonar la app para otra consulta.
        brand.features.substitutions &&
        editable &&
        item.foodKey !== undefined &&
        (grupos.data ?? []).some(
          (group) =>
            !group.archived &&
            group.members.some((member) => member.foodKey === item.foodKey) &&
            group.members.length > 1,
        ),
      open: (block, item, date) => setSustituyendo({ block, item, date }),
    }),
    [editable, grupos.data],
  );

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

  if (isLoading || (isHouse && household.isLoading)) {
    return (
      <div className="mt-3 flex flex-col gap-3">
        <LoadingAnnounce>Cargando el plan</LoadingAnnounce>
        <DaySkeleton />
        <DaySkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <Message tone="error">
        No se pudo cargar el plan. Comprueba la conexión; lo último que se vio sigue guardado.
        <button
          type="button"
          onClick={() => void refetchAll()}
          className="mt-3 block min-h-tap w-full rounded-chip bg-accent px-4 font-bold text-accent-ink"
        >
          Reintentar
        </button>
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

  const refetchAll = async () => {
    await Promise.all([
      planQuery.refetch(),
      overrides.refetch(),
      templateCells.refetch(),
      editedBlocks.refetch(),
      checks.refetch(),
    ]);
  };

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
  const otherName = plan.profiles.find(
    (profile) => profile.profileId !== week.profileId,
  )?.displayName;

  /**
   * Bloques SIN filtrar por persona. La vista enseña solo lo tuyo, pero para editar un
   * plato compartido hacen falta las raciones de los dos.
   */
  const blockById = new Map<string, Block>();
  for (const block of plan.blocks) blockById.set(block.id, block);
  for (const block of editedBlocks.data ?? []) blockById.set(block.id, block);

  const originalBlockFor = (slot: ResolvedSlot): Block | null => {
    const cell = plan.template.find(
      (row) =>
        row.day === slot.cell.day && row.slot === slot.cell.slot && row.scope === slot.cell.scope,
    );
    return cell?.blockId ? (plan.blocks.find((b) => b.id === cell.blockId) ?? null) : null;
  };

  const peopleFor = (slot: ResolvedSlot) =>
    (slot.cell.scope === 'shared'
      ? plan.profiles
      : plan.profiles.filter((profile) => profile.profileId === slot.cell.scope)
    ).map((profile) => ({ profileId: profile.profileId, displayName: profile.displayName }));

  const doSaveBlock = (block: Block, level: SwapLevel) => {
    if (!editorSlot) return;
    const { day, slot: slotKey, scope } = editorSlot.cell;

    saveBlock.mutate({
      planId: plan.id,
      weekStart,
      block,
      upserts:
        level === 'week'
          ? [
              {
                level: 'week',
                row: { weekStart, day, slot: slotKey, scope, blockId: block.id, isFree: false },
              },
            ]
          : [{ level: 'template', row: { day, slot: slotKey, scope, blockId: block.id } }],
    });

    setEditorSlot(null);
    setToast({
      message: level === 'week' ? 'Guardado para esta semana' : 'Guardado en todo el plan',
    });
  };

  const asSwapCell = (slot: ResolvedSlot): SwapCell => ({
    cell: slot.cell,
    blockId: slot.blockId,
    isFree: slot.isFree,
  });

  /* ── Intercambio ── */

  const doSwap = (origin: ResolvedSlot, target: ResolvedSlot, level: SwapLevel) => {
    const result = swapCells(
      asSwapCell(origin),
      asSwapCell(target),
      level === 'week' ? { level: 'week', weekStart } : { level: 'template' },
    );

    if (!result.ok) {
      setToast({ message: 'No se puede intercambiar ahí.' });
      return;
    }

    // Para deshacer hay que devolver el estado EXACTO, no solo los bloques: si una celda no
    // tenía override, volver a escribirlo la dejaría marcada como cambiada esta semana.
    const touched = [origin.cell, target.cell];
    const undoUpserts =
      level === 'week'
        ? (overrides.data ?? [])
            .filter((row) => touched.some((cell) => cellId(cell) === cellId(row)))
            .map((row) => ({ level: 'week' as const, row: row as WeekOverride }))
        : (templateCells.data ?? [])
            .filter((row) => touched.some((cell) => cellId(cell) === cellId(row)))
            .map((row) => ({ level: 'template' as const, row: row as TemplateCell }));

    const undoDeletes =
      level === 'week'
        ? touched
            .filter((cell) => !(overrides.data ?? []).some((row) => cellId(row) === cellId(cell)))
            .map((cell) => ({
              weekStart,
              day: cell.day,
              slot: cell.slot,
              scope: cell.scope,
            }))
        : [];

    applyCells.mutate({ planId: plan.id, weekStart, upserts: result.upserts });
    setSwapOrigin(null);
    setMenuSlot(null);

    setToast({
      message: result.affectsBothProfiles ? 'Intercambiado para los dos' : 'Intercambiado',
      actionLabel: 'Deshacer',
      onAction: () =>
        applyCells.mutate({
          planId: plan.id,
          weekStart,
          upserts: undoUpserts,
          deleteOverrides: undoDeletes,
        }),
    });
  };

  const doRestore = (slot: ResolvedSlot) => {
    const level = slot.source === 'template' ? 'template' : 'week';
    const plan2 = restoreCell(slot.cell, plan.template, { level, weekStart });
    restore.mutate({ planId: plan.id, weekStart, plan: plan2 });
    setMenuSlot(null);
    setToast({ message: 'Restaurado el original' });
  };

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

  const doSubstitute = (cambiado: Block, level: SwapLevel) => {
    if (sustituyendo === null) return;

    /*
     * Copy-on-write, como en el editor (regla 6 de CLAUDE.md): nace un bloque NUEVO que
     * apunta al original. Sin esto se guardaba con el id del plato del plan y marcado como
     * original, así que "Restaurar original" se quedaba sin destino y el plato de la
     * nutricionista era irrecuperable.
     */
    const block = forkBlock(cambiado, { sections: cambiado.sections }, newId('bloque'));

    // La celda sale de la fecha y del propio bloque: el día de la fecha, y la franja y el
    // scope de quien lo come.
    const day = dayIndexOf(sustituyendo.date);
    const scope = sustituyendo.block.scope;
    const slotKey = sustituyendo.block.slot;

    saveBlock.mutate({
      planId: plan.id,
      weekStart,
      block,
      upserts:
        level === 'week'
          ? [
              {
                level: 'week',
                row: { weekStart, day, slot: slotKey, scope, blockId: block.id, isFree: false },
              },
            ]
          : [{ level: 'template', row: { day, slot: slotKey, scope, blockId: block.id } }],
    });

    setSustituyendo(null);
    setToast({
      message: level === 'week' ? 'Cambiado esta semana' : 'Cambiado en todo el plan',
    });
  };

  /** Quién come de esta celda y cuánto, para repartir la ración base de la biblioteca. */
  const comensalesDe = (slot: ResolvedSlot): Comensales =>
    peopleFor(slot).map((person) => ({
      ...person,
      multiplier: directory?.bySlug(person.profileId)?.portionMultiplier ?? 1,
    }));

  /**
   * Cambiar la celda entera por un bloque de la biblioteca.
   *
   * Copy-on-write como en el editor y en las sustituciones: nace un bloque nuevo que apunta
   * al original, para que "Restaurar original" tenga a dónde volver. Si la celda estaba
   * vacía no hay original: es un bloque nuevo y punto.
   */
  const doLibrarySwap = (sections: Block['sections'], level: SwapLevel) => {
    if (!libraryFor) return;
    const { day, slot: slotKey, scope } = libraryFor.cell;

    const previo = libraryFor.blockId ? blockById.get(libraryFor.blockId) : undefined;
    const block: Block = previo
      ? forkBlock(previo, { sections }, newId('bloque'))
      : { id: newId('bloque'), planId: plan.id, slot: slotKey, scope, sections, isOriginal: false };

    saveBlock.mutate({
      planId: plan.id,
      weekStart,
      block,
      upserts:
        level === 'week'
          ? [
              {
                level: 'week',
                row: { weekStart, day, slot: slotKey, scope, blockId: block.id, isFree: false },
              },
            ]
          : [{ level: 'template', row: { day, slot: slotKey, scope, blockId: block.id } }],
    });

    setLibraryFor(null);
    setToast({
      message: level === 'week' ? 'Cambiado esta semana' : 'Cambiado en todo el plan',
    });
  };

  return (
    <CheckContext.Provider value={checkApi}>
      <SubstituteContext.Provider value={substituteApi}>
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
                onTraining={setTraining}
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

        {/* Menú de la franja */}
        <Sheet
          open={menuSlot !== null && swapOrigin === null}
          onClose={() => setMenuSlot(null)}
          title={menuSlot ? SLOT_LABEL[menuSlot.cell.slot] : ''}
        >
          {menuSlot && (
            <div className="flex flex-col gap-2 pb-2">
              <MenuAction
                icon="semana"
                label="Intercambiar con otro día"
                hint={
                  isSharedSlot(menuSlot.cell.slot) && otherName
                    ? `Cambia también para ${otherName}`
                    : undefined
                }
                onClick={() => setSwapOrigin(menuSlot)}
              />

              {brand.features.substitutions && (
                <MenuAction
                  icon="receta"
                  label="Cambiar por otro de la biblioteca"
                  hint="Platos que ha preparado tu nutricionista"
                  onClick={() => {
                    setLibraryFor(menuSlot);
                    setMenuSlot(null);
                  }}
                />
              )}

              <MenuAction
                icon="mas"
                label={menuSlot.blockId === null ? 'Crear comida aquí' : 'Editar'}
                hint={
                  menuSlot.blockId === null
                    ? 'La celda está vacía'
                    : 'Crea una copia; el plan original no se toca'
                }
                onClick={() => {
                  setEditorSlot(menuSlot);
                  setMenuSlot(null);
                }}
              />

              {brand.features.chat && (
                <MenuAction
                  icon="mensaje"
                  label="Preguntar sobre esto"
                  hint="Le llega a tu nutricionista con la comida enganchada"
                  onClick={() => {
                    setChatAnchor(anchorFor(menuSlot.cell, menuSlot.block, menuSlot.date));
                    setVerChat(true);
                    setMenuSlot(null);
                  }}
                />
              )}

              <MenuAction
                icon="libre"
                label={menuSlot.isFree ? 'Quitar la ingesta libre' : 'Marcar como ingesta libre'}
                hint={
                  menuSlot.isFree
                    ? 'Volverá a contar como una comida del plan'
                    : canFree
                      ? `Has usado ${freeUsed} de ${plan.rules.freeMealsPerWeek} esta semana`
                      : `Ya has usado las ${plan.rules.freeMealsPerWeek} de esta semana`
                }
                disabled={!canFree}
                onClick={() => markFree(menuSlot, !menuSlot.isFree)}
              />

              {menuSlot.source !== 'original' && (
                <MenuAction
                  icon="hoy"
                  label="Restaurar original"
                  hint={
                    menuSlot.source === 'week'
                      ? 'Deshace el cambio de esta semana'
                      : 'Deshace el cambio en todo el plan'
                  }
                  onClick={() => doRestore(menuSlot)}
                />
              )}
            </div>
          )}
        </Sheet>

        <SwapSheet
          key={swapOrigin ? cellId(swapOrigin.cell) : 'sin-origen'}
          open={swapOrigin !== null}
          onClose={() => setSwapOrigin(null)}
          origin={swapOrigin}
          week={week}
          otherName={otherName}
          onConfirm={(target, level) => swapOrigin && doSwap(swapOrigin, target, level)}
        />

        {editorSlot && (
          <BlockEditor
            key={cellId(editorSlot.cell)}
            open
            onClose={() => setEditorSlot(null)}
            source={
              (editorSlot.blockId ? blockById.get(editorSlot.blockId) : undefined) ??
              emptyBlock(
                plan.id,
                editorSlot.cell.slot,
                editorSlot.cell.scope,
                peopleFor(editorSlot).map((person) => person.profileId),
              )
            }
            original={originalBlockFor(editorSlot)}
            people={peopleFor(editorSlot)}
            foods={plan.foods}
            onSave={doSaveBlock}
          />
        )}

        <TrainingSheet
          training={training}
          protocols={
            plan.profiles.find((profile) => profile.profileId === week.profileId)?.supplements ?? []
          }
          onClose={() => setTraining(null)}
        />

        <LibrarySheet
          key={libraryFor ? cellId(libraryFor.cell) : 'sin-celda'}
          open={libraryFor !== null}
          slot={libraryFor}
          people={libraryFor ? comensalesDe(libraryFor) : []}
          blocks={biblioteca.data ?? []}
          isLoading={biblioteca.isPending}
          otherName={otherName}
          onClose={() => setLibraryFor(null)}
          onApply={doLibrarySwap}
        />

        <SubstituteSheet
          open={sustituyendo !== null}
          block={sustituyendo?.block ?? null}
          item={sustituyendo?.item ?? null}
          profileId={week.profileId}
          shared={sustituyendo?.block.scope === 'shared'}
          groups={grupos.data ?? []}
          foods={catalogo.data ?? []}
          onClose={() => setSustituyendo(null)}
          onApply={doSubstitute}
        />

        {/* Montada solo al abrirla: si no, la pantalla principal cargaría el hilo y abriría
            un canal de Realtime que casi nadie va a mirar. */}
        {verChat && (
          <ChatSheet
            open
            anchor={chatAnchor}
            onClearAnchor={() => setChatAnchor(null)}
            onClose={() => {
              setVerChat(false);
              setChatAnchor(null);
            }}
          />
        )}

        <Toast toast={toast} onClose={() => setToast(null)} />
      </SubstituteContext.Provider>
    </CheckContext.Provider>
  );
}

function MenuAction({
  icon,
  label,
  hint,
  disabled = false,
  onClick,
}: {
  icon: 'semana' | 'libre' | 'hoy' | 'mas' | 'mensaje' | 'receta';
  label: string;
  hint?: string | undefined;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex min-h-tap w-full items-center gap-3 rounded-block border border-line px-4 py-3 text-left disabled:opacity-50"
    >
      <Icon name={icon} size={20} />
      <span className="flex-1">
        <span className="block text-item font-semibold text-ink">{label}</span>
        {hint && <span className="block text-measure text-ink-muted">{hint}</span>}
      </span>
    </button>
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
