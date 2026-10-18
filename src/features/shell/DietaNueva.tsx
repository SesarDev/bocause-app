/**
 * Aviso de que la nutricionista ha publicado una dieta nueva.
 *
 * Sale una vez por móvil y por versión, y se quita al cerrarlo o al ir a ver los cambios.
 * Sin esto, la dieta cambia de un día para otro sin que nadie diga nada: el plato del
 * martes es otro y no sabes si te has confundido tú.
 *
 * Qué versión se ha visto ya se guarda en `localStorage`, no en IndexedDB ni en la base de
 * datos, y es a propósito: no es un dato de la dieta, es "este móvil ya lo ha enseñado".
 * Si el almacenamiento está bloqueado, el peor caso es que el aviso vuelva a salir.
 */
import { useEffect, useState } from 'react';
import { shortDateOf } from '../../domain/format';
import { storedUserId } from '../../data/supabase';
import { usePlanMeta } from '../../data/queries';
import { useUiStore } from '../../stores/ui';

function clave(): string | null {
  const userId = storedUserId();
  return userId === null ? null : `bocause:dieta-vista:${userId}`;
}

function leer(): string | null {
  try {
    const k = clave();
    return k === null ? null : localStorage.getItem(k);
  } catch {
    return null;
  }
}

function anotar(version: string): void {
  try {
    const k = clave();
    if (k !== null) localStorage.setItem(k, version);
  } catch {
    // Modo privado: el aviso volverá a salir, que es mejor que romper la pantalla.
  }
}

export function DietaNueva() {
  const meta = usePlanMeta();
  const verHistorial = useUiStore((state) => state.verHistorial);

  // La versión que este móvil ya había visto **al abrir la app**. Estado sin setter a
  // propósito: se lee una vez y no cambia en toda la sesión. Si se releyera en cada render,
  // anotar la versión actual haría desaparecer el aviso solo, sin que nadie lo cerrase.
  const [visto] = useState<string | null>(() => leer());
  const [cerrado, setCerrado] = useState(false);

  const actual = meta.data == null ? null : String(meta.data.version);

  // La primera vez que alguien abre la app no hay nada que avisar: se anota en silencio.
  // Decirle "tu dieta se actualizó" a quien acaba de entrar por primera vez es mentirle.
  useEffect(() => {
    if (actual !== null && visto === null) anotar(actual);
  }, [actual, visto]);

  const publicada = meta.data?.publishedAt;
  if (actual === null || publicada === undefined) return null;
  if (cerrado || visto === null || visto === actual) return null;

  const cerrar = () => {
    anotar(actual);
    setCerrado(true);
  };

  return (
    <div
      role="status"
      className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-day bg-free p-3"
    >
      <p className="flex-1 text-item text-ink">
        Tu nutricionista actualizó tu dieta el{' '}
        <strong className="font-semibold">{shortDateOf(publicada.slice(0, 10))}</strong>.
      </p>
      <button
        type="button"
        onClick={() => {
          cerrar();
          verHistorial();
        }}
        className="min-h-tap rounded-chip bg-slot px-3 text-measure font-semibold text-slot-ink"
      >
        Ver qué cambió
      </button>
      <button
        type="button"
        onClick={cerrar}
        className="min-h-tap text-measure font-semibold text-ink-muted underline"
      >
        Vale
      </button>
    </div>
  );
}
