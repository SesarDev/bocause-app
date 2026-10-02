import { useState } from 'react';
import { Icon, type IconName } from '../../components/Icon';
import { Sheet } from '../../components/Sheet';
import { useProfiles } from '../../data/queries';
import { useUiStore, type ProfileId } from '../../stores/ui';

/**
 * Selector de perfil: Cristina, Andrés o Casa. Las dos pueden VER lo de la otra
 * (CLAUDE.md, regla 7); quién puede editar qué lo decide la base de datos, no esta pantalla.
 */
export function ProfileSelector() {
  const [open, setOpen] = useState(false);
  const activeProfile = useUiStore((state) => state.activeProfile);
  const setActiveProfile = useUiStore((state) => state.setActiveProfile);
  const { data: profiles } = useProfiles();

  const options: { id: ProfileId; label: string; icon: IconName; hint?: string }[] = [
    ...(profiles ?? []).map((profile) => ({
      id: profile.slug as ProfileId,
      label: profile.displayName,
      icon: 'perfil' as IconName,
    })),
    { id: 'casa', label: 'Casa', icon: 'casa', hint: 'Solo comida y cena, con las dos raciones' },
  ];

  const current = options.find((option) => option.id === activeProfile);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="flex h-9 items-center gap-1.5 rounded-chip border border-line px-3 text-sm font-semibold text-ink"
      >
        <Icon name={current?.icon ?? 'perfil'} size={18} />
        {current?.label ?? 'Perfil'}
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title="Ver el plan de">
        <ul className="flex flex-col gap-2 pb-2">
          {options.map((option) => {
            const selected = option.id === activeProfile;
            return (
              <li key={option.id}>
                <button
                  type="button"
                  onClick={() => {
                    setActiveProfile(option.id);
                    setOpen(false);
                  }}
                  aria-current={selected ? 'true' : undefined}
                  className={`flex min-h-tap w-full items-center gap-3 rounded-block border px-4 py-3 text-left ${
                    selected ? 'border-accent bg-accent/10' : 'border-line'
                  }`}
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-chip bg-slot text-slot-ink">
                    <Icon name={option.icon} size={20} />
                  </span>
                  <span className="flex-1">
                    <span className="block text-item font-semibold text-ink">{option.label}</span>
                    {option.hint && (
                      <span className="block text-measure text-ink-muted">{option.hint}</span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </Sheet>
    </>
  );
}
