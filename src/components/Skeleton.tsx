/**
 * Esqueletos de carga. Enseñar la forma de lo que viene se nota menos brusco que un texto
 * de "cargando", sobre todo al abrir la app con mala cobertura.
 *
 * `animate-pulse` ya respeta `prefers-reduced-motion` por los estilos globales de
 * tokens.css, que anulan las animaciones.
 */
function Bar({ className = '' }: { className?: string }) {
  return <span className={`block rounded-chip bg-line animate-pulse ${className}`} />;
}

/** Una tarjeta de día con sus franjas, con la misma silueta que la de verdad. */
export function DaySkeleton() {
  return (
    <div aria-hidden="true" className="rounded-day bg-surface p-4">
      <Bar className="h-5 w-32" />
      <div className="mt-3 flex flex-col gap-2">
        {[0, 1, 2].map((row) => (
          <div key={row} className="flex gap-2">
            <Bar className="h-24 w-[5.5rem] shrink-0 rounded-block" />
            <div className="flex-1 rounded-block bg-bg p-3">
              <Bar className="h-4 w-3/4" />
              <Bar className="mt-2 h-4 w-1/2" />
              <Bar className="mt-2 h-4 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div aria-hidden="true" className="rounded-day bg-surface p-4">
      <Bar className="h-3 w-24" />
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="mt-3 flex items-center gap-3">
          <Bar className="size-6 shrink-0 rounded-[0.4rem]" />
          <Bar className="h-4 flex-1" />
        </div>
      ))}
    </div>
  );
}

/** Texto para lectores de pantalla mientras se carga. */
export function LoadingAnnounce({ children }: { children: string }) {
  return (
    <p role="status" aria-live="polite" className="sr-only">
      {children}
    </p>
  );
}
