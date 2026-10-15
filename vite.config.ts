import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import type { Plugin } from 'vite';
// defineConfig de vitest/config (no de vite) para que el bloque `test` tenga tipos.
import { defineConfig } from 'vitest/config';
// Extensión explícita: este proyecto de TypeScript usa resolución `nodenext`, igual que
// los scripts de Node. Vite resuelve el .ts sin problema al empaquetar la configuración.
import { brand } from './src/config/brand.ts';

/**
 * Rellena en index.html los marcadores de marca. Así el nombre y la descripción salen del
 * mismo sitio que el manifest y la cabecera, y clonar la app no obliga a buscar cadenas
 * sueltas por el HTML.
 */
function brandHtml(): Plugin {
  return {
    name: 'bocause-brand-html',
    transformIndexHtml(html) {
      return html
        .replaceAll('%APP_NAME%', brand.appName)
        .replaceAll('%APP_DESCRIPTION%', brand.description)
        .replaceAll('%APP_LANG%', brand.lang)
        .replaceAll('%FAVICON%', brand.icons.favicon)
        .replaceAll('%APPLE_TOUCH_ICON%', brand.icons.appleTouch);
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    brandHtml(),
    VitePWA({
      // injectManifest: el service worker es nuestro (src/sw.ts) para poder manejar
      // Web Push en la fase 15. generateSW no lo permitiría.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
      },
      // Todo lo identificable sale de src/config/brand.ts (ver docs/CLONAR.md).
      manifest: {
        name: brand.appName,
        short_name: brand.shortName,
        description: brand.description,
        lang: brand.lang,
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: brand.colors.splash,
        theme_color: brand.colors.splash,
        categories: ['health', 'food', 'lifestyle'],
        icons: [
          { src: brand.icons.pwa192, sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: brand.icons.pwa512, sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: brand.icons.maskable192,
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: brand.icons.maskable512,
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      devOptions: {
        // Permite probar instalación y service worker con `npm run dev`.
        enabled: true,
        type: 'module',
        navigateFallback: 'index.html',
      },
    }),
  ],
  test: {
    // La lógica pura de src/domain no necesita DOM.
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      // La exigencia de cobertura es para el dominio, que es donde vive la flexibilidad
      // del plan. La UI se prueba con Playwright en la fase 10.
      include: ['src/domain/**/*.ts'],
      exclude: ['src/domain/**/*.test.ts', 'src/domain/__fixtures__/**'],
      thresholds: { lines: 90, functions: 90, branches: 90, statements: 90 },
    },
  },
});
