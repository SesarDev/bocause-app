/**
 * Zona de la nutricionista. Se carga con `lazy()` desde el router: el código de aquí **no
 * viaja en el paquete que se descarga el móvil de un cliente**, que es lo que pide la
 * decisión 10 de docs/PLAN.md.
 *
 * Está pensada para escritorio (≥1024 px), al revés que la app del cliente. Usa los mismos
 * tokens de color y tipografía, así que hereda los dos temas sin nada extra.
 *
 * Biblioteca, Alimentos y Equivalencias ya tienen contenido (fase 15). Las demás siguen
 * siendo huecos con su estado vacío, que dice qué irá allí y en qué fase: un hueco mudo
 * parece un error.
 */
import type { ReactNode } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { brand } from '../../config/brand';
import { Icon, type IconName } from '../../components/Icon';
import { signOut } from '../../data/auth';
import { BuilderView } from './BuilderView';
import { EquivalencesView } from './EquivalencesView';
import { FoodsView } from './FoodsView';
import { HouseholdDetail } from './HouseholdDetail';
import { HouseholdsView } from './HouseholdsView';
import { LibraryView } from './LibraryView';

type Seccion = {
  ruta: string;
  titulo: string;
  icono: IconName;
  /** La pantalla, cuando ya existe. */
  vista?: ReactNode;
  /** Qué irá aquí y en qué fase, para que el hueco no parezca un error. */
  pendiente: string;
};

const SECCIONES: Seccion[] = [
  {
    ruta: 'hogares',
    titulo: 'Hogares',
    icono: 'perfil',
    vista: <HouseholdsView />,
    pendiente: '',
  },
  {
    ruta: 'biblioteca',
    titulo: 'Biblioteca',
    icono: 'receta',
    vista: <LibraryView />,
    pendiente: '',
  },
  {
    ruta: 'alimentos',
    titulo: 'Alimentos',
    icono: 'compra',
    vista: <FoodsView />,
    pendiente: '',
  },
  {
    ruta: 'equivalencias',
    titulo: 'Equivalencias',
    icono: 'libre',
    vista: <EquivalencesView />,
    pendiente: '',
  },
  {
    ruta: 'documentacion',
    titulo: 'Documentación',
    icono: 'hoy',
    pendiente: 'Los textos con los que responderá el chat de dudas. Fase 19.',
  },
  {
    ruta: 'registro',
    titulo: 'Registro',
    icono: 'entreno',
    pendiente: 'Quién cambió qué y cuándo, en cada hogar. Fase 14.',
  },
];

function Hueco({ seccion }: { seccion: Seccion }) {
  return (
    <section className="rounded-day bg-surface p-8">
      <h1 className="text-dish font-bold text-ink">{seccion.titulo}</h1>
      <p className="mt-3 max-w-prose text-item text-ink-muted">{seccion.pendiente}</p>
    </section>
  );
}

export default function AdminApp() {
  return (
    <div className="min-h-dvh bg-bg text-ink">
      {/* La app del cliente es de móvil; esta es de escritorio. Si alguien la abre en el
          teléfono, mejor decirlo que dejar que pelee con una tabla de siete columnas. */}
      <p className="bg-slot px-4 py-2 text-center text-measure font-semibold text-slot-ink lg:hidden">
        Esta zona está pensada para pantalla grande.
      </p>

      <div className="mx-auto flex max-w-screen-2xl">
        <nav
          aria-label="Secciones de administración"
          className="sticky top-0 flex h-dvh w-60 shrink-0 flex-col gap-1 border-r border-line bg-surface p-4"
        >
          <p className="mb-4 px-2 text-lg font-extrabold tracking-[0.1em] text-ink">
            {brand.wordmark}
            <span aria-hidden="true" className="ml-0.5 text-accent">
              .
            </span>
            <span className="ml-2 align-middle text-measure font-semibold tracking-normal text-ink-muted">
              admin
            </span>
          </p>

          {SECCIONES.map((seccion) => (
            <NavLink
              key={seccion.ruta}
              to={seccion.ruta}
              className={({ isActive }) =>
                `flex min-h-tap items-center gap-3 rounded-block px-3 text-item font-semibold ${
                  isActive ? 'bg-slot text-slot-ink' : 'text-ink hover:bg-bg'
                }`
              }
            >
              <Icon name={seccion.icono} size={18} />
              {seccion.titulo}
            </NavLink>
          ))}

          <div className="mt-auto flex flex-col gap-1 border-t border-line pt-3">
            <a
              href="/"
              className="flex min-h-tap items-center gap-3 rounded-block px-3 text-measure font-semibold text-ink-muted hover:bg-bg"
            >
              <Icon name="hoy" size={18} />
              Ir a la app
            </a>
            <button
              type="button"
              onClick={() => void signOut()}
              className="flex min-h-tap items-center gap-3 rounded-block px-3 text-left text-measure font-semibold text-ink-muted hover:bg-bg"
            >
              <Icon name="salir" size={18} />
              Cerrar sesión
            </button>
          </div>
        </nav>

        <main className="flex-1 p-6">
          <Routes>
            <Route index element={<Navigate to="hogares" replace />} />
            {SECCIONES.map((seccion) => (
              <Route
                key={seccion.ruta}
                path={seccion.ruta}
                element={seccion.vista ?? <Hueco seccion={seccion} />}
              />
            ))}
            {/* El constructor va aparte: no es una sección de la barra, se entra desde un hogar. */}
            <Route path="hogares/:householdId/dieta" element={<BuilderView />} />
            <Route path="hogares/:householdId" element={<HouseholdDetail />} />
            <Route path="*" element={<Navigate to="hogares" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
