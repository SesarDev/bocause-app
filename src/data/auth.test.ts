/**
 * El usuario que escribe una persona y el correo con el que Supabase la conoce.
 *
 * Es una traducción de una línea, pero es la que decide si alguien entra o no: si cambia,
 * las cuentas creadas antes dejan de encontrar su contraseña.
 */
import { describe, expect, it } from 'vitest';
import { emailForUser } from './auth';

describe('emailForUser', () => {
  it('le pone el dominio al usuario', () => {
    expect(emailForUser('marta', 'bocause.local')).toBe('marta@bocause.local');
  });

  it('no toca lo que ya es un correo', () => {
    // Las cuentas de antes de la 0010 tienen el correo de verdad de su dueño: pegarles el
    // dominio las dejaría fuera de su propia dieta.
    expect(emailForUser('andres@hotmail.com', 'bocause.local')).toBe('andres@hotmail.com');
  });

  it('ignora espacios y mayúsculas, que en un móvil salen solas', () => {
    expect(emailForUser('  Marta ', 'bocause.local')).toBe('marta@bocause.local');
    expect(emailForUser('NUTRI1', 'bocause.local')).toBe('nutri1@bocause.local');
  });
});
