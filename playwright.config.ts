import { defineConfig, devices } from '@playwright/test';

/**
 * Pruebas de los flujos críticos (PLAN.md, fase 10).
 *
 * OJO: se ejecutan contra el proyecto REAL de Supabase, porque no hay uno de pruebas. Cada
 * test deshace lo que toca, pero no están pensadas para correr en cada commit: se lanzan a
 * mano con `npm run test:e2e`. Por eso no van dentro de `npm test`.
 *
 * Sin SUPABASE_SERVICE_ROLE_KEY en .env.local, se saltan solas.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  timeout: 60_000,
  use: {
    baseURL: 'http://localhost:5173',
    // El móvil es el objetivo real: se prueba a 390x844 (CLAUDE.md revisa en 360x780).
    ...devices['Pixel 7'],
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
