/**
 * Fechas del plan. Las semanas empiezan en lunes y la zona horaria de referencia es
 * Europe/Madrid (CLAUDE.md, regla 10).
 *
 * Todo el módulo trabaja con fechas ISO "YYYY-MM-DD", no con Date. La aritmética se hace
 * en UTC a propósito: UTC no tiene horario de verano, así que sumar días nunca se desvía
 * una hora. La zona horaria solo interviene al preguntar "¿qué día es hoy en Madrid?",
 * que es lo único que depende de un instante concreto.
 */

/** Fecha ISO "YYYY-MM-DD". */
export type IsoDateString = string;

/** 0 = lunes … 6 = domingo. */
export type DayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const TIME_ZONE = 'Europe/Madrid';

export const DAY_NAMES: readonly string[] = [
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
  'Domingo',
];

/** Iniciales de la barra de días: L M X J V S D. */
export const DAY_INITIALS: readonly string[] = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

export function isIsoDate(value: unknown): value is IsoDateString {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return false;
  // Descarta fechas con forma válida pero inexistentes, como "2026-02-30".
  return toUtcMs(value) !== null;
}

function toUtcMs(date: IsoDateString): number | null {
  const match = ISO_DATE.exec(date);
  if (!match) return null;
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const ms = Date.UTC(year, month - 1, day);
  const roundTrip = new Date(ms);
  if (
    roundTrip.getUTCFullYear() !== year ||
    roundTrip.getUTCMonth() !== month - 1 ||
    roundTrip.getUTCDate() !== day
  ) {
    return null;
  }
  return ms;
}

function requireUtcMs(date: IsoDateString): number {
  const ms = toUtcMs(date);
  if (ms === null) throw new RangeError(`Fecha ISO inválida: ${date}`);
  return ms;
}

function fromUtcMs(ms: number): IsoDateString {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Índice de día con el lunes a 0 (Date usa el domingo a 0). */
export function dayIndexOf(date: IsoDateString): DayIndex {
  const weekday = new Date(requireUtcMs(date)).getUTCDay();
  return ((weekday + 6) % 7) as DayIndex;
}

export function addDays(date: IsoDateString, days: number): IsoDateString {
  return fromUtcMs(requireUtcMs(date) + days * MS_PER_DAY);
}

/** Lunes de la semana a la que pertenece la fecha. */
export function weekStartOf(date: IsoDateString): IsoDateString {
  return addDays(date, -dayIndexOf(date));
}

/** Los siete días de la semana que empieza en weekStart, de lunes a domingo. */
export function isoWeekDates(weekStart: IsoDateString): IsoDateString[] {
  const monday = weekStartOf(weekStart);
  return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
}

/** Días entre dos fechas (b - a). Negativo si b es anterior. */
export function daysBetween(a: IsoDateString, b: IsoDateString): number {
  return Math.round((requireUtcMs(b) - requireUtcMs(a)) / MS_PER_DAY);
}

export function isBefore(a: IsoDateString, b: IsoDateString): boolean {
  return requireUtcMs(a) < requireUtcMs(b);
}

export function isSameOrAfter(a: IsoDateString, b: IsoDateString): boolean {
  return requireUtcMs(a) >= requireUtcMs(b);
}

/**
 * Fecha de hoy en Madrid. Es la única función que depende de un instante, por eso recibe
 * el `now` en vez de leer el reloj: así se puede testear.
 */
export function todayIn(now: Date = new Date(), timeZone: string = TIME_ZONE): IsoDateString {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';

  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Lunes de la semana en curso en Madrid. */
export function currentWeekStart(now: Date = new Date(), timeZone: string = TIME_ZONE) {
  return weekStartOf(todayIn(now, timeZone));
}
