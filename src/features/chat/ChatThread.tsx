/**
 * La conversación: mensajes agrupados por día y el campo para escribir.
 *
 * Sirve para las dos partes —el cliente en la pestaña Más y la nutricionista en su panel—,
 * así que no sabe quién la mira más allá de `myRole`, que decide de qué lado cae cada
 * mensaje y cómo se llama a quien no tiene perfil.
 *
 * No se puede editar ni borrar lo enviado, y eso es a propósito: un consejo de nutrición
 * reescrito a posteriori es peor que no tenerlo. Lo impone la base de datos, no esta
 * pantalla.
 */
import { useEffect, useRef, useState } from 'react';
import { anchorLabel, groupByDay, type ChatMessage, type ChatRole } from '../../domain/chat';
import { todayIn } from '../../domain/dates';
import { dayNameOf, shortDateOf } from '../../domain/format';

function tituloDelDia(date: string): string {
  if (date === todayIn()) return 'Hoy';
  return `${dayNameOf(date)} ${shortDateOf(date)}`;
}

function hora(createdAt: string): string {
  return new Date(createdAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

function nombreDe(message: ChatMessage): string {
  if (message.authorName !== null) return message.authorName;
  return message.authorRole === 'nutricionista' ? 'Tu nutricionista' : 'Tu cliente';
}

export function ChatThread({
  messages,
  myRole,
  isLoading = false,
  anchor,
  onClearAnchor,
  onSend,
  sending = false,
  fill = false,
}: {
  messages: readonly ChatMessage[];
  myRole: ChatRole;
  isLoading?: boolean;
  /** La comida sobre la que se va a preguntar, si se abrió desde una franja. */
  anchor?: { day?: number; slot?: string; title?: string } | null;
  onClearAnchor?: () => void;
  onSend: (body: string) => void;
  sending?: boolean;
  /** Ocupar todo el alto disponible, con el campo de escribir abajo del todo (en hoja). */
  fill?: boolean;
}) {
  const [texto, setTexto] = useState('');
  const final = useRef<HTMLDivElement | null>(null);

  // Al abrir y al llegar algo nuevo, abajo del todo: una conversación se lee por el final.
  useEffect(() => {
    final.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  const dias = groupByDay(messages);
  const etiqueta = anchor === undefined || anchor === null ? null : anchorLabel(anchor);

  const enviar = () => {
    if (texto.trim() === '' || sending) return;
    onSend(texto);
    setTexto('');
  };

  return (
    <div className={`flex flex-col ${fill ? 'h-full' : ''}`}>
      <div
        className={`flex flex-col gap-4 overflow-y-auto pb-2 ${
          fill ? 'min-h-0 flex-1' : 'max-h-[55vh]'
        }`}
      >
        {isLoading && <p className="text-item text-ink-muted">Cargando la conversación…</p>}

        {!isLoading && dias.length === 0 && (
          <p className="text-item text-ink-muted">
            {myRole === 'cliente'
              ? 'Aquí puedes preguntarle lo que quieras a tu nutricionista. Lo que escribas solo lo veis ella y tú.'
              : 'Todavía no hay mensajes con esta persona.'}
          </p>
        )}

        {dias.map((dia) => (
          <section key={dia.date}>
            <h3 className="text-measure font-extrabold tracking-[0.06em] text-ink-muted uppercase">
              {tituloDelDia(dia.date)}
            </h3>

            <ul className="mt-2 flex flex-col gap-2">
              {dia.messages.map((message) => {
                const mio = message.authorRole === myRole;
                return (
                  <li key={message.id} className={`flex ${mio ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[85%] rounded-block px-3 py-2 ${
                        mio ? 'bg-slot text-slot-ink' : 'bg-bg text-ink'
                      }`}
                    >
                      {!mio && (
                        <p className="text-measure font-semibold opacity-80">{nombreDe(message)}</p>
                      )}

                      {message.anchor !== null && (
                        <p className="text-measure italic opacity-80">
                          {anchorLabel(message.anchor)}
                        </p>
                      )}

                      <p className="text-item whitespace-pre-wrap">{message.body}</p>
                      <p className="text-right text-[0.625rem] opacity-70">
                        {hora(message.createdAt)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}

        <div ref={final} />
      </div>

      {etiqueta !== null && (
        <p className="mt-2 flex items-center gap-2 rounded-block bg-bg px-3 py-2 text-measure text-ink">
          <span className="flex-1">{etiqueta}</span>
          {onClearAnchor !== undefined && (
            <button
              type="button"
              onClick={onClearAnchor}
              className="font-semibold text-ink-muted underline"
            >
              Quitar
            </button>
          )}
        </p>
      )}

      <form
        className="mt-2 flex items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          enviar();
        }}
      >
        <textarea
          value={texto}
          onChange={(event) => setTexto(event.target.value)}
          onKeyDown={(event) => {
            // Enter envía; Mayús+Enter hace párrafo. En el móvil el salto de línea es raro,
            // y tener que buscar un botón para una pregunta de una línea lo es más.
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              enviar();
            }
          }}
          rows={2}
          maxLength={2000}
          placeholder="Escribe tu mensaje…"
          className="min-h-tap flex-1 resize-none rounded-block border border-line bg-surface px-3 py-2 text-item text-ink"
          aria-label="Mensaje"
        />
        <button
          type="submit"
          disabled={texto.trim() === '' || sending}
          className="min-h-tap rounded-block bg-slot px-4 text-item font-semibold text-slot-ink disabled:opacity-40"
        >
          {sending ? 'Enviando…' : 'Enviar'}
        </button>
      </form>
    </div>
  );
}
