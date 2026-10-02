import { Icon } from '../../components/Icon';
import { dayNameOf, shortDateOf } from '../../domain/format';
import { isSharedSlot, type ResolvedDay, type ResolvedSlot } from '../../domain/resolve';
import type { ProfileId } from '../../domain/schema';
import { BlockCard } from './BlockCard';
import { isAccentDay, SLOT_ICON, SLOT_LABEL } from './slots';

function SlotRow({
  slot,
  profileId,
  highlighted,
}: {
  slot: ResolvedSlot;
  profileId: ProfileId;
  highlighted: boolean;
}) {
  const key = slot.cell.slot;

  return (
    <section
      className={`flex gap-2 rounded-block ${highlighted ? 'ring-2 ring-accent' : ''}`}
      aria-label={SLOT_LABEL[key]}
    >
      {/* Etiqueta marina a la izquierda, como la columna del PDF. El ancho da para
          "DESAYUNO" y "ALMUERZO", que son las más largas. */}
      <p className="flex w-24 shrink-0 flex-col items-center justify-start gap-1 rounded-block bg-slot px-1.5 py-2 text-slot-ink">
        <Icon name={SLOT_ICON[key]} size={20} />
        {/* Dos detalles con trampa:
            · w-full impide que el texto se desborde (un elemento flex no se encoge por
              debajo de su contenido, así que sin ancho explícito no parte la palabra).
            · El tamaño se pide como `text-(length:--text-slot)` y NO como `text-slot`:
              tokens.css define --color-slot y --text-slot, y las dos generan la misma clase
              `text-slot`. Gana el color, y el texto saldría marino sobre marino. */}
        <span className="w-full text-center text-(length:--text-slot) font-extrabold leading-tight tracking-[0.03em] break-words">
          {SLOT_LABEL[key]}
        </span>
      </p>

      <div className="min-w-0 flex-1">
        {slot.isFree ? (
          <p className="flex items-center gap-2 rounded-block bg-free p-3 text-item font-semibold text-ink">
            <Icon name="libre" size={18} />
            Ingesta libre
          </p>
        ) : slot.block ? (
          <BlockCard block={slot.block} profileId={profileId} shared={isSharedSlot(key)} />
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
}: {
  day: ResolvedDay;
  profileId: ProfileId;
  isToday: boolean;
  nextSlotKey: string | null;
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
          />
        ))}
      </div>
    </article>
  );
}
