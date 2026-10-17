/**
 * Conversación entre una persona y su nutricionista.
 *
 * Lógica pura: agrupar por día, contar lo que queda por leer y poner nombre a la comida de
 * la que se habla. Nada de esto sabe de Supabase ni de React.
 *
 * Un hilo por persona. No hay IA: son dos personas hablando.
 */
import { DAY_NAMES } from './dates';
import type { Block, SlotKey } from './schema';

export type ChatRole = 'cliente' | 'nutricionista';

/** La comida de la que se pregunta, si el mensaje salió del menú de una franja. */
export type ChatAnchor = {
  day?: number;
  slot?: SlotKey | string;
  date?: string;
  /** Lo que se veía en pantalla: "Lentejas con verduras". */
  title?: string;
};

export type ChatMessage = {
  id: string;
  authorRole: ChatRole;
  authorName: string | null;
  body: string;
  anchor: ChatAnchor | null;
  createdAt: string;
};

const SLOT_LABELS: Record<string, string> = {
  desayuno: 'el desayuno',
  snack: 'el snack',
  snack2: 'el segundo snack',
  almuerzo: 'el almuerzo',
  comida: 'la comida',
  cena: 'la cena',
};

/**
 * "Sobre la cena del martes · Dorada al horno".
 *
 * Devuelve null si no hay nada que anclar: un mensaje suelto no lleva coletilla.
 */
export function anchorLabel(anchor: ChatAnchor | null): string | null {
  if (anchor === null) return null;

  const franja = anchor.slot === undefined ? null : (SLOT_LABELS[anchor.slot] ?? anchor.slot);
  const dia = anchor.day === undefined ? null : (DAY_NAMES[anchor.day] ?? null);

  const partes: string[] = [];
  if (franja !== null && dia !== null) {
    partes.push(`Sobre ${franja} del ${dia.toLocaleLowerCase('es-ES')}`);
  } else if (franja !== null) {
    partes.push(`Sobre ${franja}`);
  }

  if (anchor.title !== undefined && anchor.title !== '') partes.push(anchor.title);

  return partes.length === 0 ? null : partes.join(' · ');
}

/**
 * El ancla con la que sale un mensaje preguntado desde el menú de una franja.
 *
 * El título es el del primer plato que tenga nombre, que es lo que se lee en la tarjeta: si
 * la celda está vacía o solo trae pan, el ancla se queda en día y franja.
 */
export function anchorFor(
  cell: { day: number; slot: SlotKey },
  block: Pick<Block, 'sections'> | null,
  date?: string,
): ChatAnchor {
  const title = block?.sections.find((section) => section.title !== undefined)?.title;

  return {
    day: cell.day,
    slot: cell.slot,
    ...(date !== undefined ? { date } : {}),
    ...(title !== undefined ? { title } : {}),
  };
}

/**
 * Cuántos mensajes quedan por leer.
 *
 * Solo cuentan los de la OTRA parte: tus propios mensajes no son novedades para ti. Si
 * nunca se ha leído nada (`lastReadAt` nulo), cuentan todos los ajenos.
 */
export function unreadCount(
  messages: readonly ChatMessage[],
  lastReadAt: string | null,
  myRole: ChatRole,
): number {
  return messages.filter(
    (message) =>
      message.authorRole !== myRole && (lastReadAt === null || message.createdAt > lastReadAt),
  ).length;
}

export type ChatDay = { date: string; messages: ChatMessage[] };

/**
 * Agrupa por día del calendario, de más antiguo a más reciente: una conversación se lee
 * hacia abajo, al revés que un historial de cambios.
 */
export function groupByDay(messages: readonly ChatMessage[]): ChatDay[] {
  const porDia = new Map<string, ChatMessage[]>();

  for (const message of [...messages].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    const dia = message.createdAt.slice(0, 10);
    const lista = porDia.get(dia);
    if (lista) lista.push(message);
    else porDia.set(dia, [message]);
  }

  return [...porDia.entries()].map(([date, msgs]) => ({ date, messages: msgs }));
}

/** El último mensaje, para enseñar un adelanto en la lista de hilos de la nutricionista. */
export function lastMessage(messages: readonly ChatMessage[]): ChatMessage | null {
  let ultimo: ChatMessage | null = null;
  for (const message of messages) {
    if (ultimo === null || message.createdAt > ultimo.createdAt) ultimo = message;
  }
  return ultimo;
}
