import { useMemo, useState } from 'react';
import { Checkbox } from '../../components/Checkbox';
import { Icon } from '../../components/Icon';
import { Toast, type ToastState } from '../../components/Toast';
import { addDays, currentWeekStart, todayIn, type IsoDateString } from '../../domain/dates';
import { formatQuantity, SECTION_LABEL, type ShoppingList } from '../../domain/shopping';
import { buildShoppingList } from '../../domain/shopping';
import type { ShoppingItem } from '../../domain/schema';
import {
  useGenerateShopping,
  useRemoveShoppingItem,
  useSetShoppingItem,
  type ShoppingLineInput,
} from '../../data/mutations';
import { useHouseholdWeeks, useProfiles, useShoppingItems } from '../../data/queries';
import { useRealtimeSync } from '../../data/realtime';
import { isCatalogKey, looseKey, manualKey } from './keys';

type Range = 'semana' | 'resto' | 'proxima';

const RANGE_LABEL: Record<Range, string> = {
  semana: 'Semana actual',
  resto: 'Lo que queda',
  proxima: 'Próxima semana',
};

export function ShoppingView() {
  const thisWeek = currentWeekStart();
  const [range, setRange] = useState<Range>('semana');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [manual, setManual] = useState('');
  const [toast, setToast] = useState<ToastState | null>(null);

  // "Próxima semana" compra sobre otra semana distinta, así que cambia hasta la clave.
  const weekStart: IsoDateString = range === 'proxima' ? addDays(thisWeek, 7) : thisWeek;
  const from = range === 'resto' ? todayIn() : weekStart;
  const to = addDays(weekStart, 7);

  const { weeks, plan, isLoading } = useHouseholdWeeks(weekStart);
  const { data: profiles } = useProfiles();
  const items = useShoppingItems(weekStart);

  const generate = useGenerateShopping();
  const setItem = useSetShoppingItem();
  const removeItem = useRemoveShoppingItem();

  useRealtimeSync(plan?.id, weekStart);

  /** Lo que dice el plan. El desglose por persona se calcula, no se guarda. */
  const computed: ShoppingList | null = useMemo(() => {
    if (!plan || weeks.length === 0) return null;
    return buildShoppingList({ weeks, foods: plan.foods, from, to });
  }, [plan, weeks, from, to]);

  const detailByKey = useMemo(() => {
    const map = new Map<
      string,
      { perProfile: Record<string, number>; dates: string[]; unit: string }
    >();
    for (const group of computed?.groups ?? []) {
      for (const line of group.lines) {
        map.set(line.foodKey, {
          perProfile: line.perProfile,
          dates: line.dates,
          unit: line.unit,
        });
      }
    }
    return map;
  }, [computed]);

  const householdId = profiles?.[0]?.householdId;

  const doGenerate = () => {
    if (!computed || !householdId) return;

    const lines: ShoppingLineInput[] = [
      ...computed.groups.flatMap((group) =>
        group.lines.map((line) => ({
          foodKey: line.foodKey,
          label: line.label,
          quantityText: formatQuantity(line.total, line.unit),
          section: group.section,
          source: 'auto' as const,
        })),
      ),
      ...computed.loose.map((line) => ({
        // Sin clave de catálogo no se puede guardar: ver keys.ts.
        foodKey: looseKey(line.label),
        label: line.label,
        quantityText: line.measures.join(' · ') || null,
        section: line.section,
        source: 'auto' as const,
      })),
    ];

    generate.mutate(
      { householdId, weekStart, lines },
      {
        onSuccess: () => setToast({ message: `Lista generada: ${lines.length} cosas` }),
        onError: () => setToast({ message: 'No se pudo generar la lista' }),
      },
    );
  };

  const addManual = () => {
    const label = manual.trim();
    if (!label || !householdId) return;

    generate.mutate(
      {
        householdId,
        weekStart,
        lines: [
          {
            foodKey: manualKey(label),
            label,
            quantityText: null,
            section: 'otros',
            source: 'manual',
          },
        ],
      },
      { onSuccess: () => setManual('') },
    );
  };

  const rows = items.data ?? [];
  const pending = rows.filter((item) => !item.checked && !item.inPantry);
  const inPantry = rows.filter((item) => item.inPantry);
  const bought = rows.filter((item) => item.checked && !item.inPantry);

  const bySection = useMemo(() => {
    // El orden de recorrido del súper lo marca el cálculo; lo que no esté, al final.
    const order: string[] = (computed?.groups ?? []).map((group) => group.section);
    const rank = (section: string) => (order.indexOf(section) === -1 ? 99 : order.indexOf(section));
    const groups = new Map<string, ShoppingItem[]>();
    for (const item of pending) {
      groups.set(item.section, [...(groups.get(item.section) ?? []), item]);
    }
    return [...groups.entries()].sort((a, b) => rank(a[0]) - rank(b[0]));
  }, [pending, computed]);

  const share = async () => {
    const text = [
      `Compra · ${RANGE_LABEL[range].toLowerCase()}`,
      ...bySection.flatMap(([section, list]) => [
        '',
        SECTION_LABEL[section as keyof typeof SECTION_LABEL] ?? section,
        ...list.map(
          (item) => `- ${item.label}${item.quantityText ? ` (${item.quantityText})` : ''}`,
        ),
      ]),
    ].join('\n');

    try {
      if (navigator.share) await navigator.share({ title: 'Lista de la compra', text });
      else {
        await navigator.clipboard.writeText(text);
        setToast({ message: 'Lista copiada al portapapeles' });
      }
    } catch {
      // Compartir cancelado: no es un error que haya que contar.
    }
  };

  return (
    <div className="mt-3 flex flex-col gap-3">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {(['semana', 'resto', 'proxima'] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setRange(option)}
            aria-pressed={range === option}
            className={`min-h-tap shrink-0 rounded-chip border px-3 text-item font-semibold ${
              range === option ? 'border-accent bg-accent/15 text-ink' : 'border-line text-ink'
            }`}
          >
            {RANGE_LABEL[option]}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={doGenerate}
          disabled={!computed || generate.isPending}
          className="min-h-tap flex-1 rounded-chip bg-accent px-4 font-bold text-accent-ink disabled:opacity-60"
        >
          {rows.length === 0 ? 'Generar lista' : 'Actualizar lista'}
        </button>
        <button
          type="button"
          onClick={() => void share()}
          disabled={pending.length === 0}
          aria-label="Compartir la lista"
          className="grid size-tap place-items-center rounded-chip border border-line text-ink disabled:opacity-40"
        >
          <Icon name="compra" size={20} />
        </button>
      </div>

      {isLoading && <p className="text-item text-ink-muted">Cargando el plan…</p>}

      {rows.length === 0 && !isLoading && (
        <p className="rounded-day bg-surface p-6 text-center text-item text-ink-muted">
          Todavía no hay lista para esta semana. Pulsa «Generar lista» y se calcula sumando lo que
          coméis los dos.
        </p>
      )}

      {bySection.map(([section, list]) => (
        <section key={section} className="rounded-day bg-surface p-4">
          <h2 className="text-measure font-extrabold tracking-[0.06em] text-ink-muted">
            {(SECTION_LABEL[section as keyof typeof SECTION_LABEL] ?? section).toLocaleUpperCase(
              'es-ES',
            )}
          </h2>
          <ul className="mt-1">
            {list.map((item) => (
              <Line
                key={item.id}
                item={item}
                detail={detailByKey.get(item.foodKey ?? '')}
                profiles={profiles ?? []}
                expanded={expanded === item.id}
                onExpand={() => setExpanded(expanded === item.id ? null : item.id)}
                onCheck={(checked) =>
                  setItem.mutate({ weekStart, id: item.id, patch: { checked } })
                }
                onPantry={() =>
                  setItem.mutate({ weekStart, id: item.id, patch: { inPantry: true } })
                }
                onRemove={
                  item.source === 'manual'
                    ? () => removeItem.mutate({ weekStart, id: item.id })
                    : undefined
                }
              />
            ))}
          </ul>
        </section>
      ))}

      {/* Añadir a mano */}
      <section className="rounded-day bg-surface p-4">
        <label htmlFor="manual" className="text-measure font-semibold text-ink">
          Añadir algo más
        </label>
        <div className="mt-1 flex gap-2">
          <input
            id="manual"
            value={manual}
            placeholder="Papel de horno, bolsas…"
            onChange={(event) => setManual(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && addManual()}
            className="min-h-tap flex-1 rounded-block border border-line bg-bg px-3 text-item text-ink"
          />
          <button
            type="button"
            onClick={addManual}
            disabled={manual.trim() === ''}
            className="min-h-tap rounded-chip bg-accent px-4 font-bold text-accent-ink disabled:opacity-50"
          >
            Añadir
          </button>
        </div>
      </section>

      {inPantry.length > 0 && (
        <Collapsed
          title={`Ya lo tengo (${inPantry.length})`}
          items={inPantry}
          onRestore={(id) => setItem.mutate({ weekStart, id, patch: { inPantry: false } })}
        />
      )}

      {bought.length > 0 && (
        <Collapsed
          title={`Comprado (${bought.length})`}
          items={bought}
          onRestore={(id) => setItem.mutate({ weekStart, id, patch: { checked: false } })}
        />
      )}

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}

function Line({
  item,
  detail,
  profiles,
  expanded,
  onExpand,
  onCheck,
  onPantry,
  onRemove,
}: {
  item: ShoppingItem;
  detail: { perProfile: Record<string, number>; dates: string[]; unit: string } | undefined;
  profiles: { slug: string; displayName: string }[];
  expanded: boolean;
  onExpand: () => void;
  onCheck: (checked: boolean) => void;
  onPantry: () => void;
  onRemove?: (() => void) | undefined;
}) {
  return (
    <li className="border-t border-line/70 first:border-t-0">
      <div className="flex items-center gap-2 py-1">
        <Checkbox checked={item.checked} onChange={onCheck} label={`Comprado: ${item.label}`} />
        <button
          type="button"
          onClick={onExpand}
          className="flex flex-1 flex-wrap items-baseline gap-x-2 py-1.5 text-left"
        >
          <span className="text-item font-medium text-ink">{item.label}</span>
          {item.quantityText && (
            <span className="text-item font-semibold text-ink">{item.quantityText}</span>
          )}
          {item.source === 'manual' && (
            <span className="text-measure text-ink-muted">(a mano)</span>
          )}
        </button>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Quitar ${item.label}`}
            className="grid size-9 place-items-center text-danger"
          >
            ×
          </button>
        )}
      </div>

      {expanded && (
        <div className="pb-2 pl-10 text-measure text-ink-muted">
          {detail && isCatalogKey(item.foodKey) && (
            <>
              <p>
                {profiles
                  .filter((profile) => detail.perProfile[profile.slug])
                  .map(
                    (profile) =>
                      `${profile.displayName}: ${detail.perProfile[profile.slug]} ${detail.unit}`,
                  )
                  .join(' · ')}
              </p>
              <p className="mt-0.5">
                De {detail.dates.length} {detail.dates.length === 1 ? 'día' : 'días'}
              </p>
            </>
          )}
          <button
            type="button"
            onClick={onPantry}
            className="mt-1 min-h-tap text-measure font-semibold text-ink underline"
          >
            Ya lo tengo en casa
          </button>
        </div>
      )}
    </li>
  );
}

function Collapsed({
  title,
  items,
  onRestore,
}: {
  title: string;
  items: ShoppingItem[];
  onRestore: (id: string) => void;
}) {
  return (
    <details className="rounded-day bg-surface p-4">
      <summary className="min-h-tap cursor-pointer text-item font-semibold text-ink">
        {title}
      </summary>
      <ul className="mt-2">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-2 border-t border-line/70 py-2">
            <span className="flex-1 text-item text-ink-muted line-through">{item.label}</span>
            <button
              type="button"
              onClick={() => onRestore(item.id)}
              className="min-h-tap text-measure font-semibold text-ink underline"
            >
              Devolver a la lista
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}
