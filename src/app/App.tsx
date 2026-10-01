import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { persistOptions, queryClient } from '../data/queryClient';
import { ThemeProvider } from '../features/theme/ThemeProvider';
import { AppShell } from '../features/shell/AppShell';

export function App() {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={persistOptions}
      // Al rehidratar la caché se reanudan las mutaciones que quedaron en pausa sin red.
      onSuccess={() => {
        void queryClient.resumePausedMutations();
      }}
    >
      <ThemeProvider>
        <AppShell />
      </ThemeProvider>
    </PersistQueryClientProvider>
  );
}
