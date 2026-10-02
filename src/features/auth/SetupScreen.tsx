/**
 * Falta la configuración de Supabase. Es mejor decirlo que arrancar y fallar en la primera
 * consulta con un error de red que no explica nada.
 */
export function SetupScreen() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-screen-sm flex-col justify-center px-6">
      <section className="rounded-day bg-surface p-6">
        <h1 className="text-dish font-bold text-ink">Falta configurar Supabase</h1>
        <p className="mt-2 text-item text-ink-muted">
          La app no encuentra las variables de entorno. Copia <code>.env.example</code> a{' '}
          <code>.env.local</code>, rellena las dos variables y reinicia el servidor de desarrollo.
        </p>
        <pre className="mt-4 overflow-x-auto rounded-block bg-bg p-3 text-measure text-ink">
          {`VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<clave pública>`}
        </pre>
        <p className="mt-3 text-measure text-ink-muted">
          Están en Supabase → tu proyecto → Project Settings → API. Vite solo lee{' '}
          <code>.env.local</code> al arrancar, así que hay que parar y volver a lanzar{' '}
          <code>npm run dev</code>.
        </p>
      </section>
    </main>
  );
}
