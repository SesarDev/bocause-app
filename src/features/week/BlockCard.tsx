import { Icon } from '../../components/Icon';
import { formatPortion } from '../../domain/format';
import type { Block, FoodItem, ProfileId, Section } from '../../domain/schema';
import { SECTION_LABEL } from './slots';

/** Un alimento: nombre, cantidad y, debajo, la medida de casa en gris. */
function ItemLine({ item, profileId }: { item: FoodItem; profileId: ProfileId }) {
  const portion = item.portions[profileId];
  if (!portion) return null;
  const { amount, measure } = formatPortion(portion);

  return (
    <li className="flex flex-wrap items-baseline gap-x-2 py-0.5">
      <span className="text-item font-medium text-ink">{item.label}</span>
      {amount && <span className="text-item font-semibold text-ink">{amount}</span>}
      {measure && <span className="text-measure text-ink-muted">({measure})</span>}
      {item.note && <span className="w-full text-measure text-ink-muted">{item.note}</span>}
    </li>
  );
}

function SectionBlock({ section, profileId }: { section: Section; profileId: ProfileId }) {
  const isSub = section.kind !== 'plato';

  return (
    <div className={isSub ? 'mt-2 border-t border-line/70 pt-2' : 'mt-2 first:mt-0'}>
      {isSub ? (
        <p className="text-measure font-extrabold tracking-[0.06em] text-ink-muted">
          {SECTION_LABEL[section.kind] ?? section.kind.toLocaleUpperCase('es-ES')}
        </p>
      ) : (
        section.title && <p className="text-dish font-bold text-ink">{section.title}</p>
      )}
      <ul className="mt-0.5">
        {section.items.map((item) => (
          <ItemLine key={item.id} item={item} profileId={profileId} />
        ))}
      </ul>
    </div>
  );
}

/**
 * El bloque de una celda: sus platos y, colgando, el pan y el postre como subsecciones
 * discretas, igual que en la tabla del PDF.
 */
export function BlockCard({
  block,
  profileId,
  shared,
}: {
  block: Block;
  profileId: ProfileId;
  shared: boolean;
}) {
  return (
    <div className={`rounded-block p-3 ${shared ? 'bg-shared' : 'bg-bg'}`}>
      {shared && (
        <p className="mb-1 flex items-center gap-1.5 text-measure font-semibold text-ink-muted">
          <Icon name="compartido" size={15} />
          Compartido
        </p>
      )}
      {block.sections.map((section) => (
        <SectionBlock key={section.id} section={section} profileId={profileId} />
      ))}
    </div>
  );
}
