import { useEffect, useRef } from 'react';

/**
 * Hoja inferior. Es el patrón de la app para todo lo que se abre encima: selector de
 * perfil ahora, intercambio y editor más adelante.
 *
 * Cierra con Escape y tocando fuera, devuelve el foco a donde estaba y respeta
 * `prefers-reduced-motion` (la animación vive en tokens.css).
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;

    openerRef.current = document.activeElement;
    panelRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);

    // Mientras la hoja está abierta, el fondo no scrollea.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      (openerRef.current as HTMLElement | null)?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center">
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onClose}
        className="absolute inset-0 bg-brand-navy/50"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="relative w-full max-w-screen-sm rounded-t-day bg-surface pb-[env(safe-area-inset-bottom)] shadow-lg outline-none motion-safe:animate-[sheet-in_180ms_ease-out]"
      >
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <span
            aria-hidden="true"
            className="absolute left-1/2 top-1.5 h-1 w-10 -translate-x-1/2 rounded-full bg-line"
          />
          <h2 className="mr-auto text-dish font-bold text-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="min-h-tap px-2 text-item font-semibold text-ink-muted"
          >
            Cerrar
          </button>
        </div>
        <div className="px-4 py-3">{children}</div>
      </div>
    </div>
  );
}
