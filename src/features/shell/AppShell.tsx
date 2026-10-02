import { Icon, type IconName } from '../../components/Icon';
import { useUiStore, type TabId } from '../../stores/ui';
import { WeekView } from '../week/WeekView';
import { AppHeader } from './AppHeader';
import { BottomNav } from './BottomNav';

/** Lo que todavía no existe dice en qué fase llega, en vez de quedarse en blanco. */
const PLACEHOLDERS: Partial<Record<TabId, { icon: IconName; title: string; body: string }>> = {
  compra: {
    icon: 'compra',
    title: 'Lista de la compra',
    body: 'La compra de los dos sumada y agrupada por sección del súper. Fase 9.',
  },
  mas: {
    icon: 'mas',
    title: 'Más',
    body: 'Entrenos, recetas, recomendaciones del plan y ajustes de notificaciones. Fases 11 y 15.',
  },
};

export function AppShell() {
  const tab = useUiStore((state) => state.tab);
  const placeholder = PLACEHOLDERS[tab];

  return (
    <div className="min-h-dvh bg-bg">
      <AppHeader />

      <main className="mx-auto max-w-screen-sm px-4 pt-[calc(3.5rem+env(safe-area-inset-top))] pb-[calc(5rem+env(safe-area-inset-bottom))]">
        {tab === 'semana' && <WeekView />}
        {tab === 'hoy' && <WeekView onlyToday />}

        {placeholder && (
          <section className="mt-6 rounded-day bg-surface p-6 text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-chip bg-slot text-slot-ink">
              <Icon name={placeholder.icon} size={24} />
            </span>
            <h1 className="mt-4 text-dish font-bold text-ink">{placeholder.title}</h1>
            <p className="mt-2 text-item text-ink-muted">{placeholder.body}</p>
          </section>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
