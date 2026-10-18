import { useOnline } from '../../components/useOnline';
import { useUiStore } from '../../stores/ui';
import { MoreView } from '../more/MoreView';
import { ShoppingView } from '../shopping/ShoppingView';
import { WeekView } from '../week/WeekView';
import { AppHeader } from './AppHeader';
import { DietaNueva } from './DietaNueva';
import { BottomNav } from './BottomNav';

export function AppShell() {
  const tab = useUiStore((state) => state.tab);
  const online = useOnline();

  return (
    <div className="min-h-dvh bg-bg">
      <AppHeader />

      {!online && (
        <p
          role="status"
          className="fixed inset-x-0 top-[calc(3.5rem+env(safe-area-inset-top))] z-20 bg-slot px-4 py-1.5 text-center text-measure font-semibold text-slot-ink"
        >
          Sin conexión · lo que marques se guardará al volver
        </p>
      )}

      {/* Cuando aparece el aviso de offline, el contenido tiene que bajar su altura: si no,
          la barra fija le tapa la cabecera del día. */}
      <main
        className={`mx-auto max-w-screen-sm px-4 pb-[calc(5rem+env(safe-area-inset-bottom))] ${
          online
            ? 'pt-[calc(3.5rem+env(safe-area-inset-top))]'
            : 'pt-[calc(5.25rem+env(safe-area-inset-top))]'
        }`}
      >
        <DietaNueva />

        {tab === 'semana' && <WeekView />}
        {tab === 'hoy' && <WeekView onlyToday />}
        {tab === 'compra' && <ShoppingView />}
        {tab === 'mas' && <MoreView />}
      </main>

      <BottomNav />
    </div>
  );
}
