// Lógica pura del tema. Sin React y sin acceso directo al DOM, para poder testearla.
// No vive en src/domain/ porque no es dominio nutricional, sino preferencia de interfaz.

export type Theme = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

/** Clave de localStorage. OJO: el script antiparpadeo de index.html la repite literalmente. */
export const THEME_STORAGE_KEY = 'bocause.theme';

/** Color de la barra de estado de Android: el fondo real de la página en cada tema. */
export const THEME_COLOR: Record<ResolvedTheme, string> = {
  light: '#f7fafa',
  dark: '#0b131d',
};

const THEMES: readonly Theme[] = ['system', 'light', 'dark'];

export function isTheme(value: unknown): value is Theme {
  return typeof value === 'string' && (THEMES as readonly string[]).includes(value);
}

/** Traduce la preferencia a un tema concreto usando lo que dice el sistema. */
export function resolveTheme(theme: Theme, systemPrefersDark: boolean): ResolvedTheme {
  if (theme === 'system') return systemPrefersDark ? 'dark' : 'light';
  return theme;
}

/**
 * Valor del atributo data-theme en <html>. En "system" devuelve null (sin atributo),
 * que es justo lo que esperan las reglas de tokens.css para seguir al sistema.
 */
export function themeAttribute(theme: Theme): ResolvedTheme | null {
  return theme === 'system' ? null : theme;
}

/** Orden del botón de tema: sistema → claro → oscuro → sistema. */
export function nextTheme(theme: Theme): Theme {
  const index = THEMES.indexOf(theme);
  return THEMES[(index + 1) % THEMES.length] ?? 'system';
}

export const THEME_LABEL: Record<Theme, string> = {
  system: 'Tema del sistema',
  light: 'Tema claro',
  dark: 'Tema oscuro',
};
