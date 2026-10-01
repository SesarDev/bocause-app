import { Icon, type IconName } from '../../components/Icon';
import { useUiStore, type TabId } from '../../stores/ui';
import { AppHeader } from './AppHeader';
import { BottomNav } from './BottomNav';

/** Estados vacíos honestos: cada pestaña dice qué traerá y en qué fase. */
const PLACEHOLDERS: Record<TabId, { icon: IconName; title: string; body: string }> = {
  semana: {
    icon: 'semana',
    title: 'Vista Semana',
    body: 'Los siete días del plan con sus franjas, una tarjeta por día. Llega en la fase 5, cuando ya haya datos reales.',
  },
  hoy: {
    icon: 'hoy',
    title: 'Vista Hoy',
    body: 'El día de hoy con los checks por alimento y los contadores de agua, aceite y comodín proteico. Fases 5 y 6.',
  },
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
        <section className="mt-6 rounded-day bg-surface p-6 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-chip bg-slot text-slot-ink">
            <Icon name={placeholder.icon} size={24} />
          </span>
          <h1 className="mt-4 text-dish font-bold text-ink">{placeholder.title}</h1>
          <p className="mt-2 text-item text-ink-muted">{placeholder.body}</p>
        </section>

        <p className="mt-6 text-center text-measure text-ink-muted">
          Andamiaje de la fase 1: tema, PWA instalable y navegación.
        </p>
      </main>

      <BottomNav />
    </div>
  );
}
