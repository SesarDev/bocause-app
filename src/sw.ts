// Service worker propio (estrategia injectManifest). De momento solo precachea el shell;
// el manejo de push y notificationclick llega en la fase 15.
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import type { PrecacheEntry } from 'workbox-precaching';

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: (PrecacheEntry | string)[];
};

self.addEventListener('install', () => {
  // Activa la versión nueva sin esperar a que se cierren las pestañas abiertas.
  void self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);
