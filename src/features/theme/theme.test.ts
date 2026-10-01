import { describe, expect, it } from 'vitest';
import { isTheme, nextTheme, resolveTheme, themeAttribute } from './theme';

describe('resolveTheme', () => {
  it('en "system" sigue la preferencia del sistema', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });

  it('una preferencia explícita ignora al sistema', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });
});

describe('themeAttribute', () => {
  it('no pone atributo en "system" para que manden las media queries de tokens.css', () => {
    expect(themeAttribute('system')).toBeNull();
  });

  it('devuelve el tema en los modos explícitos', () => {
    expect(themeAttribute('light')).toBe('light');
    expect(themeAttribute('dark')).toBe('dark');
  });
});

describe('nextTheme', () => {
  it('cicla sistema → claro → oscuro → sistema', () => {
    expect(nextTheme('system')).toBe('light');
    expect(nextTheme('light')).toBe('dark');
    expect(nextTheme('dark')).toBe('system');
  });
});

describe('isTheme', () => {
  it('acepta los tres temas válidos', () => {
    expect(isTheme('system')).toBe(true);
    expect(isTheme('light')).toBe(true);
    expect(isTheme('dark')).toBe(true);
  });

  it('rechaza cualquier otra cosa guardada en localStorage', () => {
    expect(isTheme('azul')).toBe(false);
    expect(isTheme(null)).toBe(false);
    expect(isTheme(undefined)).toBe(false);
    expect(isTheme(1)).toBe(false);
  });
});
