import { Icon, type IconName } from '../../components/Icon';
import { useUiStore, type TabId } from '../../stores/ui';

const TABS: readonly { id: TabId; label: string; icon: IconName }[] = [
  { id: 'semana', label: 'Semana', icon: 'semana' },
  { id: 'hoy', label: 'Hoy', icon: 'hoy' },
  { id: 'compra', label: 'Compra', icon: 'compra' },
  { id: 'mas', label: 'Más', icon: 'mas' },
];

export function BottomNav() {
  const tab = useUiStore((state) => state.tab);
  const setTab = useUiStore((state) => state.setTab);

  return (
    <nav
      aria-label="Secciones"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex max-w-screen-sm">
        {TABS.map((item) => {
          const active = item.id === tab;
          return (
            <li key={item.id} className="flex-1">
              <button
                type="button"
                onClick={() => setTab(item.id)}
                aria-current={active ? 'page' : undefined}
                className={`relative flex min-h-tap w-full flex-col items-center justify-center gap-1 py-2 transition-colors ${
                  active ? 'text-ink' : 'text-ink-muted'
                }`}
              >
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute top-0 h-0.5 w-10 rounded-full bg-accent"
                  />
                )}
                <Icon name={item.icon} size={22} />
                <span className="text-xs font-semibold">{item.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
