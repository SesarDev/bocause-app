import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../components/Icon';
import { Sheet } from '../../components/Sheet';
import { DAY_NAMES } from '../../domain/dates';
import { isSharedSlot, type ResolvedSlot, type ResolvedWeek } from '../../domain/resolve';
import { swapValidation, type SwapCell, type SwapLevel } from '../../domain/swap';
import { SLOT_LABEL } from '../week/slots';

/** Resumen corto de lo que hay en una celda, para el carrusel. */
function summarize(slot: ResolvedSlot): string[] {
  if (slot.isFree) return ['Ingesta libre'];
  if (!slot.block) return [];
  return slot.block.sections
    .filter((section) => section.kind === 'plato')
    .map((section) => section.title ?? section.items.map((item) => item.label).join(', '))
    .filter((text) => text.length > 0);
}

/**
 * Hoja de intercambio: la misma franja en los siete días, en carrusel horizontal con
 * scroll-snap. El día de origen aparece marcado y los destinos válidos son todos los demás,
 * incluidas las celdas vacías del domingo (intercambiar con vacío mueve la comida).
 */
export function SwapSheet({
  open,
  onClose,
  origin,
  week,
  otherName,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  origin: ResolvedSlot | null;
  week: ResolvedWeek;
  /** Nombre de la otra persona, para avisar en los bloques compartidos. */
  otherName: string | undefined;
  onConfirm: (target: ResolvedSlot, level: SwapLevel) => void;
}) {
  const [target, setTarget] = useState<ResolvedSlot | null>(null);
  const [level, setLevel] = useState<SwapLevel>('week');
  const trackRef = useRef<HTMLUListElement>(null);

  // El estado inicial no se resetea aquí: WeekView remonta la hoja con una `key` por celda
  // de origen, que es la forma de React de empezar de cero. El efecto solo centra el día.
  useEffect(() => {
    if (!open || !origin) return;
    const card = trackRef.current?.querySelector(`[data-day="${origin.cell.day}"]`);
    card?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [open, origin]);

  if (!origin) return null;

  const slotKey = origin.cell.slot;
  const candidates = week.days
    .map((day) => day.slots.find((slot) => slot.cell.slot === slotKey))
    .filter((slot) => slot !== undefined);

  const asSwapCell = (slot: ResolvedSlot): SwapCell => ({
    cell: slot.cell,
    blockId: slot.blockId,
    isFree: slot.isFree,
  });

  const shared = isSharedSlot(slotKey);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={`Intercambiar ${SLOT_LABEL[slotKey].toLowerCase()}`}
    >
      <p className="text-measure text-ink-muted">
        Elige con qué día lo cambias. El bloque viaja entero, con su pan y su postre.
      </p>

      {/* Carrusel: scroll-snap, sin librerías (CLAUDE.md). */}
      <ul
        ref={trackRef}
        className="-mx-4 mt-3 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-2"
      >
        {candidates.map((slot) => {
          const isOrigin = slot.cell.day === origin.cell.day;
          const problem = swapValidation(asSwapCell(origin), asSwapCell(slot));
          const selectable = !isOrigin && problem === null;
          const selected = target?.cell.day === slot.cell.day;
          const lines = summarize(slot);

          return (
            <li key={slot.cell.day} data-day={slot.cell.day} className="w-40 shrink-0 snap-center">
              <button
                type="button"
                disabled={!selectable}
                onClick={() => setTarget(slot)}
                aria-pressed={selected}
                className={`flex h-full w-full flex-col rounded-block border p-3 text-left transition-colors ${
                  selected
                    ? 'border-accent bg-accent/15'
                    : isOrigin
                      ? 'border-slot bg-shared'
                      : 'border-line'
                } ${!selectable && !isOrigin ? 'opacity-40' : ''}`}
              >
                <span className="text-measure font-extrabold tracking-[0.06em] text-ink">
                  {(DAY_NAMES[slot.cell.day] ?? '').toLocaleUpperCase('es-ES')}
                </span>
                {isOrigin && (
                  <span className="mt-0.5 text-measure font-semibold text-ink-muted">
                    De aquí sale
                  </span>
                )}
                <span className="mt-1 flex-1 text-measure text-ink-muted">
                  {lines.length > 0 ? lines.join(' · ') : 'Vacío'}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {target && (
        <div className="mt-3 border-t border-line pt-3">
          {/* El día elegido puede quedar fuera de pantalla en el carrusel, así que se dice
              aquí con todas las letras antes de confirmar. */}
          <p className="text-item text-ink">
            Cambias la de{' '}
            <strong className="font-bold">
              {(DAY_NAMES[origin.cell.day] ?? '').toLocaleLowerCase('es-ES')}
            </strong>{' '}
            por la de{' '}
            <strong className="font-bold">
              {(DAY_NAMES[target.cell.day] ?? '').toLocaleLowerCase('es-ES')}
            </strong>
            .
          </p>
          <p className="mt-3 text-item font-semibold text-ink">¿Para cuándo?</p>
          <div className="mt-2 flex gap-2">
            {(['week', 'template'] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setLevel(option)}
                aria-pressed={level === option}
                className={`min-h-tap flex-1 rounded-chip border px-3 text-item font-semibold ${
                  level === option ? 'border-accent bg-accent/15 text-ink' : 'border-line text-ink'
                }`}
              >
                {option === 'week' ? 'Solo esta semana' : 'Todo el plan'}
              </button>
            ))}
          </div>

          {shared && otherName && (
            <p className="mt-3 flex items-start gap-2 rounded-block bg-shared p-3 text-measure text-ink">
              <Icon name="compartido" size={16} />
              Cambia también para {otherName}: es un plato compartido.
            </p>
          )}

          <button
            type="button"
            onClick={() => onConfirm(target, level)}
            className="mt-3 min-h-tap w-full rounded-chip bg-accent px-4 font-bold text-accent-ink"
          >
            Intercambiar con {(DAY_NAMES[target.cell.day] ?? '').toLocaleLowerCase('es-ES')}
          </button>
        </div>
      )}
    </Sheet>
  );
}
