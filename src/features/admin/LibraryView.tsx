/**
 * Biblioteca de bloques prehechos.
 *
 * Cada bloque guarda **una ración base** por alimento. Al colocarlo en la dieta de un hogar
 * se reparte con el multiplicador de cada comensal (`instantiate` en `src/domain/library.ts`),
 * así que lo que se ve aquí es la referencia, no lo que comerá nadie en concreto.
 *
 * La vista previa de raciones está aquí a propósito: es donde se nota si una ración base
 * está mal puesta, antes de que acabe en la dieta de alguien.
 *
 * El contenido se edita con el mismo `BlockEditor` que usa el cliente, en modo "ración
 * base": un bloque de biblioteca no es más que un bloque con un solo comensal.
 */
import { useMemo, useState } from 'react';
import { formatPortion } from '../../domain/format';
import { BASE_EATER, fromEditableBlock, instantiate, toEditableBlock } from '../../domain/library';
import type { LibraryBlock, SlotKey } from '../../domain/schema';
import {
  SLOTS_EN_ORDEN,
  useFoods,
  useLibraryBlocks,
  useSaveLibraryBlock,
} from '../../data/library';
import { BlockEditor } from '../editor/BlockEditor';

const input = 'min-h-tap rounded-block border border-line bg-surface px-2 py-1 text-item text-ink';

const MULTIPLICADORES = [0.75, 1, 1.25, 1.5] as const;

/** Nombre, franjas, etiquetas y notas. El contenido va aparte, en el editor. */
function Ficha({ block }: { block: LibraryBlock }) {
  const save = useSaveLibraryBlock();
  const [borrador, setBorrador] = useState(block);

  const cambiado =
    borrador.name !== block.name ||
    borrador.notes !== block.notes ||
    borrador.slots.join() !== block.slots.join() ||
    borrador.tags.join() !== block.tags.join();

  const alternarFranja = (key: SlotKey) =>
    setBorrador((actual) => ({
      ...actual,
      slots: actual.slots.includes(key)
        ? actual.slots.filter((slot) => slot !== key)
        : [...actual.slots, key],
    }));

  return (
    <div className="flex flex-col gap-3">
      <span>
        <label className="block text-measure font-semibold text-ink" htmlFor={`n-${block.id}`}>
          Nombre
        </label>
        <input
          id={`n-${block.id}`}
          value={borrador.name}
          onChange={(event) => setBorrador((actual) => ({ ...actual, name: event.target.value }))}
          className={`mt-1 w-full max-w-md ${input}`}
        />
      </span>

      <span>
        <p className="text-measure font-semibold text-ink">En qué franjas se ofrece</p>
        <div className="mt-1 flex flex-wrap gap-2">
          {SLOTS_EN_ORDEN.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => alternarFranja(key)}
              aria-pressed={borrador.slots.includes(key)}
              className={`min-h-tap rounded-chip px-3 text-measure font-semibold ${
                borrador.slots.includes(key)
                  ? 'bg-slot text-slot-ink'
                  : 'border border-line text-ink'
              }`}
            >
              {key}
            </button>
          ))}
        </div>
      </span>

      <span>
        <label className="block text-measure font-semibold text-ink" htmlFor={`e-${block.id}`}>
          Etiquetas, separadas por comas
        </label>
        <input
          id={`e-${block.id}`}
          value={borrador.tags.join(', ')}
          placeholder="horno, rápido, batch cooking"
          onChange={(event) =>
            setBorrador((actual) => ({
              ...actual,
              tags: event.target.value
                .split(',')
                .map((tag) => tag.trim())
                .filter((tag) => tag !== ''),
            }))
          }
          className={`mt-1 w-full max-w-md ${input}`}
        />
      </span>

      <span>
        <label className="block text-measure font-semibold text-ink" htmlFor={`no-${block.id}`}>
          Notas para ti
        </label>
        <textarea
          id={`no-${block.id}`}
          value={borrador.notes ?? ''}
          rows={2}
          placeholder="Cómo se prepara, para quién va bien…"
          onChange={(event) =>
            setBorrador((actual) => {
              const texto = event.target.value;
              const siguiente = { ...actual };
              if (texto.trim() === '') delete siguiente.notes;
              else siguiente.notes = texto;
              return siguiente;
            })
          }
          className={`mt-1 w-full max-w-md resize-y ${input}`}
        />
      </span>

      <span className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!cambiado || borrador.name.trim() === ''}
          onClick={() => save.mutate(borrador)}
          className="min-h-tap rounded-chip bg-accent px-4 text-item font-bold text-accent-ink disabled:opacity-40"
        >
          Guardar la ficha
        </button>
        {cambiado && (
          <button
            type="button"
            onClick={() => setBorrador(block)}
            className="min-h-tap text-measure font-semibold text-ink-muted underline"
          >
            Deshacer
          </button>
        )}
        {borrador.name.trim() === '' && (
          <span role="alert" className="text-measure text-danger">
            El nombre no puede quedarse vacío.
          </span>
        )}
      </span>
    </div>
  );
}

function Detalle({ block, onEditar }: { block: LibraryBlock; onEditar: () => void }) {
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
      <Ficha key={block.id} block={block} />

      <div className="mt-4 flex flex-wrap items-center gap-2">
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

      <div className="mt-3 flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={onEditar}
          className="min-h-tap rounded-chip border border-line px-4 text-item font-semibold text-ink"
        >
          Editar los alimentos
        </button>

        <button
          type="button"
          onClick={() => save.mutate({ ...block, archived: !block.archived })}
          className="min-h-tap text-measure font-semibold text-ink-muted underline"
        >
          {block.archived ? 'Desarchivar bloque' : 'Archivar bloque'}
        </button>
      </div>
    </div>
  );
}

export function LibraryView() {
  const [verArchivados, setVerArchivados] = useState(false);
  const blocks = useLibraryBlocks(verArchivados);
  const foods = useFoods();
  const save = useSaveLibraryBlock();
  const [busqueda, setBusqueda] = useState('');
  const [slot, setSlot] = useState<SlotKey | ''>('');
  const [abierto, setAbierto] = useState<string | null>(null);
  const [editando, setEditando] = useState<LibraryBlock | null>(null);

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
        <label className="flex min-h-tap items-center gap-2 text-measure font-semibold text-ink">
          <input
            type="checkbox"
            checked={verArchivados}
            onChange={(event) => setVerArchivados(event.target.checked)}
            className="size-5 accent-[var(--color-check)]"
          />
          Ver también los archivados
        </label>
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
                {block.archived && (
                  <span className="ml-2 font-normal text-ink-muted">· archivado</span>
                )}
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

            {abierto === block.id && <Detalle block={block} onEditar={() => setEditando(block)} />}
          </li>
        ))}
      </ul>

      {/* El mismo editor del cliente, con un solo comensal: la ración base. */}
      {editando && (
        <BlockEditor
          key={editando.id}
          open
          mode="biblioteca"
          title={editando.name}
          onClose={() => setEditando(null)}
          source={toEditableBlock(editando)}
          original={toEditableBlock(editando)}
          people={[{ profileId: BASE_EATER, displayName: 'Ración base' }]}
          foods={foods.data ?? []}
          onSave={(editado) => {
            save.mutate(fromEditableBlock(editado, editando));
            setEditando(null);
          }}
        />
      )}
    </section>
  );
}
