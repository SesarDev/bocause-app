/**
 * Los hilos de la nutricionista con cada persona.
 *
 * Un hilo por persona y no por hogar: Cristina y Andrés comparten cena, pero no sus dudas.
 * Aquí se ve la lista con quién tiene algo sin leer, y al entrar, la conversación.
 *
 * Los avisos son solo dentro de la app (un punto). No hay correo ni push todavía: conviene
 * entrar a mirar, porque una pregunta sin responder es peor que una notificación de más.
 */
import { useEffect, useMemo, useState } from 'react';
import { lastMessage, unreadCount } from '../../domain/chat';
import { shortDateOf } from '../../domain/format';
import { useHouseholds } from '../../data/builder';
import {
  lastReadOf,
  useChatReads,
  useChatRealtime,
  useMarkRead,
  useSendMessage,
  useThread,
} from '../../data/chat';
import { setActiveHousehold } from '../../data/scope';
import { ChatThread } from '../chat/ChatThread';

/** Una fila por persona de la consulta, con su hogar al lado para saber quién es quién. */
type Fila = { profileId: string; nombre: string; hogar: string; householdId: string };

function Conversacion({ fila, onVolver }: { fila: Fila; onVolver: () => void }) {
  // Las consultas del hilo cuelgan del hogar activo, así que hay que decir cuál se mira.
  useEffect(() => {
    setActiveHousehold(fila.householdId);
    return () => setActiveHousehold(null);
  }, [fila.householdId]);

  const thread = useThread(fila.profileId);
  const send = useSendMessage(fila.profileId);
  const markRead = useMarkRead();
  useChatRealtime(fila.profileId);

  const ultimo = thread.data?.[thread.data.length - 1]?.createdAt ?? null;
  useEffect(() => {
    if (ultimo !== null) markRead.mutate({ profileId: fila.profileId, role: 'nutricionista' });
    // `markRead` cambia de identidad en cada render; incluirlo dispararía un bucle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fila.profileId, ultimo]);

  return (
    <section className="rounded-day bg-surface p-6">
      <header className="flex flex-wrap items-center gap-3">
        <span className="flex-1">
          <h1 className="text-dish font-bold text-ink">{fila.nombre}</h1>
          <p className="text-measure text-ink-muted">{fila.hogar}</p>
        </span>
        <button
          type="button"
          onClick={onVolver}
          className="text-measure font-semibold text-ink-muted underline"
        >
          Volver a los mensajes
        </button>
      </header>

      <div className="mt-4">
        <ChatThread
          messages={thread.data ?? []}
          myRole="nutricionista"
          isLoading={thread.isPending}
          sending={send.isPending}
          onSend={(body) => send.mutate({ body })}
        />
      </div>
    </section>
  );
}

function Resumen({ fila, onAbrir }: { fila: Fila; onAbrir: () => void }) {
  const thread = useThread(fila.profileId);
  const reads = useChatReads();

  const lastRead = lastReadOf(reads.data, fila.profileId, 'nutricionista');
  const sinLeer = unreadCount(thread.data ?? [], lastRead, 'nutricionista');
  const ultimo = lastMessage(thread.data ?? []);

  return (
    <li>
      <button
        type="button"
        onClick={onAbrir}
        className="flex min-h-tap w-full flex-wrap items-center gap-3 rounded-block border border-line px-4 py-3 text-left"
      >
        <span className="flex-1">
          <span className="block text-item font-semibold text-ink">
            {fila.nombre} <span className="font-normal text-ink-muted">· {fila.hogar}</span>
          </span>
          <span className="block text-measure text-ink-muted">
            {ultimo === null
              ? 'Sin mensajes todavía'
              : `${ultimo.authorRole === 'nutricionista' ? 'Tú: ' : ''}${ultimo.body.slice(0, 70)}`}
          </span>
        </span>

        {ultimo !== null && (
          <span className="text-measure text-ink-muted">
            {shortDateOf(ultimo.createdAt.slice(0, 10))}
          </span>
        )}

        {sinLeer > 0 && (
          <span
            aria-label={`${sinLeer} sin leer`}
            className="grid size-6 place-items-center rounded-chip bg-accent text-measure font-bold text-accent-ink"
          >
            {sinLeer}
          </span>
        )}
      </button>
    </li>
  );
}

export function MessagesView() {
  const households = useHouseholds();
  const [abierta, setAbierta] = useState<Fila | null>(null);

  const filas = useMemo(
    (): Fila[] =>
      (households.data ?? []).flatMap((household) =>
        household.people.map((persona) => ({
          profileId: persona.id,
          nombre: persona.displayName,
          hogar: household.name,
          householdId: household.id,
        })),
      ),
    [households.data],
  );

  if (abierta !== null) {
    return <Conversacion fila={abierta} onVolver={() => setAbierta(null)} />;
  }

  return (
    <section className="rounded-day bg-surface p-6">
      <h1 className="text-dish font-bold text-ink">Mensajes</h1>
      <p className="mt-1 text-measure text-ink-muted">
        Una conversación por persona. Lo que te escriba una no lo ve quien vive con ella.
      </p>

      {households.isPending && <p className="mt-6 text-item text-ink-muted">Cargando…</p>}

      {filas.length === 0 && !households.isPending && (
        <p className="mt-6 text-item text-ink-muted">
          Todavía no hay personas con las que hablar. Se crean desde Hogares.
        </p>
      )}

      <ul className="mt-4 flex flex-col gap-2">
        {filas.map((fila) => (
          <Resumen key={fila.profileId} fila={fila} onAbrir={() => setAbierta(fila)} />
        ))}
      </ul>
    </section>
  );
}
