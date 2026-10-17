import { Checkbox } from '../../components/Checkbox';
import { Icon } from '../../components/Icon';
import { formatPortion } from '../../domain/format';
import type { Block, FoodItem, ProfileId, Section, SlotKey } from '../../domain/schema';
import { replacedLabel } from '../../domain/substitute';
import { useCheckApi } from './checkContext';
import { useSubstituteApi } from './substituteContext';
import { SECTION_LABEL } from './slots';

/** Un alimento: su check, el nombre, la cantidad y la medida de casa en gris. */
function ItemLine({
  item,
  block,
  profileId,
  date,
  slot,
}: {
  item: FoodItem;
  block: Block;
  profileId: ProfileId;
  date: string;
  slot: SlotKey;
}) {
  const portion = item.portions[profileId];
  const checks = useCheckApi();
  const sustituir = useSubstituteApi();
  const sePuedeCambiar = sustituir?.canSubstitute(item) ?? false;
  const enLugarDe = replacedLabel(item);
  if (!portion) return null;

  const { amount, measure } = formatPortion(portion);
  const checked = checks?.isChecked(date, slot, item.id) ?? false;
  const others = checks?.checkedBy(date, slot, item.id) ?? [];

  return (
    <li className="flex items-start gap-1">
      {checks && (
        <Checkbox
          checked={checked}
          disabled={!checks.editable}
          onChange={(next) => checks.toggle(date, slot, item.id, next)}
          label={`${item.label}${amount ? `, ${amount}` : ''}`}
        />
      )}

      <span
        className={`flex flex-wrap items-baseline gap-x-2 py-2.5 transition-opacity ${
          checked ? 'opacity-55' : ''
        }`}
      >
        {/* El nombre se vuelve pulsable solo cuando de verdad hay por qué cambiarlo: con
            foodKey, en algún grupo de equivalencia y mirando tu propio plan. Un subrayado
            de puntos lo insinúa sin convertir la lista en un campo de botones. */}
        {sePuedeCambiar ? (
          <button
            type="button"
            onClick={() => sustituir?.open(block, item, date)}
            aria-label={`Cambiar ${item.label} por un equivalente`}
            className={`text-left text-item font-medium text-ink underline decoration-line decoration-dotted underline-offset-4 ${
              checked ? 'line-through' : ''
            }`}
          >
            {item.label}
          </button>
        ) : (
          <span className={`text-item font-medium text-ink ${checked ? 'line-through' : ''}`}>
            {item.label}
          </span>
        )}
        {amount && <span className="text-item font-semibold text-ink">{amount}</span>}
        {measure && <span className="text-measure text-ink-muted">({measure})</span>}
        {item.note && <span className="w-full text-measure text-ink-muted">{item.note}</span>}
        {enLugarDe !== null && (
          <span className="w-full text-measure text-ink-muted italic">{enLugarDe}</span>
        )}
        {others.length > 0 && (
          <span
            className="flex items-center gap-1"
            title={`Ya lo ha marcado: ${others.join(', ')}`}
          >
            {others.map((name) => (
              <span
                key={name}
                aria-label={`${name} ya lo ha marcado`}
                className="grid size-5 place-items-center rounded-chip bg-check text-[0.625rem] font-bold text-check-tick"
              >
                {name.charAt(0)}
              </span>
            ))}
          </span>
        )}
      </span>
    </li>
  );
}

function SectionBlock({
  section,
  block,
  profileId,
  date,
  slot,
}: {
  section: Section;
  /** El bloque al que pertenece: hace falta para poder sustituir un alimento. */
  block: Block;
  profileId: ProfileId;
  date: string;
  slot: SlotKey;
}) {
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
      <ul>
        {section.items.map((item) => (
          <ItemLine
            key={item.id}
            item={item}
            block={block}
            profileId={profileId}
            date={date}
            slot={slot}
          />
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
  date,
  slot,
}: {
  block: Block;
  profileId: ProfileId;
  shared: boolean;
  date: string;
  slot: SlotKey;
}) {
  return (
    <div className={`rounded-block px-3 py-2 ${shared ? 'bg-shared' : 'bg-bg'}`}>
      {shared && (
        <p className="flex items-center gap-1.5 pt-1 text-measure font-semibold text-ink-muted">
          <Icon name="compartido" size={15} />
          Compartido
        </p>
      )}
      {block.sections.map((section) => (
        <SectionBlock
          key={section.id}
          section={section}
          block={block}
          profileId={profileId}
          date={date}
          slot={slot}
        />
      ))}
    </div>
  );
}
