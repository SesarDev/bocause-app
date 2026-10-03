import { useEffect, useState } from 'react';

/**
 * Si hay red o no. La app funciona sin cobertura (la caché está en IndexedDB y las
 * mutaciones se encolan), pero conviene decirlo: en el súper el móvil pierde señal y si no
 * avisas, parece que la app se ha quedado colgada.
 */
export function useOnline(): boolean {
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  return online;
}
