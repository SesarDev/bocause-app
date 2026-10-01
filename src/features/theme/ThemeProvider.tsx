import { useEffect } from 'react';
import { useUiStore } from '../../stores/ui';
import { resolveTheme, THEME_COLOR, themeAttribute } from './theme';

const DARK_QUERY = '(prefers-color-scheme: dark)';

/**
 * Aplica la preferencia de tema al documento: data-theme en <html> (que es lo que leen las
 * reglas de tokens.css) y <meta name="theme-color"> para la barra de estado de Android.
 *
 * El primer pintado ya viene correcto gracias al script de index.html; este efecto se
 * encarga de los cambios posteriores, incluido que el sistema cambie de tema mientras la
 * app está abierta y la preferencia sea "system".
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useUiStore((state) => state.theme);

  useEffect(() => {
    const root = document.documentElement;
    const attribute = themeAttribute(theme);
    if (attribute === null) root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', attribute);

    const media = window.matchMedia(DARK_QUERY);
    const applyThemeColor = () => {
      const resolved = resolveTheme(theme, media.matches);
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', THEME_COLOR[resolved]);
    };

    applyThemeColor();
    media.addEventListener('change', applyThemeColor);
    return () => media.removeEventListener('change', applyThemeColor);
  }, [theme]);

  return children;
}
