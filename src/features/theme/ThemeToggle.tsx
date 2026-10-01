import { Icon, type IconName } from '../../components/Icon';
import { useUiStore } from '../../stores/ui';
import { nextTheme, THEME_LABEL, type Theme } from './theme';

const ICON: Record<Theme, IconName> = {
  system: 'sistema',
  light: 'claro',
  dark: 'oscuro',
};

export function ThemeToggle() {
  const theme = useUiStore((state) => state.theme);
  const setTheme = useUiStore((state) => state.setTheme);
  const upcoming = nextTheme(theme);

  return (
    <button
      type="button"
      onClick={() => setTheme(upcoming)}
      className="grid size-tap place-items-center rounded-chip text-ink transition-colors hover:bg-accent/15"
      aria-label={`${THEME_LABEL[theme]}. Cambiar a: ${THEME_LABEL[upcoming].toLowerCase()}`}
      title={THEME_LABEL[theme]}
    >
      <Icon name={ICON[theme]} size={22} />
    </button>
  );
}
