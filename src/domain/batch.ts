/**
 * Sugerencias de batch cooking: platos aptos para cocinar de una vez en los próximos días.
 *
 * Un plato entra si tiene al menos un alimento marcado como `batchable` en el catálogo y
 * aparece dentro del horizonte. Los que se repiten van primero, porque son los que más
 * trabajo ahorran. La cantidad es la de los dos juntos, que es como se cocina.
 */
import { addDays, isBefore, isSameOrAfter, type IsoDateString } from './dates';
import type { ResolvedWeek } from './resolve';
import { quantityOf, type Unit } from './shopping';
import type { Food, ProfileId } from './schema';

export type BatchIngredient = {
  foodKey: string;
  label: string;
  /** Ausentes cuando el plan no da cantidad ("brócoli", "al gusto"): se adelanta igual. */
  unit?: Unit;
  total?: number;
  perProfile: Record<ProfileId, number>;
};

export type BatchSuggestion = {
  /** Título del plato, que es lo que agrupa las repeticiones. */
  title: string;
  dates: IsoDateString[];
  occurrences: number;
  repeated: boolean;
  /** Días que aguanta, el mínimo de sus ingredientes aptos. undefined si no consta. */
  keepsDays: number | undefined;
  ingredients: BatchIngredient[];
};

export type BatchInput = {
  weeks: readonly ResolvedWeek[];
  foods: readonly Food[];
  from: IsoDateString;
  /** Días hacia delante que se miran, contando el de inicio. */
  horizonDays?: number;
};

export function suggestBatchCooking(input: BatchInput): BatchSuggestion[] {
  const { weeks, foods, from, horizonDays = 3 } = input;
  const foodByKey = new Map(foods.map((food) => [food.key, food]));
  const until = addDays(from, horizonDays);

  const draft = new Map<
    string,
    {
      title: string;
      dates: Set<IsoDateString>;
      occurrences: Map<string, number>;
      ingredients: Map<string, BatchIngredient>;
      keeps: number[];
      batchable: boolean;
    }
  >();

  for (const week of weeks) {
    const profileId = week.profileId;

    for (const day of week.days) {
      for (const slot of day.slots) {
        if (slot.block === null || slot.isFree) continue;
        if (!isSameOrAfter(slot.date, from) || !isBefore(slot.date, until)) continue;

        for (const section of slot.block.sections) {
          if (section.kind !== 'plato' || section.title === undefined) continue;

          const entry = draft.get(section.title) ?? {
            title: section.title,
            dates: new Set<IsoDateString>(),
            occurrences: new Map<string, number>(),
            ingredients: new Map<string, BatchIngredient>(),
            keeps: [],
            batchable: false,
          };

          entry.dates.add(slot.date);
          // Una comida compartida la ven los dos; cuenta como una sola vez cocinada.
          entry.occurrences.set(slot.date, 1);

          for (const item of section.items) {
            const portion = item.portions[profileId];
            if (item.foodKey === undefined || portion === undefined) continue;

            const food = foodByKey.get(item.foodKey);
            if (food === undefined || !food.batchable) continue;

            entry.batchable = true;
            if (food.keepsDays !== undefined) entry.keeps.push(food.keepsDays);

            const ingredient = entry.ingredients.get(item.foodKey) ?? {
              foodKey: item.foodKey,
              label: food.name,
              perProfile: {},
            };

            // Sin cantidad se lista igual, solo que sin número: el plato se adelanta
            // aunque el plan diga "brócoli" a secas.
            const quantity = quantityOf(portion);
            if (quantity !== null) {
              ingredient.unit = quantity.unit;
              ingredient.total = (ingredient.total ?? 0) + quantity.amount;
              ingredient.perProfile[profileId] =
                (ingredient.perProfile[profileId] ?? 0) + quantity.amount;
            }
            entry.ingredients.set(item.foodKey, ingredient);
          }

          draft.set(section.title, entry);
        }
      }
    }
  }

  return [...draft.values()]
    .filter((entry) => entry.batchable)
    .map((entry): BatchSuggestion => {
      const dates = [...entry.dates].sort();
      return {
        title: entry.title,
        dates,
        occurrences: dates.length,
        repeated: dates.length > 1,
        keepsDays: entry.keeps.length > 0 ? Math.min(...entry.keeps) : undefined,
        ingredients: [...entry.ingredients.values()].sort((a, b) =>
          a.label.localeCompare(b.label, 'es'),
        ),
      };
    })
    .sort((a, b) => b.occurrences - a.occurrences || a.title.localeCompare(b.title, 'es'));
}
