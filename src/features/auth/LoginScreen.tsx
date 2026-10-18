import { useState, type FormEvent } from 'react';
import { brand } from '../../config/brand';
import { signIn } from '../../data/auth';

/**
 * Entrar con usuario y contraseña.
 *
 * El usuario lo da la nutricionista, igual que el perfil: aquí no hay registro ni hay nada
 * que elegir. Antes se entraba por enlace de correo, pero eso obligaba a tener un buzón y a
 * salir de la app para volver a entrar, y además dejaba la puerta abierta a que cualquiera
 * ocupase un perfil libre.
 */
export function LoginScreen() {
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [estado, setEstado] = useState<'idle' | 'entrando' | 'error'>('idle');

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setEstado('entrando');
    try {
      await signIn(usuario, password);
      // No hace falta hacer nada más: `onAuthStateChange` cambia la pantalla.
    } catch {
      // Sin detalles: decir "ese usuario no existe" le confirmaría a un extraño cuáles sí.
      setEstado('error');
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-screen-sm flex-col justify-center px-6">
      <h1 className="text-center text-lg font-extrabold tracking-[0.1em] text-ink">
        {brand.wordmark}
        <span aria-hidden="true" className="ml-0.5 text-accent">
          .
        </span>
      </h1>

      <form onSubmit={handleSubmit} className="mt-8 rounded-day bg-surface p-6">
        <h2 className="text-dish font-bold text-ink">Entrar</h2>
        <p className="mt-2 text-item text-ink-muted">Con tu usuario y tu contraseña.</p>

        <label htmlFor="usuario" className="mt-5 block text-measure font-semibold text-ink">
          Usuario
        </label>
        <input
          id="usuario"
          required
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={usuario}
          onChange={(event) => setUsuario(event.target.value)}
          className="mt-1 min-h-tap w-full rounded-block border border-line bg-bg px-3 text-item text-ink"
        />

        <label htmlFor="password" className="mt-4 block text-measure font-semibold text-ink">
          Contraseña
        </label>
        <input
          id="password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-1 min-h-tap w-full rounded-block border border-line bg-bg px-3 text-item text-ink"
        />

        <button
          type="submit"
          disabled={estado === 'entrando'}
          className="mt-5 min-h-tap w-full rounded-chip bg-accent px-4 text-item font-bold text-accent-ink disabled:opacity-60"
        >
          {estado === 'entrando' ? 'Entrando…' : 'Entrar'}
        </button>

        {estado === 'error' && (
          <p role="alert" className="mt-3 text-measure text-danger">
            Usuario o contraseña incorrectos.
          </p>
        )}

        <p className="mt-4 text-measure text-ink-muted">
          La sesión se queda abierta en este móvil. Si se te ha olvidado la contraseña, pídesela a
          tu nutricionista: no se puede recuperar por correo.
        </p>
      </form>
    </main>
  );
}
