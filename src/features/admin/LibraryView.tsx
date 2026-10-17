/**
 * Biblioteca de bloques prehechos.
 *
 * Cada bloque guarda **una ración base** por alimento. Al colocarlo en la dieta de un hogar
 * se reparte con el multiplicador de cada comensal (`instantiate` en `src/domain/library.ts`),
 * así que lo que se ve aquí es la referencia, no lo que comerá nadie en concreto.
 *
 * La vista previa de raciones está aquí a propósito: es donde se nota si una ración base
 * está mal puesta, antes de que acabe en la dieta de alguien.
 */
import { useMemo, useState } from 'react';
import { formatPortion } from '../../domain/format';
import { instantiate } from '../../domain/library';
import type { LibraryBlock, SlotKey } from '../../domain/schema';
import { SLOTS_EN_ORDEN, useLibraryBlocks, useSaveLibraryBlock } from '../../data/library';

const input = 'min-h-tap rounded-block border border-line bg-surface px-2 py-1 text-item text-ink';

const MULTIPLICADORES = [0.75, 1, 1.25, 1.5] as const;

function Detalle({ block }: { block: LibraryBlock }) {
  const save = useSaveLibraryBlock();
  const [multiplier, setMultiplier] = useState<number>(1);

  // Se instancia para una persona ficticia: es la forma de ver la ración ya escalada y
  // redondeada, que es lo que de verdad acabará en el plato.
  const { sections, needsReview } = useMemo(
    () => instantiate(block, [{ profileId: 'vista', multiplier }]),
    [block, multiplier],
  );

  return (
    <div className="mt-3 border-t border-line pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-measure text-ink-muted">Ver la ración con multiplicador</span>
        {MULTIPLICADORES.map((valor) => (
          <button
            key={valor}
            type="button"
            onClick={() => setMultiplier(valor)}
            className={`min-h-tap rounded-chip px-3 text-measure font-semibold ${
              multiplier === valor ? 'bg-slot text-slot-ink' : 'border border-line text-ink'
            }`}
          >
            ×{valor.toLocaleString('es-ES')}
          </button>
        ))}
      </div>

      {needsReview.length > 0 && (
        <p role="status" className="mt-2 text-measure text-danger">
          {needsReview.length} {needsReview.length === 1 ? 'alimento tiene' : 'alimentos tienen'}{' '}
          una medida casera («2 rebanadas») que no se puede multiplicar sola: habrá que repasarla al
          usar el bloque.
        </p>
      )}

      {sections.map((section) => (
        <div key={section.id} className="mt-3">
          {section.title !== undefined && (
            <p className="text-item font-bold text-ink">{section.title}</p>
          )}
          <ul className="mt-1">
            {section.items.map((item) => {
              const formato = formatPortion(item.portions['vista'] ?? {});
              return (
                <li
                  key={item.id}
                  className="flex flex-wrap items-baseline gap-x-2 border-t border-line/60 py-1.5 first:border-t-0"
                >
                  <span className="flex-1 text-item text-ink">{item.label}</span>
                  {formato.amount !== '' && (
                    <span className="text-item font-semibold text-ink">{formato.amount}</span>
                  )}
                  {formato.measure !== '' && (
                    <span className="text-measure text-ink-muted">{formato.measure}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      <button
        type="button"
        onClick={() => save.mutate({ ...block, archived: true })}
        className="mt-3 min-h-tap text-measure font-semibold text-ink-muted underline"
      >
        Archivar bloque
      </button>
    </div>
  );
}

export function LibraryView() {
  const blocks = useLibraryBlocks();
  const save = useSaveLibraryBlock();
  const [busqueda, setBusqueda] = useState('');
  const [slot, setSlot] = useState<SlotKey | ''>('');
  const [abierto, setAbierto] = useState<string | null>(null);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLocaleLowerCase('es-ES');
    return (blocks.data ?? []).filter((block) => {
      if (slot !== '' && !block.slots.includes(slot)) return false;
      if (q === '') return true;
      return (
        block.name.toLocaleLowerCase('es-ES').includes(q) ||
        block.tags.some((tag) => tag.toLocaleLowerCase('es-ES').includes(q)) ||
        block.sections.some((section) =>
          section.items.some((item) => item.label.toLocaleLowerCase('es-ES').includes(q)),
        )
      );
    });
  }, [blocks.data, busqueda, slot]);

  const duplicar = (block: LibraryBlock) =>
    save.mutate({ ...block, id: crypto.randomUUID(), name: `${block.name} (copia)` });

  return (
    <section className="rounded-day bg-surface p-6">
      <header className="flex flex-wrap items-baseline gap-3">
        <h1 className="text-dish font-bold text-ink">Biblioteca</h1>
        <p className="flex-1 text-measure text-ink-muted">
          {blocks.data?.length ?? 0} bloques con su ración base. Al usarlos se reparten según cuánto
          come cada persona.
        </p>
      </header>

      <div className="mt-4 flex flex-wrap gap-2">
        <input
          type="search"
          value={busqueda}
          onChange={(event) => setBusqueda(event.target.value)}
          placeholder="Buscar por nombre, etiqueta o alimento…"
          className={`w-full max-w-sm ${input}`}
        />
        <select
          value={slot}
          onChange={(event) => setSlot(event.target.value as SlotKey | '')}
          className={input}
          aria-label="Filtrar por franja"
        >
          <option value="">Todas las franjas</option>
          {SLOTS_EN_ORDEN.map((key) => (
            <option key={key} value={key}>
              {key}
            </option>
          ))}
        </select>
      </div>

      {blocks.isPending && <p className="mt-6 text-item text-ink-muted">Cargando la biblioteca…</p>}

      {blocks.data?.length === 0 && (
        <p className="mt-6 text-item text-ink-muted">
          La biblioteca está vacía. Se siembra desde el plan con <code>npm run library:seed</code>.
        </p>
      )}

      {blocks.data !== undefined && blocks.data.length > 0 && visibles.length === 0 && (
        <p className="mt-6 text-item text-ink-muted">Nada coincide con esa búsqueda.</p>
      )}

      <ul className="mt-4 flex flex-col gap-3">
        {visibles.map((block) => (
          <li key={block.id} className="rounded-block border border-line p-4">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setAbierto(abierto === block.id ? null : block.id)}
                className="flex-1 text-left text-item font-semibold text-ink"
                aria-expanded={abierto === block.id}
              >
                {block.name}
              </button>

              {block.slots.map((key) => (
                <span
                  key={key}
                  className="rounded-chip bg-slot px-2 py-0.5 text-[0.625rem] font-extrabold tracking-[0.06em] text-slot-ink uppercase"
                >
                  {key}
                </span>
              ))}

              <button
                type="button"
                onClick={() => duplicar(block)}
                className="min-h-tap text-measure font-semibold text-ink-muted underline"
              >
                Duplicar
              </button>
            </div>

            {abierto === block.id && <Detalle block={block} />}
          </li>
        ))}
      </ul>

      <p className="mt-4 max-w-prose text-measure text-ink-muted">
        Editar el contenido de un bloque (añadir o quitar alimentos) llega con el constructor de
        dietas, que reutiliza el mismo editor en modo ración base. De momento se pueden duplicar y
        archivar.
      </p>
    </section>
  );
}
