/**
 * Zona de la nutricionista. Se carga con `lazy()` desde el router: el código de aquí **no
 * viaja en el paquete que se descarga el móvil de un cliente**, que es lo que pide la
 * decisión 10 de docs/PLAN.md.
 *
 * Está pensada para escritorio (≥1024 px), al revés que la app del cliente. Usa los mismos
 * tokens de color y tipografía, así que hereda los dos temas sin nada extra.
 *
 * De momento son los huecos con su estado vacío: el contenido llega en las fases 15 a 17.
 */
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { brand } from '../../config/brand';
import { Icon, type IconName } from '../../components/Icon';
import { signOut } from '../../data/auth';

type Seccion = {
  ruta: string;
  titulo: string;
  icono: IconName;
  /** Qué irá aquí y en qué fase, para que el hueco no parezca un error. */
  pendiente: string;
};

const SECCIONES: Seccion[] = [
  {
    ruta: 'hogares',
    titulo: 'Hogares',
    icono: 'perfil',
    pendiente:
      'La lista de hogares con sus personas, la dieta vigente y la adherencia de la semana. Fase 17.',
  },
  {
    ruta: 'biblioteca',
    titulo: 'Biblioteca',
    icono: 'receta',
    pendiente:
      'Los bloques prehechos con su ración base, para montar dietas sin escribirlo todo. Fase 15.',
  },
  {
    ruta: 'alimentos',
    titulo: 'Alimentos',
    icono: 'compra',
    pendiente: 'El catálogo: nombre, sección del súper, unidad y si admite batch cooking. Fase 15.',
  },
  {
    ruta: 'equivalencias',
    titulo: 'Equivalencias',
    icono: 'libre',
    pendiente:
      'Los grupos de intercambio y su factor, que es lo que permite sustituir un alimento por otro. Fase 15.',
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
              <Route key={seccion.ruta} path={seccion.ruta} element={<Hueco seccion={seccion} />} />
            ))}
            <Route path="*" element={<Navigate to="hogares" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
