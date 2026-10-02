import { useRef } from 'react';

/**
 * Mantener pulsado. Se usa para marcar una franja entera y para corregir el agua, que son
 * acciones que no conviene disparar sin querer con un roce.
 *
 * El clic normal sigue funcionando: solo se cancela si la pulsación larga ya ha saltado.
 */
export function useLongPress(onLongPress: () => void, onClick?: () => void, delay = 500) {
  const timer = useRef<number | null>(null);
  const fired = useRef(false);

  const clear = () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };

  return {
    onPointerDown: () => {
      fired.current = false;
      timer.current = window.setTimeout(() => {
        fired.current = true;
        onLongPress();
      }, delay);
    },
    onPointerUp: () => {
      clear();
      if (!fired.current) onClick?.();
    },
    onPointerLeave: clear,
    onPointerCancel: clear,
    // Con teclado no hay pulsación larga: Enter y espacio hacen la acción normal.
    onKeyDown: (event: React.KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onClick?.();
      }
    },
  };
}
