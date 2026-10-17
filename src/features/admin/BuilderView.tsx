/**
 * Constructor de dietas.
 *
 * Una cuadrícula de lunes a domingo donde la nutricionista rellena cada celda desde la
 * biblioteca o la vacía. **No hay intercambio entre días** (decisión 4 de `docs/PLAN.md`):
 * eso es cosa del cliente, que ajusta su semana. Aquí se edita en su sitio, y para repetir
 * un plato está "Copiar a otros días", que es explícito.
 *
 * Todo ocurre sobre un **borrador**: hasta que se publica, el cliente no ve nada. El
 * borrador se guarda solo, con un respiro de un segundo para no escribir en cada tecla.
 *
 * Al colocar un bloque de la biblioteca se instancia para las personas del hogar con su
 * multiplicador (`instantiate`), así que lo que se escribe son ya raciones concretas.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { DAY_NAMES } from '../../domain/dates';
import { pruneUnusedBlocks } from '../../domain/draft';
import { instantiate } from '../../domain/library';
import { isSharedSlot } from '../../domain/resolve';
import type { Block, LibraryBlock, Plan, SlotKey, TemplateCell } from '../../domain/schema';
import { useDraft, useHouseholds, useSaveDraft } from '../../data/builder';
import { useLibraryBlocks } from '../../data/library';
import { usePlan } from '../../data/queries';
import { setActiveHousehold } from '../../data/scope';
import { PublishPanel } from './PublishPanel';

const DIAS = [0, 1, 2, 3, 4, 5, 6] as const;

type Fila = { slot: SlotKey; scope: string; etiqueta: string };

/** Una fila por franja individual de cada persona, y una por franja compartida. */
function filasDe(plan: Plan): Fila[] {
  const filas: Fila[] = [];
  const compartidasPuestas = new Set<SlotKey>();

  for (const persona of plan.profiles) {
    for (const slot of persona.slots) {
      if (isSharedSlot(slot)) {
        if (compartidasPuestas.has(slot)) continue;
        compartidasPuestas.add(slot);
        filas.push({ slot, scope: 'shared', etiqueta: slot.toUpperCase() });
      } else {
        filas.push({
          slot,
          scope: persona.profileId,
          etiqueta: `${slot.toUpperCase()} · ${persona.displayName}`,
        });
      }
    }
  }

  // Las compartidas al final: son las que se cocinan juntas y se leen como un bloque.
  return [
    ...filas.filter((f) => f.scope !== 'shared'),
    ...filas.filter((f) => f.scope === 'shared'),
  ];
}

function tituloDe(plan: Plan, blockId: string | null): string {
  if (blockId === null) return '';
  const block = plan.blocks.find((candidate) => candidate.id === blockId);
  if (block === undefined) return '(falta)';
  const titulo = block.sections.find((section) => section.title !== undefined)?.title;
  return titulo ?? block.sections[0]?.items[0]?.label ?? 'Sin nombre';
}

export function BuilderView() {
  const { householdId = '' } = useParams();
  const households = useHouseholds();
  const household = households.data?.find((candidate) => candidate.id === householdId) ?? null;

  // El constructor mira el hogar del cliente, no el de quien ha entrado. Para esto se
  // separó el hogar activo en scope.ts.
  useEffect(() => {
    if (householdId !== '') setActiveHousehold(householdId);
    return () => setActiveHousehold(null);
  }, [householdId]);

  const planVigente = usePlan();
  const draft = useDraft(householdId === '' ? null : householdId);
  const saveDraft = useSaveDraft(householdId === '' ? null : householdId);
  const library = useLibraryBlocks();

  // El borrador se DERIVA de la consulta mientras nadie lo haya tocado, en vez de copiarse
  // a estado con un efecto: copiar deja dos fuentes de verdad y la segunda se queda vieja.
  const [editado, setEditado] = useState<Plan | null>(null);
  const borrador = editado ?? draft.data ?? null;
  const [seleccion, setSeleccion] = useState<{ day: number; fila: Fila } | null>(null);
  const [publicando, setPublicando] = useState(false);
  const [guardado, setGuardado] = useState<'guardado' | 'sin-guardar' | 'guardando'>('guardado');

  /* ── Autoguardado ── */

  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  const tocar = useCallback(
    (sucio: Plan) => {
      // Se limpian los bloques que ya no usa ninguna celda: el constructor crea uno nuevo
      // cada vez que se rellena, y sin esto el borrador acumula los descartes y acaban
      // publicados dentro del plan.
      const siguiente = pruneUnusedBlocks(sucio);
      setEditado(siguiente);
      setGuardado('sin-guardar');

      if (temporizador.current !== null) clearTimeout(temporizador.current);
      temporizador.current = setTimeout(() => {
        setGuardado('guardando');
        saveDraft.mutate(
          { plan: siguiente, basePlanId: planVigente.data?.id ?? null },
          {
            onSuccess: () => setGuardado('guardado'),
            onError: () => setGuardado('sin-guardar'),
          },
        );
      }, 1000);
    },
    [saveDraft, planVigente.data],
  );

  useEffect(() => {
    return () => {
      if (temporizador.current !== null) clearTimeout(temporizador.current);
    };
  }, []);

  /* ── Empezar ── */

  const empezarDesdeLaActual = () => {
    if (!planVigente.data) return;
    // Se conservan los ids de bloque: así, al publicar, la comparación con la dieta anterior
    // sabe qué celdas no se han tocado (lo pide PLAN.md).
    tocar(structuredClone(planVigente.data));
  };

  const filas = useMemo(() => (borrador === null ? [] : filasDe(borrador)), [borrador]);

  const celdaDe = useCallback(
    (day: number, fila: Fila): TemplateCell | undefined =>
      borrador?.template.find(
        (cell) => cell.day === day && cell.slot === fila.slot && cell.scope === fila.scope,
      ),
    [borrador],
  );

  /* ── Editar una celda ── */

  const ponerBloque = (day: number, fila: Fila, bloque: LibraryBlock | null) => {
    if (borrador === null) return;

    const siguiente = structuredClone(borrador);
    let blockId: string | null = null;

    if (bloque !== null) {
      const comensales =
        fila.scope === 'shared'
          ? (household?.people ?? []).map((persona) => ({
              profileId: persona.slug,
              multiplier: persona.portionMultiplier,
            }))
          : [
              {
                profileId: fila.scope,
                multiplier:
                  household?.people.find((persona) => persona.slug === fila.scope)
                    ?.portionMultiplier ?? 1,
              },
            ];

      const { sections } = instantiate(bloque, comensales);
      const nuevo: Block = {
        id: crypto.randomUUID(),
        planId: siguiente.id,
        slot: fila.slot,
        scope: fila.scope,
        sections,
        isOriginal: true,
      };
      siguiente.blocks = [...siguiente.blocks, nuevo];
      blockId = nuevo.id;
    }

    const sinLaCelda = siguiente.template.filter(
      (cell) => !(cell.day === day && cell.slot === fila.slot && cell.scope === fila.scope),
    );
    siguiente.template = [...sinLaCelda, { day, slot: fila.slot, scope: fila.scope, blockId }];

    tocar(siguiente);
  };

  const copiarADias = (origen: number, fila: Fila, destinos: number[]) => {
    if (borrador === null) return;
    const celda = celdaDe(origen, fila);
    if (celda === undefined) return;

    const siguiente = structuredClone(borrador);
    for (const day of destinos) {
      siguiente.template = siguiente.template.filter(
        (cell) => !(cell.day === day && cell.slot === fila.slot && cell.scope === fila.scope),
      );
      siguiente.template.push({ day, slot: fila.slot, scope: fila.scope, blockId: celda.blockId });
    }
    tocar(siguiente);
  };

  /* ── Pantallas ── */

  if (household === null && !households.isPending) {
    return (
      <section className="rounded-day bg-surface p-6">
        <h1 className="text-dish font-bold text-ink">Hogar no encontrado</h1>
        <Link to="/admin/hogares" className="mt-3 inline-block text-item underline">
          Volver a los hogares
        </Link>
      </section>
    );
  }

  if (borrador === null) {
    return (
      <section className="rounded-day bg-surface p-6">
        <h1 className="text-dish font-bold text-ink">Dieta de {household?.name ?? '…'}</h1>
        <p className="mt-2 max-w-prose text-item text-ink-muted">
          No hay ningún borrador abierto. Lo que edites aquí no lo verá nadie hasta que publiques.
        </p>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={!planVigente.data}
            onClick={empezarDesdeLaActual}
            className="min-h-tap rounded-block bg-slot px-4 text-item font-semibold text-slot-ink disabled:opacity-40"
          >
            Partir de la dieta actual
          </button>
        </div>

        {!planVigente.data && !planVigente.isPending && (
          <p className="mt-3 text-measure text-ink-muted">
            Este hogar no tiene dieta vigente de la que partir. Empezar en blanco llega con el resto
            del constructor.
          </p>
        )}
      </section>
    );
  }

  return (
    <section className="rounded-day bg-surface p-6">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="flex-1 text-dish font-bold text-ink">Dieta de {household?.name ?? '…'}</h1>

        <span
          role="status"
          className={`text-measure font-semibold ${
            guardado === 'guardado' ? 'text-ink-muted' : 'text-danger'
          }`}
        >
          {guardado === 'guardado' && 'Guardado'}
          {guardado === 'guardando' && 'Guardando…'}
          {guardado === 'sin-guardar' && 'Sin guardar'}
        </span>

        <button
          type="button"
          onClick={() => setPublicando(true)}
          className="min-h-tap rounded-block bg-slot px-4 text-item font-semibold text-slot-ink"
        >
          Publicar…
        </button>
      </header>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-collapse text-measure">
          <thead>
            <tr>
              <th className="w-44 border-b border-line py-2 text-left text-ink-muted">Franja</th>
              {DIAS.map((day) => (
                <th key={day} className="border-b border-line py-2 text-left text-ink">
                  {DAY_NAMES[day]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((fila) => (
              <tr key={`${fila.slot}-${fila.scope}`}>
                <th className="border-b border-line/60 py-1 pr-2 text-left align-top text-ink">
                  {fila.etiqueta}
                </th>
                {DIAS.map((day) => {
                  const celda = celdaDe(day, fila);
                  const titulo = tituloDe(borrador, celda?.blockId ?? null);
                  const activa =
                    seleccion?.day === day &&
                    seleccion.fila.slot === fila.slot &&
                    seleccion.fila.scope === fila.scope;

                  return (
                    <td key={day} className="border-b border-line/60 p-0.5 align-top">
                      <button
                        type="button"
                        onClick={() => setSeleccion({ day, fila })}
                        className={`min-h-tap w-full rounded-block px-2 py-1 text-left ${
                          activa ? 'bg-slot text-slot-ink' : 'bg-bg text-ink hover:bg-surface-alt'
                        }`}
                      >
                        {titulo === '' ? <span className="text-ink-muted">—</span> : titulo}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {seleccion !== null && (
        <CellPanel
          dia={seleccion.day}
          fila={seleccion.fila}
          actual={tituloDe(borrador, celdaDe(seleccion.day, seleccion.fila)?.blockId ?? null)}
          library={library.data ?? []}
          onElegir={(bloque) => ponerBloque(seleccion.day, seleccion.fila, bloque)}
          onCopiar={(destinos) => copiarADias(seleccion.day, seleccion.fila, destinos)}
          onCerrar={() => setSeleccion(null)}
        />
      )}

      {publicando && (
        <PublishPanel
          householdId={householdId}
          borrador={borrador}
          onCerrar={() => setPublicando(false)}
        />
      )}
    </section>
  );
}

/* ─────────────────────── Panel de celda ─────────────────────── */

function CellPanel({
  dia,
  fila,
  actual,
  library,
  onElegir,
  onCopiar,
  onCerrar,
}: {
  dia: number;
  fila: Fila;
  actual: string;
  library: readonly LibraryBlock[];
  onElegir: (bloque: LibraryBlock | null) => void;
  onCopiar: (destinos: number[]) => void;
  onCerrar: () => void;
}) {
  const [busqueda, setBusqueda] = useState('');
  const [destinos, setDestinos] = useState<number[]>([]);

  // Se ofrecen primero los bloques de esta franja, que es lo que casi siempre se quiere.
  const candidatos = useMemo(() => {
    const q = busqueda.trim().toLocaleLowerCase('es-ES');
    const filtrados = library.filter(
      (bloque) => q === '' || bloque.name.toLocaleLowerCase('es-ES').includes(q),
    );
    const deLaFranja = filtrados.filter((bloque) => bloque.slots.includes(fila.slot));
    const resto = filtrados.filter((bloque) => !bloque.slots.includes(fila.slot));
    return [...deLaFranja, ...resto];
  }, [library, busqueda, fila.slot]);

  return (
    <aside className="mt-5 rounded-block border border-line p-4">
      <header className="flex flex-wrap items-center gap-2">
        <h2 className="flex-1 text-item font-bold text-ink">
          {fila.etiqueta} · {DAY_NAMES[dia]}
        </h2>
        <button
          type="button"
          onClick={onCerrar}
          className="min-h-tap text-measure font-semibold text-ink-muted underline"
        >
          Cerrar
        </button>
      </header>

      <p className="mt-1 text-measure text-ink-muted">
        {actual === '' ? 'Celda vacía.' : `Ahora: ${actual}.`}
      </p>

      <input
        type="search"
        value={busqueda}
        onChange={(event) => setBusqueda(event.target.value)}
        placeholder="Buscar en la biblioteca…"
        className="mt-3 min-h-tap w-full max-w-sm rounded-block border border-line bg-surface px-2 py-1 text-item text-ink"
      />

      <ul className="mt-2 flex max-h-64 flex-col gap-1 overflow-y-auto">
        {candidatos.map((bloque) => (
          <li key={bloque.id}>
            <button
              type="button"
              onClick={() => onElegir(bloque)}
              className="flex min-h-tap w-full items-center gap-2 rounded-block border border-line px-3 text-left text-item text-ink"
            >
              <span className="flex-1">{bloque.name}</span>
              {!bloque.slots.includes(fila.slot) && (
                <span className="text-measure text-ink-muted">otra franja</span>
              )}
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onElegir(null)}
          className="min-h-tap text-measure font-semibold text-ink-muted underline"
        >
          Vaciar la celda
        </button>
      </div>

      <div className="mt-3 border-t border-line pt-3">
        <p className="text-measure font-semibold text-ink">Copiar a otros días</p>
        <div className="mt-1 flex flex-wrap gap-2">
          {DIAS.filter((day) => day !== dia).map((day) => (
            <label key={day} className="flex items-center gap-1 text-measure text-ink">
              <input
                type="checkbox"
                checked={destinos.includes(day)}
                onChange={(event) =>
                  setDestinos(
                    event.target.checked
                      ? [...destinos, day]
                      : destinos.filter((candidato) => candidato !== day),
                  )
                }
              />
              {DAY_NAMES[day]?.slice(0, 3)}
            </label>
          ))}
          <button
            type="button"
            disabled={destinos.length === 0}
            onClick={() => {
              onCopiar(destinos);
              setDestinos([]);
            }}
            className="min-h-tap rounded-block bg-slot px-3 text-measure font-semibold text-slot-ink disabled:opacity-40"
          >
            Copiar
          </button>
        </div>
      </div>
    </aside>
  );
}
