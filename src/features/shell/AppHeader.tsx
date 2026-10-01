import { Icon } from '../../components/Icon';
import { ThemeToggle } from '../theme/ThemeToggle';
import { useUiStore } from '../../stores/ui';

const PROFILE_LABEL: Record<string, string> = {
  cristina: 'Cristina',
  andres: 'Andrés',
  casa: 'Casa',
};

export function AppHeader() {
  const activeProfile = useUiStore((state) => state.activeProfile);

  return (
    <header className="fixed inset-x-0 top-0 z-20 border-b border-line bg-surface pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex h-14 max-w-screen-sm items-center gap-2 px-4">
        <p className="mr-auto text-lg font-extrabold tracking-[0.1em] text-ink">
          BOCAUSE
          <span aria-hidden="true" className="ml-0.5 text-accent">
            .
          </span>
        </p>

        {/* Selector de perfil: vacío hasta que la fase 4 traiga los perfiles de Supabase. */}
        <button
          type="button"
          disabled
          aria-disabled="true"
          title="Los perfiles se activan al conectar Supabase"
          className="flex h-9 items-center gap-1.5 rounded-chip border border-line px-3 text-sm font-semibold text-ink-muted"
        >
          <Icon name="perfil" size={18} />
          {activeProfile === null ? 'Sin perfil' : (PROFILE_LABEL[activeProfile] ?? 'Sin perfil')}
        </button>

        <ThemeToggle />
      </div>
    </header>
  );
}
