/**
 * La entrada al chat desde la pestaña Más: cuánto queda por leer y la hoja con la
 * conversación.
 *
 * Vive aparte de `MoreView` a propósito. Con `brand.features.chat` apagado no se monta, y
 * así no se pide el hilo ni se abre un canal de Realtime en una consulta que no use el
 * chat: un hook no se puede poner detrás de un `if`, pero un componente sí.
 */
import { useState } from 'react';
import { Icon } from '../../components/Icon';
import { unreadCount } from '../../domain/chat';
import { useMyThread } from '../../data/chat';
import { ChatSheet } from './ChatSheet';

export function NutritionistCard() {
  const [abierto, setAbierto] = useState(false);
  const { thread, lastReadAt } = useMyThread();
  const sinLeer = unreadCount(thread.data ?? [], lastReadAt, 'cliente');

  return (
    <section className="rounded-day bg-surface p-4">
      <h2 className="text-dish font-bold text-ink">Tu nutricionista</h2>
      <p className="mt-1 text-measure text-ink-muted">
        Pregúntale lo que necesites. Solo lo veis ella y tú.
      </p>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="mt-3 flex min-h-tap w-full items-center gap-3 rounded-block border border-line px-4 py-3 text-left"
      >
        <Icon name="mensaje" size={20} />
        <span className="flex-1 text-item font-semibold text-ink">
          {sinLeer === 0 ? 'Abrir la conversación' : `Tienes ${sinLeer} sin leer`}
        </span>
        {sinLeer > 0 && (
          <span
            aria-label={`${sinLeer} mensajes sin leer`}
            className="grid size-6 place-items-center rounded-chip bg-accent text-measure font-bold text-accent-ink"
          >
            {sinLeer}
          </span>
        )}
      </button>

      <ChatSheet
        open={abierto}
        anchor={null}
        onClearAnchor={() => undefined}
        onClose={() => setAbierto(false)}
      />
    </section>
  );
}
