import { Icon } from '../../components/Icon';
import { useLongPress } from '../../components/useLongPress';
import { dayNameOf, shortDateOf } from '../../domain/format';
import { itemIdsOf } from '../../domain/progress';
import { isSharedSlot, type ResolvedDay, type ResolvedSlot } from '../../domain/resolve';
import type { ProfileId } from '../../domain/schema';
import { BlockCard } from './BlockCard';
import { useCheckApi } from './checkContext';
import { isAccentDay, SLOT_ICON, SLOT_LABEL } from './slots';

function SlotRow({
  slot,
  profileId,
  highlighted,
  onMenu,
}: {
  slot: ResolvedSlot;
  profileId: ProfileId;
  highlighted: boolean;
  onMenu: (slot: ResolvedSlot) => void;
}) {
  const key = slot.cell.slot;
  const checks = useCheckApi();

  const itemIds = itemIdsOf(slot);
  const done = itemIds.filter((itemId) => checks?.isChecked(slot.date, key, itemId)).length;
  const complete = itemIds.length > 0 && done === itemIds.length;

  // Mantener pulsada la etiqueta marca o desmarca la franja entera.
  const longPress = useLongPress(() => {
    if (checks?.editable && itemIds.length > 0) {
      checks.toggleSlot(slot.date, key, itemIds, !complete);
    }
  });

  return (
    <section
      className={`flex gap-2 rounded-block transition-opacity ${
        highlighted ? 'ring-2 ring-accent' : ''
      } ${complete ? 'opacity-70' : ''}`}
      aria-label={SLOT_LABEL[key]}
    >
      {/* Columna marina de la izquierda, como en el PDF. Lleva dentro el menú de la franja
          para no gastar una tercera columna: en 390 px no sobra ni un píxel. */}
      <div className="flex w-[5.5rem] shrink-0 flex-col rounded-block bg-slot text-slot-ink">
        <button
          type="button"
          {...longPress}
          aria-label={
            checks?.editable && itemIds.length > 0
              ? `${SLOT_LABEL[key]}. Mantén pulsado para marcar la franja entera`
              : SLOT_LABEL[key]
          }
          className="flex flex-1 flex-col items-center gap-1 px-1 py-2"
        >
          <Icon name={SLOT_ICON[key]} size={20} />
          {/* Dos detalles con trampa:
              · w-full impide que el texto se desborde (un elemento flex no se encoge por
                debajo de su contenido, así que sin ancho explícito no parte la palabra).
              · El tamaño se pide como `text-(length:--text-slot)` y NO como `text-slot`:
                tokens.css define --color-slot y --text-slot, y las dos generan la misma
                clase. Gana el color, y el texto saldría marino sobre marino. */}
          <span className="w-full text-center text-(length:--text-slot) font-extrabold leading-tight break-words">
            {SLOT_LABEL[key]}
          </span>
          {complete && (
            <span className="mt-0.5 rounded-chip bg-accent px-1.5 text-[0.625rem] font-bold text-accent-ink">
              Hecho
            </span>
          )}
        </button>

        {checks?.editable && (
          <button
            type="button"
            onClick={() => onMenu(slot)}
            aria-label={`Opciones de ${SLOT_LABEL[key]}`}
            className="grid h-10 place-items-center border-t border-slot-ink/25"
          >
            <Icon name="mas" size={18} />
          </button>
        )}
      </div>

      <div className="min-w-0 flex-1">
        {slot.isFree ? (
          <p className="flex items-center gap-2 rounded-block bg-free p-3 text-item font-semibold text-ink">
            <Icon name="libre" size={18} />
            Ingesta libre
          </p>
        ) : slot.block ? (
          <BlockCard
            block={slot.block}
            profileId={profileId}
            shared={isSharedSlot(key)}
            date={slot.date}
            slot={key}
          />
        ) : (
          <p className="rounded-block bg-bg p-3 text-item text-ink-muted">Sin nada previsto</p>
        )}
      </div>
    </section>
  );
}

export function DayCard({
  day,
  profileId,
  isToday,
  nextSlotKey,
  onSlotMenu,
}: {
  day: ResolvedDay;
  profileId: ProfileId;
  isToday: boolean;
  nextSlotKey: string | null;
  onSlotMenu: (slot: ResolvedSlot) => void;
}) {
  const accent = isAccentDay(day.day);

  return (
    <article
      id={`dia-${day.day}`}
      data-day-anchor=""
      className={`rounded-day p-4 ${
        accent ? 'border-l-4 border-surface-alt-edge bg-surface-alt' : 'bg-surface'
      }`}
    >
      <header className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <h2 className="text-day font-extrabold tracking-[0.02em] text-ink">
          {dayNameOf(day.date)}
        </h2>
        <p className="text-measure text-ink-muted">{shortDateOf(day.date)}</p>
        {isToday && (
          <span className="rounded-chip bg-accent px-2 py-0.5 text-measure font-bold text-accent-ink">
            Hoy
          </span>
        )}
        {day.training && (
          <span className="ml-auto flex items-center gap-1 rounded-chip border border-line px-2 py-0.5 text-measure font-semibold text-ink">
            <Icon name="entreno" size={14} />
            {day.training}
          </span>
        )}
      </header>

      <div className="mt-3 flex flex-col gap-2">
        {day.slots.map((slot) => (
          <SlotRow
            key={slot.cell.slot}
            slot={slot}
            profileId={profileId}
            highlighted={isToday && slot.cell.slot === nextSlotKey}
            onMenu={onSlotMenu}
          />
        ))}
      </div>
    </article>
  );
}
