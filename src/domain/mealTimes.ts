/**
 * Horas por defecto de cada franja y cálculo de "la siguiente comida".
 *
 * Sirve para resaltar en la vista Hoy lo que toca ahora. Es pura y recibe la hora, así que
 * se puede testear sin tocar el reloj. Las horas serán configurables desde Más (fase 11);
 * de momento son las de la tabla de abajo.
 */
import type { SlotKey } from './schema';

/** Minutos desde medianoche en los que suele caer cada franja. */
export const DEFAULT_SLOT_TIMES: Record<SlotKey, string> = {
  desayuno: '08:00',
  snack: '11:00',
  almuerzo: '11:00',
  snack2: '17:30',
  comida: '14:30',
  cena: '21:00',
};

export function minutesOf(time: string): number {
  const [hours, minutes] = time.split(':');
  return Number(hours) * 60 + Number(minutes ?? 0);
}

/** Minutos desde medianoche de un instante, en la zona indicada. */
export function minutesNow(now: Date, timeZone = 'Europe/Madrid'): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? '0');

  return get('hour') * 60 + get('minute');
}

/**
 * La franja que toca ahora: la primera cuya hora no ha pasado todavía. Si ya ha pasado la
 * última del día, devuelve null (la jornada está hecha).
 */
export function nextSlot(
  slots: readonly SlotKey[],
  minutes: number,
  times: Record<SlotKey, string> = DEFAULT_SLOT_TIMES,
): SlotKey | null {
  const upcoming = slots
    .map((slot) => ({ slot, at: minutesOf(times[slot]) }))
    .sort((a, b) => a.at - b.at)
    .find((entry) => entry.at >= minutes);

  return upcoming?.slot ?? null;
}

/** Orden en que se enseñan las franjas del día, por hora. */
export function sortSlotsByTime(
  slots: readonly SlotKey[],
  times: Record<SlotKey, string> = DEFAULT_SLOT_TIMES,
): SlotKey[] {
  return [...slots].sort((a, b) => minutesOf(times[a]) - minutesOf(times[b]));
}
