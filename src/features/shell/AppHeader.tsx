import { ThemeToggle } from '../theme/ThemeToggle';
import { ProfileSelector } from './ProfileSheet';

export function AppHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-20 border-b border-line bg-surface pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex h-14 max-w-screen-sm items-center gap-2 px-4">
        <p className="mr-auto text-lg font-extrabold tracking-[0.1em] text-ink">
          BOCAUSE
          <span aria-hidden="true" className="ml-0.5 text-accent">
            .
          </span>
        </p>

        <ProfileSelector />
        <ThemeToggle />
      </div>
    </header>
  );
}
