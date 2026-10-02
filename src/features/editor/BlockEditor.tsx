import { useState } from 'react';
import { Icon } from '../../components/Icon';
import { Sheet } from '../../components/Sheet';
import { blockIsEmpty, diffBlocks } from '../../domain/diff';
import { forkBlock, originOf } from '../../domain/edit';
import { Block as BlockSchema } from '../../domain/schema';
import type { Block, Food, ProfileId, SectionKind } from '../../domain/schema';
import type { SwapLevel } from '../../domain/swap';
import { SECTION_LABEL } from '../week/slots';
import {
  addItem,
  addSection,
  moveItem,
  moveSection,
  newId,
  removeItem,
  removeSection,
  setSectionTitle,
  SECTION_KINDS,
  updateItem,
} from './draft';
import { ItemEditor } from './ItemEditor';

/**
 * Editor de un bloque, en hoja a pantalla casi completa.
 *
 * Nunca modifica el bloque que recibe: trabaja sobre una copia y al guardar crea un bloque
 * nuevo con `forkBlock`, que apunta al original. Por eso "Restaurar original" siempre puede
 * volver atrás (CLAUDE.md, regla 6).
 */
export function BlockEditor({
  open,
  onClose,
  source,
  original,
  people,
  foods,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  /** El bloque que se está editando (puede ser ya una copia). */
  source: Block;
  /** El bloque original del plan, para comparar. null si la celda estaba vacía. */
  original: Block | null;
  people: { profileId: ProfileId; displayName: string }[];
  foods: readonly Food[];
  onSave: (block: Block, level: SwapLevel) => void;
}) {
  const [draft, setDraft] = useState<Block>(() => structuredClone(source));
  const [level, setLevel] = useState<SwapLevel>('week');
  const [error, setError] = useState<string | null>(null);

  const diff = diffBlocks(original, draft);
  const profileIds = people.map((person) => person.profileId);

  const save = () => {
    const cleaned: Block = {
      ...draft,
      sections: draft.sections
        .map((section) => ({
          ...section,
          items: section.items.filter((item) => item.label.trim() !== ''),
        }))
        .filter((section) => section.items.length > 0),
    };

    if (blockIsEmpty(cleaned) || cleaned.sections.length === 0) {
      setError('Un bloque no puede quedarse sin ningún alimento.');
      return;
    }

    // Última palabra: el esquema. Si algo no cuadra, no se guarda.
    const parsed = BlockSchema.safeParse(cleaned);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Hay algo que el esquema no acepta.');
      return;
    }

    // Copy-on-write: al guardar nace un bloque nuevo que apunta al original.
    const fork = forkBlock(parsed.data, { sections: parsed.data.sections }, newId('bloque'));
    onSave({ ...fork, originBlockId: original ? originOf(source) : undefined }, level);
  };

  return (
    <Sheet open={open} onClose={onClose} title="Editar" tall>
      {/* Catálogo para el autocompletado de todos los campos de alimento. */}
      <datalist id="catalogo-alimentos">
        {foods.map((food) => (
          <option key={food.key} value={food.name} />
        ))}
      </datalist>

      {diff.hasChanges && (
        <p className="mb-3 rounded-block bg-free/40 p-2 text-measure text-ink">
          Lo que cambies se resalta. Al guardar se crea una copia y el plan original se queda como
          está.
        </p>
      )}

      <div className="flex flex-col gap-4">
        {draft.sections.map((section, index) => (
          <section key={section.id} className="rounded-block border border-line p-3">
            <div className="flex items-center gap-1">
              <span className="rounded-chip bg-slot px-2 py-0.5 text-measure font-extrabold text-slot-ink">
                {SECTION_LABEL[section.kind] ?? section.kind.toLocaleUpperCase('es-ES')}
              </span>
              <span className="flex-1" />
              <button
                type="button"
                disabled={index === 0}
                onClick={() => setDraft((current) => moveSection(current, section.id, -1))}
                aria-label="Subir sección"
                className="grid size-9 place-items-center text-ink-muted disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                disabled={index === draft.sections.length - 1}
                onClick={() => setDraft((current) => moveSection(current, section.id, 1))}
                aria-label="Bajar sección"
                className="grid size-9 place-items-center text-ink-muted disabled:opacity-30"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => setDraft((current) => removeSection(current, section.id))}
                aria-label="Quitar sección"
                className="grid size-9 place-items-center text-danger"
              >
                ×
              </button>
            </div>

            <label
              className="mt-2 block text-measure font-semibold text-ink"
              htmlFor={`t-${section.id}`}
            >
              Título del plato
            </label>
            <input
              id={`t-${section.id}`}
              value={section.title ?? ''}
              placeholder="Sin título"
              onChange={(event) =>
                setDraft((current) => setSectionTitle(current, section.id, event.target.value))
              }
              className={`mt-1 min-h-tap w-full rounded-block border bg-bg px-3 text-item text-ink ${
                diff.changedTitles.has(section.id) ? 'border-free' : 'border-line'
              }`}
            />

            <ul className="mt-3 flex flex-col gap-3">
              {section.items.map((item, itemIndex) => (
                <ItemEditor
                  key={item.id}
                  item={item}
                  people={people}
                  foods={foods}
                  change={diff.items.get(item.id) ?? 'nuevo'}
                  canMoveUp={itemIndex > 0}
                  canMoveDown={itemIndex < section.items.length - 1}
                  onChange={(update) =>
                    setDraft((current) => updateItem(current, section.id, item.id, update))
                  }
                  onRemove={() => setDraft((current) => removeItem(current, section.id, item.id))}
                  onMove={(delta) =>
                    setDraft((current) => moveItem(current, section.id, item.id, delta))
                  }
                />
              ))}
            </ul>

            <button
              type="button"
              onClick={() => setDraft((current) => addItem(current, section.id, profileIds))}
              className="mt-3 min-h-tap w-full rounded-chip border border-line text-item font-semibold text-ink"
            >
              + Añadir alimento
            </button>
          </section>
        ))}
      </div>

      {diff.removedItems.length > 0 && (
        <p className="mt-3 rounded-block border border-line p-3 text-measure text-ink-muted">
          Has quitado: {diff.removedItems.map((item) => item.label).join(', ')}
        </p>
      )}

      <div className="mt-4">
        <p className="text-measure font-semibold text-ink">Añadir sección</p>
        <div className="mt-1 flex flex-wrap gap-2">
          {SECTION_KINDS.map(({ kind, label }) => (
            <button
              key={kind}
              type="button"
              onClick={() => setDraft((current) => addSection(current, kind as SectionKind))}
              className="min-h-tap rounded-chip border border-line px-3 text-measure font-semibold text-ink"
            >
              + {label}
            </button>
          ))}
        </div>
      </div>

      <div className="sticky bottom-0 -mx-4 mt-4 border-t border-line bg-surface px-4 pt-3">
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

        {error && (
          <p role="alert" className="mt-2 text-measure text-danger">
            {error}
          </p>
        )}

        <button
          type="button"
          disabled={!diff.hasChanges}
          onClick={save}
          className="mt-3 mb-3 flex min-h-tap w-full items-center justify-center gap-2 rounded-chip bg-accent px-4 font-bold text-accent-ink disabled:opacity-50"
        >
          <Icon name="hoy" size={18} />
          {diff.hasChanges ? 'Guardar cambios' : 'Sin cambios que guardar'}
        </button>
      </div>
    </Sheet>
  );
}
