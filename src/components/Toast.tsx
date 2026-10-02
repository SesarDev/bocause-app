import { useEffect } from 'react';

export type ToastState = {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

/**
 * Aviso breve con acción. Se usa sobre todo para "Intercambiado · Deshacer": seis segundos
 * es tiempo de sobra para rectificar y poco para estorbar.
 *
 * Se anuncia con role="status" para que un lector de pantalla lo lea sin robar el foco.
 */
export function Toast({
  toast,
  onClose,
  duration = 6000,
}: {
  toast: ToastState | null;
  onClose: () => void;
  duration?: number;
}) {
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(onClose, duration);
    return () => window.clearTimeout(timer);
  }, [toast, onClose, duration]);

  if (!toast) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 flex justify-center px-4"
    >
      <div className="flex w-full max-w-screen-sm items-center gap-3 rounded-block bg-slot px-4 py-3 text-slot-ink shadow-lg motion-safe:animate-[sheet-in_160ms_ease-out]">
        <p className="flex-1 text-item font-semibold">{toast.message}</p>
        {toast.actionLabel && (
          <button
            type="button"
            onClick={() => {
              toast.onAction?.();
              onClose();
            }}
            className="min-h-tap rounded-chip px-3 text-item font-bold text-accent underline"
          >
            {toast.actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}
