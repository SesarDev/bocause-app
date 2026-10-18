import { create } from 'zustand';
import { isTheme, THEME_STORAGE_KEY, type Theme } from '../features/theme/theme';

export type TabId = 'semana' | 'hoy' | 'compra' | 'mas';

/** Perfil activo. En la fase 4 pasará a ser el id real de Supabase. */
export type ProfileId = 'cristina' | 'andres' | 'casa';

type UiState = {
  theme: Theme;
  tab: TabId;
  activeProfile: ProfileId | null;
  /** Pide abrir el historial al llegar a Más. Lo usa el aviso de "tu dieta se actualizó". */
  abrirHistorial: boolean;
  setTheme: (theme: Theme) => void;
  setTab: (tab: TabId) => void;
  setActiveProfile: (profile: ProfileId | null) => void;
  verHistorial: () => void;
  historialAbierto: () => void;
};

/**
 * El tema se guarda en localStorage a mano (no con el middleware persist) porque el script
 * antiparpadeo de index.html tiene que leer el mismo valor de forma síncrona antes del
 * primer pintado, y necesita un string plano, no el JSON envuelto de persist.
 *
 * Es preferencia de interfaz, no dato de dominio: los datos de dominio van a IndexedDB.
 */
function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(stored) ? stored : 'system';
  } catch {
    // Modo privado o almacenamiento bloqueado.
    return 'system';
  }
}

function writeStoredTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Si no se puede persistir, el tema sigue funcionando en esta sesión.
  }
}

export const useUiStore = create<UiState>((set) => ({
  theme: readStoredTheme(),
  tab: 'hoy',
  activeProfile: null,
  setTheme: (theme) => {
    writeStoredTheme(theme);
    set({ theme });
  },
  setTab: (tab) => set({ tab }),
  setActiveProfile: (activeProfile) => set({ activeProfile }),
  abrirHistorial: false,
  verHistorial: () => set({ tab: 'mas', abrirHistorial: true }),
  historialAbierto: () => set({ abrirHistorial: false }),
}));
