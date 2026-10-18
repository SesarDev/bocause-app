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
import { DAY_NAMES, currentWeekStart, todayIn } from '../../domain/dates';
import { blankPlan, duplicatePlan, pruneUnusedBlocks } from '../../domain/draft';
import { instantiate, toLibraryBlock } from '../../domain/library';
import { isSharedSlot } from '../../domain/resolve';
import type { Block, LibraryBlock, Plan, SlotKey, TemplateCell } from '../../domain/schema';
import {
  useDiscardDraft,
  useDraft,
  useHouseholds,
  useSaveDraft,
  type HouseholdSummary,
} from '../../data/builder';
import { useFoods, useLibraryBlocks, useSaveLibraryBlock } from '../../data/library';
import { usePlan, usePlanOf } from '../../data/queries';
import { setActiveHousehold } from '../../data/scope';
import { BuilderConfig } from './BuilderConfig';
import { BuilderPreview } from './BuilderPreview';
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
  const discardDraft = useDiscardDraft(householdId === '' ? null : householdId);
  const library = useLibraryBlocks();
  const saveLibrary = useSaveLibraryBlock();
  const catalogo = useFoods();

  // El borrador se DERIVA de la consulta mientras nadie lo haya tocado, en vez de copiarse
  // a estado con un efecto: copiar deja dos fuentes de verdad y la segunda se queda vieja.
  const [editado, setEditado] = useState<Plan | null>(null);
  const borrador = editado ?? draft.data ?? null;
  const [seleccion, setSeleccion] = useState<{ day: number; fila: Fila } | null>(null);
  const [publicando, setPublicando] = useState(false);
  const [guardado, setGuardado] = useState<'guardado' | 'sin-guardar' | 'guardando'>('guardado');
  const [pestana, setPestana] = useState<'cuadricula' | 'configuracion' | 'vista'>('cuadricula');
  const [verComo, setVerComo] = useState<string | null>(null);
  const [confirmarDescarte, setConfirmarDescarte] = useState(false);

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

  const empezarEnBlanco = () => {
    if (household === null) return;
    tocar(
      blankPlan({
        id: crypto.randomUUID(),
        name: `Dieta de ${household.name}`,
        issuedOn: todayIn(),
        // Provisional: la fecha de verdad se elige al publicar, y tiene que ser lunes.
        validFrom: currentWeekStart(),
        people: household.people.map((persona) => ({
          profileId: persona.slug,
          displayName: persona.displayName,
        })),
        foods: catalogo.data ?? [],
      }),
    );
  };

  const empezarDuplicando = (origen: Plan, mapping: Record<string, string | null>) => {
    if (household === null) return;
    tocar(
      duplicatePlan(origen, {
        id: crypto.randomUUID(),
        name: `Dieta de ${household.name}`,
        issuedOn: todayIn(),
        mapping,
        people: household.people.map((persona) => ({
          profileId: persona.slug,
          displayName: persona.displayName,
        })),
        newId: () => crypto.randomUUID(),
      }),
    );
  };

  /** Guardar lo que hay en una celda como bloque de biblioteca, para reutilizarlo. */
  const guardarEnBiblioteca = (day: number, fila: Fila, nombre: string) => {
    if (borrador === null) return;
    const blockId = celdaDe(day, fila)?.blockId ?? null;
    const block = blockId === null ? null : borrador.blocks.find((b) => b.id === blockId);
    if (!block) return;

    // La ración base es la de la primera persona que come de esa celda: la biblioteca
    // guarda una sola, y al usarla se reparte con el multiplicador de cada cual.
    const base = fila.scope === 'shared' ? (household?.people[0]?.slug ?? '') : fila.scope;

    saveLibrary.mutate(toLibraryBlock(block, base, nombre, () => crypto.randomUUID()));
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
      <StartPanel
        household={household}
        otros={(households.data ?? []).filter(
          (candidato) => candidato.id !== householdId && candidato.plan !== null,
        )}
        hayDietaActual={planVigente.data != null}
        cargandoDietaActual={planVigente.isPending}
        onActual={empezarDesdeLaActual}
        onBlanco={empezarEnBlanco}
        onDuplicar={empezarDuplicando}
      />
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

        {/* Sin esto, la pantalla de empezar solo se ve una vez por hogar: con un borrador
            abierto no hay forma de volver a elegir de dónde parte la dieta. */}
        {confirmarDescarte ? (
          <span className="flex flex-wrap items-center gap-2 text-measure text-ink">
            ¿Seguro? Se pierde lo que no esté publicado.
            <button
              type="button"
              onClick={() => {
                if (temporizador.current !== null) clearTimeout(temporizador.current);
                setConfirmarDescarte(false);
                discardDraft.mutate(undefined, {
                  onSuccess: () => {
                    setEditado(null);
                    setSeleccion(null);
                    setPestana('cuadricula');
                  },
                });
              }}
              className="min-h-tap rounded-block border border-danger px-3 text-measure font-semibold text-danger"
            >
              Descartar
            </button>
            <button
              type="button"
              onClick={() => setConfirmarDescarte(false)}
              className="min-h-tap text-measure font-semibold text-ink-muted underline"
            >
              No
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmarDescarte(true)}
            className="min-h-tap text-measure font-semibold text-ink-muted underline"
          >
            Descartar el borrador
          </button>
        )}

        <button
          type="button"
          onClick={() => setPublicando(true)}
          className="min-h-tap rounded-block bg-slot px-4 text-item font-semibold text-slot-ink"
        >
          Publicar…
        </button>
      </header>

      <nav aria-label="Partes de la dieta" className="mt-4 flex flex-wrap gap-2">
        {(
          [
            ['cuadricula', 'Cuadrícula'],
            ['configuracion', 'Configuración'],
            ['vista', 'Ver como…'],
          ] as const
        ).map(([clave, titulo]) => (
          <button
            key={clave}
            type="button"
            onClick={() => setPestana(clave)}
            aria-pressed={pestana === clave}
            className={`min-h-tap rounded-chip px-4 text-item font-semibold ${
              pestana === clave ? 'bg-slot text-slot-ink' : 'border border-line text-ink'
            }`}
          >
            {titulo}
          </button>
        ))}
      </nav>

      {pestana === 'configuracion' && <BuilderConfig plan={borrador} onChange={tocar} />}

      {pestana === 'vista' && (
        <BuilderPreview
          plan={borrador}
          profileId={verComo ?? borrador.profiles[0]?.profileId ?? ''}
          onProfile={setVerComo}
        />
      )}

      <div className={`mt-4 overflow-x-auto ${pestana === 'cuadricula' ? '' : 'hidden'}`}>
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

      {pestana === 'cuadricula' && seleccion !== null && (
        <CellPanel
          dia={seleccion.day}
          fila={seleccion.fila}
          actual={tituloDe(borrador, celdaDe(seleccion.day, seleccion.fila)?.blockId ?? null)}
          library={library.data ?? []}
          onElegir={(bloque) => ponerBloque(seleccion.day, seleccion.fila, bloque)}
          onCopiar={(destinos) => copiarADias(seleccion.day, seleccion.fila, destinos)}
          onGuardarEnBiblioteca={(nombre) =>
            guardarEnBiblioteca(seleccion.day, seleccion.fila, nombre)
          }
          guardandoEnBiblioteca={saveLibrary.isPending}
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

/* ─────────────────────── Empezar ─────────────────────── */

/**
 * De dónde sale una dieta nueva: de la que ya tiene el hogar, de cero, o de la de otro
 * hogar. Duplicar pide decir quién hace de quién: sin eso, la comida de una persona
 * acabaría en el plato de otra sin que nadie lo haya dicho.
 */
function StartPanel({
  household,
  otros,
  hayDietaActual,
  cargandoDietaActual,
  onActual,
  onBlanco,
  onDuplicar,
}: {
  household: HouseholdSummary | null;
  otros: HouseholdSummary[];
  hayDietaActual: boolean;
  cargandoDietaActual: boolean;
  onActual: () => void;
  onBlanco: () => void;
  onDuplicar: (origen: Plan, mapping: Record<string, string | null>) => void;
}) {
  const [origenId, setOrigenId] = useState<string | null>(null);
  const [mapping, setMapping] = useState<Record<string, string | null>>({});
  const origen = usePlanOf(origenId);

  const personas = household?.people ?? [];

  return (
    <section className="rounded-day bg-surface p-6">
      <h1 className="text-dish font-bold text-ink">Dieta de {household?.name ?? '…'}</h1>
      <p className="mt-2 max-w-prose text-item text-ink-muted">
        No hay ningún borrador abierto. Lo que edites aquí no lo verá nadie hasta que publiques.
      </p>

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={!hayDietaActual}
          onClick={onActual}
          className="min-h-tap rounded-block bg-slot px-4 text-item font-semibold text-slot-ink disabled:opacity-40"
        >
          Partir de la dieta actual
        </button>

        <button
          type="button"
          disabled={personas.length === 0}
          onClick={onBlanco}
          className="min-h-tap rounded-block border border-line px-4 text-item font-semibold text-ink disabled:opacity-40"
        >
          Empezar en blanco
        </button>

        <button
          type="button"
          disabled={otros.length === 0}
          onClick={() => setOrigenId(otros[0]?.id ?? null)}
          className="min-h-tap rounded-block border border-line px-4 text-item font-semibold text-ink disabled:opacity-40"
        >
          Duplicar de otro hogar
        </button>
      </div>

      {!hayDietaActual && !cargandoDietaActual && (
        <p className="mt-3 text-measure text-ink-muted">
          Este hogar todavía no tiene dieta vigente de la que partir.
        </p>
      )}

      {personas.length === 0 && (
        <p className="mt-3 text-measure text-danger">
          Este hogar no tiene a nadie dentro. Añade las personas desde la ficha del hogar: una dieta
          sin comensales no se puede repartir.
        </p>
      )}

      {origenId !== null && (
        <div className="mt-5 rounded-block border border-line p-4">
          <h2 className="text-item font-bold text-ink">Duplicar de otro hogar</h2>

          <label className="mt-2 flex flex-wrap items-center gap-2 text-measure text-ink">
            Copiar la dieta de
            <select
              value={origenId}
              onChange={(event) => {
                setOrigenId(event.target.value);
                setMapping({});
              }}
              className="min-h-tap rounded-block border border-line bg-surface px-2 text-item text-ink"
            >
              {otros.map((candidato) => (
                <option key={candidato.id} value={candidato.id}>
                  {candidato.name}
                </option>
              ))}
            </select>
          </label>

          {origen.isPending && <p className="mt-3 text-measure text-ink-muted">Cargando…</p>}

          {origen.data && (
            <>
              <p className="mt-3 text-measure font-semibold text-ink">Quién hace de quién</p>
              <ul className="mt-1 flex flex-col gap-2">
                {origen.data.profiles.map((perfil) => (
                  <li key={perfil.profileId} className="flex flex-wrap items-center gap-2">
                    <span className="text-item text-ink">{perfil.displayName}</span>
                    <span aria-hidden="true" className="text-ink-muted">
                      →
                    </span>
                    <select
                      aria-label={`Quién hace de ${perfil.displayName}`}
                      value={mapping[perfil.profileId] ?? ''}
                      onChange={(event) =>
                        setMapping((actual) => ({
                          ...actual,
                          [perfil.profileId]: event.target.value === '' ? null : event.target.value,
                        }))
                      }
                      className="min-h-tap rounded-block border border-line bg-surface px-2 text-item text-ink"
                    >
                      <option value="">No copiar lo suyo</option>
                      {personas.map((persona) => (
                        <option key={persona.slug} value={persona.slug}>
                          {persona.displayName}
                        </option>
                      ))}
                    </select>
                  </li>
                ))}
              </ul>

              <p className="mt-2 max-w-prose text-measure text-ink-muted">
                Lo que no asignes se queda fuera: su franja, sus platos y su ración dentro de los
                compartidos. Las cantidades se copian tal cual, no se recalculan.
              </p>

              <button
                type="button"
                disabled={Object.values(mapping).every((destino) => destino === null)}
                onClick={() => origen.data && onDuplicar(origen.data, mapping)}
                className="mt-3 min-h-tap rounded-block bg-slot px-4 text-item font-semibold text-slot-ink disabled:opacity-40"
              >
                Duplicar esta dieta
              </button>
            </>
          )}
        </div>
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
  onGuardarEnBiblioteca,
  guardandoEnBiblioteca,
  onCerrar,
}: {
  dia: number;
  fila: Fila;
  actual: string;
  library: readonly LibraryBlock[];
  onElegir: (bloque: LibraryBlock | null) => void;
  onCopiar: (destinos: number[]) => void;
  onGuardarEnBiblioteca: (nombre: string) => void;
  guardandoEnBiblioteca: boolean;
  onCerrar: () => void;
}) {
  const [busqueda, setBusqueda] = useState('');
  const [destinos, setDestinos] = useState<number[]>([]);
  const [nombreBiblioteca, setNombreBiblioteca] = useState<string | null>(null);

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

      <div className="mt-3 flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() => onElegir(null)}
          className="min-h-tap text-measure font-semibold text-ink-muted underline"
        >
          Vaciar la celda
        </button>

        {actual !== '' && nombreBiblioteca === null && (
          <button
            type="button"
            onClick={() => setNombreBiblioteca(actual)}
            className="min-h-tap text-measure font-semibold text-ink-muted underline"
          >
            Guardar en la biblioteca
          </button>
        )}
      </div>

      {nombreBiblioteca !== null && (
        <div className="mt-3 rounded-block border border-line p-3">
          <label
            className="block text-measure font-semibold text-ink"
            htmlFor="nombre-en-biblioteca"
          >
            Con qué nombre se guarda
          </label>
          <p className="mt-1 max-w-prose text-measure text-ink-muted">
            Se guarda la ración de{' '}
            {fila.scope === 'shared' ? 'la primera persona del hogar' : 'esta persona'} como ración
            base. Al usarlo en otra dieta se reparte con el multiplicador de cada cual.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              id="nombre-en-biblioteca"
              value={nombreBiblioteca}
              onChange={(event) => setNombreBiblioteca(event.target.value)}
              className="min-h-tap w-full max-w-sm rounded-block border border-line bg-surface px-2 py-1 text-item text-ink"
            />
            <button
              type="button"
              disabled={nombreBiblioteca.trim() === '' || guardandoEnBiblioteca}
              onClick={() => {
                onGuardarEnBiblioteca(nombreBiblioteca.trim());
                setNombreBiblioteca(null);
              }}
              className="min-h-tap rounded-block bg-slot px-3 text-measure font-semibold text-slot-ink disabled:opacity-40"
            >
              Guardar
            </button>
            <button
              type="button"
              onClick={() => setNombreBiblioteca(null)}
              className="min-h-tap text-measure font-semibold text-ink-muted underline"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

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
