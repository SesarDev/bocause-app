/**
 * El chat del cliente con su nutricionista, en hoja.
 *
 * Se abre desde la pestaña Más o desde el menú de una franja ("Preguntar sobre esto"). En
 * el segundo caso llega con la comida enganchada, para no tener que empezar explicando de
 * qué se habla.
 *
 * Al abrirlo se marca como leído: si lo has mirado, el punto sobra.
 */
import { useEffect } from 'react';
import { Sheet } from '../../components/Sheet';
import type { ChatAnchor } from '../../domain/chat';
import { useChatRealtime, useMarkRead, useMyThread, useSendMessage } from '../../data/chat';
import { ChatThread } from './ChatThread';

export function ChatSheet({
  open,
  anchor,
  onClearAnchor,
  onClose,
}: {
  open: boolean;
  anchor: ChatAnchor | null;
  onClearAnchor: () => void;
  onClose: () => void;
}) {
  const { profileId, thread, lastReadAt } = useMyThread();
  const send = useSendMessage(profileId);
  const markRead = useMarkRead();

  useChatRealtime(profileId);

  // Marcar leído al abrir, y también cuando llega algo con la hoja ya abierta.
  const ultimo = thread.data?.[thread.data.length - 1]?.createdAt ?? null;
  useEffect(() => {
    if (!open || profileId === null) return;
    if (ultimo !== null && ultimo !== lastReadAt) {
      markRead.mutate({ profileId, role: 'cliente' });
    }
    // `markRead` cambia de identidad en cada render; incluirlo dispararía un bucle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, profileId, ultimo, lastReadAt]);

  return (
    <Sheet open={open} onClose={onClose} title="Tu nutricionista" tall>
      <ChatThread
        messages={thread.data ?? []}
        myRole="cliente"
        isLoading={thread.isPending}
        fill
        anchor={anchor}
        onClearAnchor={onClearAnchor}
        sending={send.isPending}
        onSend={(body) =>
          send.mutate(
            { body, ...(anchor !== null ? { anchor } : {}) },
            { onSuccess: onClearAnchor },
          )
        }
      />

      {send.isError && (
        <p role="alert" className="mt-2 text-measure text-danger">
          No se pudo enviar. Comprueba la conexión y vuelve a intentarlo.
        </p>
      )}
    </Sheet>
  );
}
