/**
 * "Cambiar por otro de la biblioteca": sustituir la comida entera de una celda por un
 * bloque prehecho de la nutricionista.
 *
 * La biblioteca guarda **una ración base**. Aquí se enseña ya repartida con el
 * multiplicador de cada persona, que es lo que acabará en el plato; nadie debería tener que
 * calcular nada de cabeza.
 *
 * Solo se ofrecen bloques que ella ha preparado: la app no inventa platos. Y solo cambia
 * esta celda, no la biblioteca.
 */
import { useMemo, useState } from 'react';
import { Icon } from '../../components/Icon';
import { Sheet } from '../../components/Sheet';
import { formatPortion } from '../../domain/format';
import { instantiate, type Comensal } from '../../domain/library';
import type { LibraryBlock, Section } from '../../domain/schema';
import type { ResolvedSlot } from '../../domain/resolve';
import type { SwapLevel } from '../../domain/swap';
import { SLOT_LABEL } from './slots';

export type Comensales = (Comensal & { displayName: string })[];

function Vista({ sections, people }: { sections: Section[]; people: Comensales }) {
  const varios = people.length > 1;

  return (
    <div className="mt-2">
      {sections.map((section) => (
        <div key={section.id} className="mt-2">
          {section.title !== undefined && (
            <p className="text-measure font-bold text-ink">{section.title}</p>
          )}
          <ul>
            {section.items.map((item) => (
              <li key={item.id} className="border-t border-line/60 py-1 first:border-t-0">
                <span className="text-measure text-ink">{item.label}</span>
                {people.map((person) => {
                  const formato = formatPortion(item.portions[person.profileId] ?? {});
                  if (formato.amount === '' && formato.measure === '') return null;
                  return (
                    <span key={person.profileId} className="ml-2 text-measure text-ink-muted">
                      {varios && <>{person.displayName}: </>}
                      <span className="font-semibold text-ink">{formato.amount}</span>{' '}
                      {formato.measure}
                    </span>
                  );
                })}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function LibrarySheet({
  open,
  slot,
  people,
  blocks,
  isLoading,
  otherName,
  onClose,
  onApply,
}: {
  open: boolean;
  /** La celda que se va a cambiar. null mientras no haya ninguna elegida. */
  slot: ResolvedSlot | null;
  /** Quién come de esta celda, con su multiplicador. */
  people: Comensales;
  blocks: readonly LibraryBlock[];
  isLoading: boolean;
  /** Nombre de la otra persona, para avisar en los platos compartidos. */
  otherName: string | undefined;
  onClose: () => void;
  onApply: (sections: Section[], level: SwapLevel) => void;
}) {
  const [busqueda, setBusqueda] = useState('');
  const [todasLasFranjas, setTodasLasFranjas] = useState(false);
  const [elegido, setElegido] = useState<string | null>(null);
  const [level, setLevel] = useState<SwapLevel>('week');

  const slotKey = slot?.cell.slot;

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLocaleLowerCase('es-ES');
    return blocks.filter((block) => {
      if (!todasLasFranjas && slotKey !== undefined && !block.slots.includes(slotKey)) return false;
      if (q === '') return true;
      return (
        block.name.toLocaleLowerCase('es-ES').includes(q) ||
        block.sections.some((section) =>
          section.items.some((item) => item.label.toLocaleLowerCase('es-ES').includes(q)),
        )
      );
    });
  }, [blocks, busqueda, slotKey, todasLasFranjas]);

  const instanciado = useMemo(() => {
    const block = blocks.find((candidato) => candidato.id === elegido);
    return block === undefined ? null : instantiate(block, people);
  }, [blocks, elegido, people]);

  if (slot === null) return null;

  const deEstaFranja = blocks.filter(
    (block) => slotKey !== undefined && block.slots.includes(slotKey),
  ).length;

  return (
    <Sheet open={open} onClose={onClose} title={`Cambiar ${SLOT_LABEL[slot.cell.slot]}`} tall>
      <input
        type="search"
        value={busqueda}
        onChange={(event) => setBusqueda(event.target.value)}
        placeholder="Buscar un plato o un alimento…"
        className="min-h-tap w-full rounded-block border border-line bg-bg px-3 text-item text-ink"
      />

      {isLoading && <p className="mt-4 text-item text-ink-muted">Cargando la biblioteca…</p>}

      {!isLoading && deEstaFranja === 0 && !todasLasFranjas && (
        <p className="mt-4 text-item text-ink-muted">
          Tu nutricionista todavía no ha guardado platos para esta franja.{' '}
          <button
            type="button"
            onClick={() => setTodasLasFranjas(true)}
            className="font-semibold text-ink underline"
          >
            Ver los de todas
          </button>
        </p>
      )}

      {!isLoading && visibles.length === 0 && (deEstaFranja > 0 || todasLasFranjas) && (
        <p className="mt-4 text-item text-ink-muted">Nada coincide con esa búsqueda.</p>
      )}

      <ul className="mt-3 flex flex-col gap-2">
        {visibles.map((block) => (
          <li key={block.id} className="rounded-block border border-line p-3">
            <button
              type="button"
              onClick={() => setElegido(elegido === block.id ? null : block.id)}
              aria-expanded={elegido === block.id}
              className="flex min-h-tap w-full items-center gap-2 text-left"
            >
              <span className="flex-1 text-item font-semibold text-ink">{block.name}</span>
              {elegido === block.id && <Icon name="hoy" size={18} />}
            </button>

            {elegido === block.id && instanciado !== null && (
              <>
                <Vista sections={instanciado.sections} people={people} />

                {instanciado.needsReview.length > 0 && (
                  <p className="mt-2 text-measure text-ink-muted">
                    Alguna medida de casa («2 rebanadas») viene de la ración base y puede no cuadrar
                    con la tuya.
                  </p>
                )}
              </>
            )}
          </li>
        ))}
      </ul>

      {elegido !== null && instanciado !== null && (
        <div className="sticky bottom-0 -mx-4 mt-4 border-t border-line bg-surface px-4 pt-3 pb-3">
          <p className="text-item font-semibold text-ink">¿Para cuándo?</p>
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

          {people.length > 1 && otherName && (
            <p className="mt-3 flex items-start gap-2 rounded-block bg-shared p-3 text-measure text-ink">
              <Icon name="compartido" size={16} />
              Cambia también para {otherName}: es un plato compartido.
            </p>
          )}

          <button
            type="button"
            onClick={() => onApply(instanciado.sections, level)}
            className="mt-3 min-h-tap w-full rounded-chip bg-accent px-4 font-bold text-accent-ink"
          >
            Poner este plato
          </button>
        </div>
      )}
    </Sheet>
  );
}
