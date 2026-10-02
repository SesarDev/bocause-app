import { useState, type FormEvent } from 'react';
import { signInWithMagicLink } from '../../data/auth';

/** Entrada por magic link: sin contraseñas que recordar en el móvil. */
export function LoginScreen() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setStatus('sending');
    try {
      await signInWithMagicLink(email);
      setStatus('sent');
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'No se pudo enviar el enlace');
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-screen-sm flex-col justify-center px-6">
      <h1 className="text-center text-lg font-extrabold tracking-[0.1em] text-ink">
        BOCAUSE
        <span aria-hidden="true" className="ml-0.5 text-accent">
          .
        </span>
      </h1>

      {status === 'sent' ? (
        <div className="mt-8 rounded-day bg-surface p-6 text-center">
          <h2 className="text-dish font-bold text-ink">Mira tu correo</h2>
          <p className="mt-2 text-item text-ink-muted">
            Hemos enviado un enlace a <strong className="text-ink">{email}</strong>. Ábrelo en este
            mismo móvil y entrarás sin contraseña.
          </p>
          <button
            type="button"
            onClick={() => setStatus('idle')}
            className="mt-4 min-h-tap text-item font-semibold text-ink underline"
          >
            Usar otro correo
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-8 rounded-day bg-surface p-6">
          <h2 className="text-dish font-bold text-ink">Entrar</h2>
          <p className="mt-2 text-item text-ink-muted">
            Escribe tu correo y te enviamos un enlace para entrar.
          </p>

          <label htmlFor="email" className="mt-5 block text-measure font-semibold text-ink">
            Correo
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-1 min-h-tap w-full rounded-block border border-line bg-bg px-3 text-item text-ink"
          />

          <button
            type="submit"
            disabled={status === 'sending'}
            className="mt-5 min-h-tap w-full rounded-chip bg-accent px-4 text-item font-bold text-accent-ink disabled:opacity-60"
          >
            {status === 'sending' ? 'Enviando…' : 'Enviarme el enlace'}
          </button>

          {status === 'error' && (
            <p role="alert" className="mt-3 text-measure text-danger">
              {message}
            </p>
          )}
        </form>
      )}
    </main>
  );
}
