/**
 * Configuración de la dieta: todo lo que no es la cuadrícula.
 *
 * Franjas de cada persona, entreno de cada día, suplementación, comodín proteico, las
 * reglas del plan, las recomendaciones y las recetas. Antes solo se podía tocar editando a
 * mano el JSON del plan.
 *
 * Trabaja sobre el borrador, como la cuadrícula: cada cambio sube por `onChange` y el
 * constructor se encarga de guardarlo con su respiro de un segundo.
 */
import { useId } from 'react';
import { DAY_NAMES } from '../../domain/dates';
import type { ComodinOption, Plan, ProfilePlan, Recipe, SlotKey } from '../../domain/schema';
import { SLOTS_EN_ORDEN } from '../../data/library';

const input = 'min-h-tap rounded-block border border-line bg-surface px-2 py-1 text-item text-ink';
const chip = 'min-h-tap rounded-chip px-3 text-measure font-semibold';

/**
 * Un campo opcional que se deja en blanco se **quita**, no se guarda como cadena vacía.
 *
 * El plan publicado es un documento que se lee en muchos sitios, y un `measure: ""` obliga
 * a cada uno de ellos a distinguir "no tiene medida" de "tiene una medida vacía".
 */
function sinVacios<T extends object>(objeto: T, claves: readonly (keyof T)[]): T {
  const limpio = { ...objeto };
  for (const clave of claves) {
    if (typeof limpio[clave] === 'string' && (limpio[clave] as string).trim() === '') {
      delete limpio[clave];
    }
  }
  return limpio;
}

function Campo({
  etiqueta,
  children,
  ancho = 'w-full max-w-md',
}: {
  etiqueta: string;
  children: (id: string) => React.ReactNode;
  ancho?: string;
}) {
  const id = useId();
  return (
    <span className={ancho}>
      <label className="block text-measure font-semibold text-ink" htmlFor={id}>
        {etiqueta}
      </label>
      {children(id)}
    </span>
  );
}

/* ─────────────────────── Persona ─────────────────────── */

function Persona({
  perfil,
  tiposDeEntreno,
  onChange,
}: {
  perfil: ProfilePlan;
  tiposDeEntreno: string[];
  onChange: (perfil: ProfilePlan) => void;
}) {
  const listaEntrenos = `entrenos-${perfil.profileId}`;

  const alternarFranja = (slot: SlotKey) =>
    onChange({
      ...perfil,
      // Se guardan en el orden del día, no en el de los clics: es el orden en el que la
      // persona las ve en su pantalla.
      slots: perfil.slots.includes(slot)
        ? perfil.slots.filter((actual) => actual !== slot)
        : SLOTS_EN_ORDEN.filter((actual) => actual === slot || perfil.slots.includes(actual)),
    });

  const cambiarComodin = (index: number, patch: Partial<ComodinOption>) =>
    onChange({
      ...perfil,
      comodin: perfil.comodin.map((opcion, i) =>
        i === index ? sinVacios({ ...opcion, ...patch }, ['measure']) : opcion,
      ),
    });

  return (
    <section className="rounded-block border border-line p-4">
      <h3 className="text-item font-bold text-ink">{perfil.displayName}</h3>

      <div className="mt-3 flex flex-col gap-4">
        <Campo etiqueta="Nombre visible">
          {(id) => (
            <input
              id={id}
              value={perfil.displayName}
              onChange={(event) => onChange({ ...perfil, displayName: event.target.value })}
              className={`mt-1 w-full ${input}`}
            />
          )}
        </Campo>

        <span>
          <p className="text-measure font-semibold text-ink">Sus franjas</p>
          <div className="mt-1 flex flex-wrap gap-2">
            {SLOTS_EN_ORDEN.map((slot) => (
              <button
                key={slot}
                type="button"
                onClick={() => alternarFranja(slot)}
                aria-pressed={perfil.slots.includes(slot)}
                className={`${chip} ${
                  perfil.slots.includes(slot)
                    ? 'bg-slot text-slot-ink'
                    : 'border border-line text-ink'
                }`}
              >
                {slot}
              </button>
            ))}
          </div>
          {perfil.slots.length === 0 && (
            <p role="alert" className="mt-1 text-measure text-danger">
              Sin ninguna franja no vería nada en su pantalla.
            </p>
          )}
        </span>

        <span>
          <p className="text-measure font-semibold text-ink">Entreno de cada día</p>
          <datalist id={listaEntrenos}>
            {tiposDeEntreno.map((tipo) => (
              <option key={tipo} value={tipo} />
            ))}
          </datalist>
          <div className="mt-1 grid grid-cols-2 gap-2 lg:grid-cols-4">
            {perfil.training.map((tipo, day) => (
              <span key={day}>
                <label
                  className="block text-[0.6875rem] font-semibold text-ink-muted"
                  htmlFor={`${perfil.profileId}-entreno-${day}`}
                >
                  {DAY_NAMES[day]}
                </label>
                <input
                  id={`${perfil.profileId}-entreno-${day}`}
                  list={listaEntrenos}
                  value={tipo ?? ''}
                  placeholder="Descanso"
                  onChange={(event) => {
                    const texto = event.target.value.trim();
                    const training = [...perfil.training];
                    training[day] = texto === '' ? null : event.target.value;
                    onChange({ ...perfil, training });
                  }}
                  className={`mt-0.5 w-full ${input}`}
                />
              </span>
            ))}
          </div>
        </span>

        <span>
          <p className="text-measure font-semibold text-ink">
            Comodín proteico · {perfil.comodin.length} opciones
          </p>
          <ul className="mt-1 flex flex-col gap-2">
            {perfil.comodin.map((opcion, index) => (
              <li key={opcion.id} className="flex flex-wrap items-center gap-2">
                <input
                  value={opcion.label}
                  aria-label="Alimento"
                  placeholder="Pechuga de pavo"
                  onChange={(event) => cambiarComodin(index, { label: event.target.value })}
                  className={`flex-1 ${input}`}
                />
                <input
                  value={opcion.amount}
                  aria-label="Cantidad"
                  placeholder="50 g"
                  onChange={(event) => cambiarComodin(index, { amount: event.target.value })}
                  className={`w-24 ${input}`}
                />
                <input
                  value={opcion.measure ?? ''}
                  aria-label="Medida de casa"
                  placeholder="3 lonchas finas"
                  onChange={(event) => cambiarComodin(index, { measure: event.target.value })}
                  className={`w-44 ${input}`}
                />
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      ...perfil,
                      comodin: perfil.comodin.filter((_, i) => i !== index),
                    })
                  }
                  aria-label={`Quitar ${opcion.label || 'opción'}`}
                  className="grid size-9 place-items-center text-danger"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() =>
              onChange({
                ...perfil,
                comodin: [
                  ...perfil.comodin,
                  { id: crypto.randomUUID(), label: '', amount: '', measure: '' },
                ],
              })
            }
            className={`mt-2 ${chip} border border-line text-ink`}
          >
            + Añadir opción
          </button>
        </span>

        <span>
          <p className="text-measure font-semibold text-ink">Suplementación por tipo de entreno</p>
          <ul className="mt-1 flex flex-col gap-2">
            {perfil.supplements.map((protocolo, index) => {
              const cambiar = (patch: Partial<(typeof perfil.supplements)[number]>) =>
                onChange({
                  ...perfil,
                  supplements: perfil.supplements.map((actual, i) =>
                    i === index
                      ? sinVacios({ ...actual, ...patch }, ['pre', 'intra', 'post'])
                      : actual,
                  ),
                });

              return (
                <li key={index} className="flex flex-wrap items-center gap-2">
                  <input
                    value={protocolo.trainingType}
                    aria-label="Tipo de entreno"
                    list={listaEntrenos}
                    placeholder="Gimnasio (Fuerza)"
                    onChange={(event) => cambiar({ trainingType: event.target.value })}
                    className={`w-48 ${input}`}
                  />
                  <input
                    value={protocolo.pre ?? ''}
                    aria-label="Antes"
                    placeholder="Antes"
                    onChange={(event) => cambiar({ pre: event.target.value })}
                    className={`flex-1 ${input}`}
                  />
                  <input
                    value={protocolo.intra ?? ''}
                    aria-label="Durante"
                    placeholder="Durante"
                    onChange={(event) => cambiar({ intra: event.target.value })}
                    className={`flex-1 ${input}`}
                  />
                  <input
                    value={protocolo.post ?? ''}
                    aria-label="Después"
                    placeholder="Después"
                    onChange={(event) => cambiar({ post: event.target.value })}
                    className={`flex-1 ${input}`}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      onChange({
                        ...perfil,
                        supplements: perfil.supplements.filter((_, i) => i !== index),
                      })
                    }
                    aria-label={`Quitar el protocolo de ${protocolo.trainingType || 'entreno'}`}
                    className="grid size-9 place-items-center text-danger"
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            onClick={() =>
              onChange({
                ...perfil,
                supplements: [...perfil.supplements, { trainingType: '', pre: '', post: '' }],
              })
            }
            className={`mt-2 ${chip} border border-line text-ink`}
          >
            + Añadir protocolo
          </button>
        </span>
      </div>
    </section>
  );
}

/* ─────────────────────── Recetas ─────────────────────── */

function Receta({
  receta,
  onChange,
  onQuitar,
}: {
  receta: Recipe;
  onChange: (receta: Recipe) => void;
  onQuitar: () => void;
}) {
  return (
    <li className="rounded-block border border-line p-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={receta.title}
          aria-label="Título de la receta"
          placeholder="Ñoquis con pollo"
          onChange={(event) => onChange({ ...receta, title: event.target.value })}
          className={`flex-1 ${input}`}
        />
        <label className="flex items-center gap-2 text-measure text-ink">
          <input
            type="checkbox"
            checked={receta.kind === 'cheat_meal'}
            onChange={(event) =>
              onChange({ ...receta, kind: event.target.checked ? 'cheat_meal' : 'plato' })
            }
            className="size-5 accent-[var(--color-check)]"
          />
          Día del glotón
        </label>
        <button
          type="button"
          onClick={onQuitar}
          aria-label={`Quitar ${receta.title || 'la receta'}`}
          className="grid size-9 place-items-center text-danger"
        >
          ×
        </button>
      </div>

      <p className="mt-3 text-measure font-semibold text-ink">Ingredientes</p>
      <ul className="mt-1 flex flex-col gap-1">
        {receta.ingredients.map((ingrediente, index) => {
          const cambiar = (patch: Partial<(typeof receta.ingredients)[number]>) =>
            onChange({
              ...receta,
              ingredients: receta.ingredients.map((actual, i) =>
                i === index
                  ? sinVacios({ ...actual, ...patch }, ['rawG', 'cookedG', 'measure'])
                  : actual,
              ),
            });

          return (
            <li key={index} className="flex flex-wrap items-center gap-2">
              <input
                value={ingrediente.label}
                aria-label="Ingrediente"
                placeholder="Harina de avena"
                onChange={(event) => cambiar({ label: event.target.value })}
                className={`flex-1 ${input}`}
              />
              <input
                value={ingrediente.rawG ?? ''}
                aria-label="Cantidad"
                placeholder="60 g"
                onChange={(event) => cambiar({ rawG: event.target.value })}
                className={`w-28 ${input}`}
              />
              <input
                value={ingrediente.measure ?? ''}
                aria-label="Medida de casa"
                placeholder="2 cucharadas"
                onChange={(event) => cambiar({ measure: event.target.value })}
                className={`w-44 ${input}`}
              />
              <button
                type="button"
                onClick={() =>
                  onChange({
                    ...receta,
                    ingredients: receta.ingredients.filter((_, i) => i !== index),
                  })
                }
                aria-label={`Quitar ${ingrediente.label || 'ingrediente'}`}
                className="grid size-9 place-items-center text-danger"
              >
                ×
              </button>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        onClick={() => onChange({ ...receta, ingredients: [...receta.ingredients, { label: '' }] })}
        className={`mt-2 ${chip} border border-line text-ink`}
      >
        + Añadir ingrediente
      </button>

      <Campo etiqueta="Pasos, uno por línea" ancho="mt-3 block w-full">
        {(id) => (
          <textarea
            id={id}
            rows={3}
            value={receta.steps.join('\n')}
            onChange={(event) =>
              onChange({
                ...receta,
                steps: event.target.value.split('\n').filter((paso) => paso.trim() !== ''),
              })
            }
            className={`mt-1 w-full resize-y ${input}`}
          />
        )}
      </Campo>
    </li>
  );
}

/* ─────────────────────── Pantalla ─────────────────────── */

export function BuilderConfig({ plan, onChange }: { plan: Plan; onChange: (plan: Plan) => void }) {
  // Los tipos de entreno que ya usa la dieta, para que escribir el segundo no sea volver a
  // teclearlo entero (y para que no acaben "Running" y "running" conviviendo).
  const tiposDeEntreno = [
    ...new Set(
      plan.profiles.flatMap((perfil) => [
        ...perfil.training.filter((tipo): tipo is string => tipo !== null),
        ...perfil.supplements.map((protocolo) => protocolo.trainingType),
      ]),
    ),
  ]
    .filter((tipo) => tipo.trim() !== '')
    .sort();

  const cambiarPerfil = (index: number, perfil: ProfilePlan) =>
    onChange({
      ...plan,
      profiles: plan.profiles.map((actual, i) => (i === index ? perfil : actual)),
    });

  const cambiarRegla = (patch: Partial<Plan['rules']>) =>
    onChange({ ...plan, rules: { ...plan.rules, ...patch } });

  const numero = (valor: string, porDefecto: number) => {
    const n = Number(valor.replace(',', '.'));
    return Number.isFinite(n) && n >= 0 ? n : porDefecto;
  };

  return (
    <div className="mt-4 flex flex-col gap-5">
      <Campo etiqueta="Nombre de la dieta">
        {(id) => (
          <input
            id={id}
            value={plan.name}
            onChange={(event) => onChange({ ...plan, name: event.target.value })}
            className={`mt-1 w-full ${input}`}
          />
        )}
      </Campo>

      {plan.profiles.map((perfil, index) => (
        <Persona
          key={perfil.profileId}
          perfil={perfil}
          tiposDeEntreno={tiposDeEntreno}
          onChange={(siguiente) => cambiarPerfil(index, siguiente)}
        />
      ))}

      <section className="rounded-block border border-line p-4">
        <h3 className="text-item font-bold text-ink">Reglas del plan</h3>
        <div className="mt-3 flex flex-wrap gap-4">
          <Campo etiqueta="AOVE, cucharadas por semana" ancho="w-52">
            {(id) => (
              <input
                id={id}
                inputMode="decimal"
                value={plan.rules.aoveMaxSpoonsPerWeek}
                onChange={(event) =>
                  cambiarRegla({ aoveMaxSpoonsPerWeek: numero(event.target.value, 14) })
                }
                className={`mt-1 w-full ${input}`}
              />
            )}
          </Campo>
          <Campo etiqueta="Ingestas libres por semana" ancho="w-52">
            {(id) => (
              <input
                id={id}
                inputMode="decimal"
                value={plan.rules.freeMealsPerWeek}
                onChange={(event) =>
                  cambiarRegla({ freeMealsPerWeek: numero(event.target.value, 2) })
                }
                className={`mt-1 w-full ${input}`}
              />
            )}
          </Campo>
          <Campo etiqueta="Agua, litros mínimos" ancho="w-40">
            {(id) => (
              <input
                id={id}
                inputMode="decimal"
                value={plan.rules.waterLitersMin}
                onChange={(event) =>
                  cambiarRegla({ waterLitersMin: numero(event.target.value, 2) })
                }
                className={`mt-1 w-full ${input}`}
              />
            )}
          </Campo>
          <Campo etiqueta="Agua, litros máximos" ancho="w-40">
            {(id) => (
              <input
                id={id}
                inputMode="decimal"
                value={plan.rules.waterLitersMax}
                onChange={(event) =>
                  cambiarRegla({ waterLitersMax: numero(event.target.value, 3) })
                }
                className={`mt-1 w-full ${input}`}
              />
            )}
          </Campo>
        </div>

        <label className="mt-3 flex items-center gap-2 text-item text-ink">
          <input
            type="checkbox"
            checked={plan.rules.comodinRequired}
            onChange={(event) => cambiarRegla({ comodinRequired: event.target.checked })}
            className="size-5 accent-[var(--color-check)]"
          />
          El comodín proteico es obligatorio cada día
        </label>

        <Campo etiqueta="Recomendaciones, una por línea" ancho="mt-3 block w-full max-w-2xl">
          {(id) => (
            <textarea
              id={id}
              rows={4}
              value={plan.rules.recommendations.join('\n')}
              onChange={(event) =>
                cambiarRegla({
                  recommendations: event.target.value
                    .split('\n')
                    .filter((linea) => linea.trim() !== ''),
                })
              }
              placeholder={'Bebe 2-3 L de agua al día\nDuerme 7-8 horas'}
              className={`mt-1 w-full resize-y ${input}`}
            />
          )}
        </Campo>
      </section>

      <section className="rounded-block border border-line p-4">
        <h3 className="text-item font-bold text-ink">Recetas</h3>
        <p className="mt-1 text-measure text-ink-muted">
          Salen en la pestaña Más del cliente. Las del día del glotón van marcadas aparte.
        </p>

        <ul className="mt-3 flex flex-col gap-3">
          {plan.recipes.map((receta, index) => (
            <Receta
              key={receta.id}
              receta={receta}
              onChange={(siguiente) =>
                onChange({
                  ...plan,
                  recipes: plan.recipes.map((actual, i) => (i === index ? siguiente : actual)),
                })
              }
              onQuitar={() =>
                onChange({ ...plan, recipes: plan.recipes.filter((_, i) => i !== index) })
              }
            />
          ))}
        </ul>

        <button
          type="button"
          onClick={() =>
            onChange({
              ...plan,
              recipes: [
                ...plan.recipes,
                { id: crypto.randomUUID(), title: '', ingredients: [], steps: [], kind: 'plato' },
              ],
            })
          }
          className={`mt-3 ${chip} border border-line text-ink`}
        >
          + Añadir receta
        </button>
      </section>
    </div>
  );
}
