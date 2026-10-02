/**
 * Claves de agregación de la lista de la compra.
 *
 * La migración declara `unique nulls not distinct (household_id, week_start, source,
 * food_key)`. Con "nulls not distinct", dos filas con food_key nulo chocan entre sí, así que
 * solo cabría UNA línea sin clave por semana. Por eso todo lo que no viene del catálogo
 * recibe una clave sintética y estable, derivada de su nombre:
 *
 *   pollo                  alimento del catálogo
 *   libre:especias-al-gusto  del plan, pero sin cantidad sumable
 *   manual:papel-de-horno    añadido a mano
 *
 * Que sea estable tiene premio: al regenerar la lista, o al añadir dos veces lo mismo, la
 * fila se reaprovecha en vez de duplicarse.
 */
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLocaleLowerCase('es-ES')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export const looseKey = (label: string) => `libre:${slugify(label)}`;
export const manualKey = (label: string) => `manual:${slugify(label)}`;

/** Solo las claves sin prefijo apuntan al catálogo de alimentos. */
export function isCatalogKey(key: string | undefined): boolean {
  return key !== undefined && !key.includes(':');
}
