import { Icon } from '../../components/Icon';
import {
  dayNameOf,
  formatPortion,
  formatTotal,
  shortDateOf,
  totalForProfiles,
} from '../../domain/format';
import type { ResolvedWeek } from '../../domain/resolve';
import type { FoodItem, SlotKey } from '../../domain/schema';
import { isAccentDay, SLOT_ICON, SLOT_LABEL } from './slots';

const SHARED: SlotKey[] = ['comida', 'cena'];

type Person = { profileId: string; displayName: string };

/**
 * Vista "Casa": solo comida y cena, con las dos raciones una al lado de otra y la suma
 * para cocinar. Es la vista de quien está delante de la sartén, no la de quien come.
 */
function CookingItem({ item, people }: { item: FoodItem; people: Person[] }) {
  const eaters = people.filter((person) => item.portions[person.profileId]);
  if (eaters.length === 0) return null;

  const total = totalForProfiles(
    item,
    eaters.map((person) => person.profileId),
  );

  return (
    <li className="border-t border-line/70 py-2 first:border-t-0">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-item font-medium text-ink">{item.label}</span>
        {total && eaters.length > 1 && (
          <span className="rounded-chip bg-accent px-2 py-0.5 text-measure font-bold text-accent-ink">
            {formatTotal(total.amount, total.unit)} total
          </span>
        )}
      </div>

      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5">
        {eaters.map((person) => {
          const { amount, measure } = formatPortion(item.portions[person.profileId]!);
          return (
            <p key={person.profileId} className="text-measure text-ink-muted">
              <span className="font-semibold text-ink">{person.displayName}:</span>{' '}
              {amount ?? measure ?? 'al gusto'}
              {amount && measure && ` (${measure})`}
            </p>
          );
        })}
      </div>
    </li>
  );
}

export function HouseDayCard({
  day,
  weeks,
  people,
  isToday,
}: {
  day: number;
  weeks: ResolvedWeek[];
  people: Person[];
  isToday: boolean;
}) {
  // Los bloques compartidos son los mismos en las dos semanas: basta la primera que lo tenga.
  const reference = weeks[0]?.days[day];
  if (!reference) return null;

  const accent = isAccentDay(day);

  return (
    <article
      id={`dia-${day}`}
      data-day-anchor=""
      className={`rounded-day p-4 ${
        accent ? 'border-l-4 border-surface-alt-edge bg-surface-alt' : 'bg-surface'
      }`}
    >
      <header className="flex flex-wrap items-baseline gap-x-2">
        <h2 className="text-day font-extrabold tracking-[0.02em] text-ink">
          {dayNameOf(reference.date)}
        </h2>
        <p className="text-measure text-ink-muted">{shortDateOf(reference.date)}</p>
        {isToday && (
          <span className="rounded-chip bg-accent px-2 py-0.5 text-measure font-bold text-accent-ink">
            Hoy
          </span>
        )}
      </header>

      <div className="mt-3 flex flex-col gap-2">
        {SHARED.map((slotKey) => {
          // Se junta lo de las dos personas para no perder lo que solo come una.
          const slots = weeks
            .map((week) => week.days[day]?.slots.find((slot) => slot.cell.slot === slotKey))
            .filter((slot) => slot !== undefined);

          const sections = new Map<string, { title?: string; items: Map<string, FoodItem> }>();
          for (const slot of slots) {
            for (const section of slot.block?.sections ?? []) {
              const entry = sections.get(section.id) ?? {
                ...(section.title ? { title: section.title } : {}),
                items: new Map<string, FoodItem>(),
              };
              for (const item of section.items) {
                const existing = entry.items.get(item.id);
                entry.items.set(
                  item.id,
                  existing
                    ? { ...existing, portions: { ...existing.portions, ...item.portions } }
                    : item,
                );
              }
              sections.set(section.id, entry);
            }
          }

          if (sections.size === 0) return null;

          return (
            <section key={slotKey} className="flex gap-2" aria-label={SLOT_LABEL[slotKey]}>
              <p className="flex w-24 shrink-0 flex-col items-center gap-1 rounded-block bg-slot px-1.5 py-2 text-slot-ink">
                <Icon name={SLOT_ICON[slotKey]} size={20} />
                {/* text-(length:--text-slot), no text-slot: esa clase la genera también
                    --color-slot y pintaría el texto de marino sobre marino. */}
                <span className="w-full text-center text-(length:--text-slot) font-extrabold leading-tight tracking-[0.03em] break-words">
                  {SLOT_LABEL[slotKey]}
                </span>
              </p>

              <div className="min-w-0 flex-1 rounded-block bg-shared p-3">
                {[...sections.values()].map((section, index) => (
                  <div key={index} className={index > 0 ? 'mt-2' : ''}>
                    {section.title && (
                      <p className="text-dish font-bold text-ink">{section.title}</p>
                    )}
                    <ul>
                      {[...section.items.values()].map((item) => (
                        <CookingItem key={item.id} item={item} people={people} />
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </article>
  );
}
