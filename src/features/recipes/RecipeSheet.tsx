import { Sheet } from '../../components/Sheet';
import type { Recipe } from '../../domain/schema';

/**
 * Una receta del plan, tal cual viene del PDF: ingredientes con sus pesos y los pasos.
 * Es de solo lectura; editar recetas necesitaría una tabla propia (ver README).
 */
export function RecipeSheet({ recipe, onClose }: { recipe: Recipe | null; onClose: () => void }) {
  return (
    <Sheet open={recipe !== null} onClose={onClose} title={recipe?.title ?? ''} tall>
      {recipe && (
        <div className="pb-4">
          {recipe.kind === 'cheat_meal' && (
            <p className="rounded-block bg-free p-2 text-measure font-semibold text-ink">
              Cheat meal · día del glotón
            </p>
          )}

          <h3 className="mt-4 text-measure font-extrabold tracking-[0.06em] text-ink-muted">
            INGREDIENTES
          </h3>
          <ul className="mt-1">
            {recipe.ingredients.map((ingredient, index) => (
              <li
                key={`${ingredient.label}-${index}`}
                className="flex flex-wrap items-baseline gap-x-2 border-t border-line/70 py-2 first:border-t-0"
              >
                <span className="flex-1 text-item font-medium text-ink">{ingredient.label}</span>
                {ingredient.rawG && (
                  <span className="text-item font-semibold text-ink">
                    {ingredient.rawG} g crudo
                  </span>
                )}
                {ingredient.cookedG && (
                  <span className="text-item font-semibold text-ink">
                    {ingredient.cookedG} g cocido
                  </span>
                )}
                {ingredient.measure && (
                  <span className="w-full text-measure text-ink-muted">{ingredient.measure}</span>
                )}
              </li>
            ))}
          </ul>

          <h3 className="mt-5 text-measure font-extrabold tracking-[0.06em] text-ink-muted">
            CÓMO SE HACE
          </h3>
          <ol className="mt-1 flex flex-col gap-3">
            {recipe.steps.map((step, index) => (
              <li key={index} className="flex gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-chip bg-slot text-measure font-bold text-slot-ink">
                  {index + 1}
                </span>
                <span className="flex-1 text-item text-ink">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </Sheet>
  );
}
