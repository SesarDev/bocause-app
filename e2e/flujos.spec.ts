/**
 * Flujos críticos (PLAN.md, fase 10): entrar, marcar checks, intercambiar y deshacer,
 * generar la compra.
 *
 * Se ejecutan contra el Supabase real, así que cada prueba deja las cosas como estaban.
 */
import {
  admin,
  cambiosDesde,
  env,
  expect,
  fotografiar,
  openTab,
  restaurar,
  test,
  type Foto,
  type Tabla,
} from './fixtures';

test.skip(env === null, 'Hace falta .env.local con SUPABASE_SERVICE_ROLE_KEY');

/**
 * Limpieza.
 *
 * Va en un `afterEach` y no al final de cada prueba: si una comprobación falla a mitad, la
 * última línea nunca se ejecuta, las filas se quedan puestas y la siguiente ejecución
 * arranca sucia. Pasó con la lista de la compra —la prueba se saltaba sola y la suite
 * seguía diciendo que todo iba bien— y volvió a pasar con los checks y los overrides.
 *
 * Se borra **por ventana de tiempo y solo en las tablas que la prueba declara**. Esto corre
 * contra el Supabase de casa, que ya no está vacío: hay comidas marcadas, intercambios y
 * una lista de la compra de verdad. Vaciar una tabla entera borraría semanas de registro,
 * y borrar por tiempo en tablas que la prueba ni toca se llevaría por delante lo que
 * alguien esté marcando en su móvil en ese mismo momento.
 */
let fotos: Foto[] = [];

/**
 * Lo llama la prueba ANTES de escribir. Guarda cómo está la tabla para dejarla igual
 * después, pase lo que pase: así una prueba que falle a mitad tampoco deja rastro.
 */
async function protege(tabla: Tabla): Promise<Foto> {
  const foto = await fotografiar(tabla);
  fotos.push(foto);
  return foto;
}

test.beforeEach(() => {
  fotos = [];
});

test.afterEach(async () => {
  for (const foto of fotos) await restaurar(foto);
});

test('entra con la sesión y ve su plan', async ({ app }) => {
  // El perfil del usuario aparece en la cabecera y hay comida en pantalla.
  await expect(app.getByRole('banner')).toContainText(/Cristina|Andrés|Casa/);
  await expect(app.getByRole('heading', { level: 2 }).first()).toBeVisible();
});

test('marca un alimento y se guarda', async ({ app }) => {
  const foto = await protege('checks');
  const check = app.getByRole('checkbox').first();

  // No se da por hecho que empiece sin marcar: en el hogar de verdad puede estar marcado
  // ya. Se mira cómo está y se comprueba que cambia, que es lo que importa.
  const antes = await check.getAttribute('aria-checked');
  const despues = antes === 'true' ? 'false' : 'true';

  await check.click();
  await expect(check).toHaveAttribute('aria-checked', despues);

  // Llega a la base de datos. Se mide contra la foto previa: contar las filas de la tabla
  // dejó de probar nada en cuanto hubo checks de verdad, porque siempre hay alguno y la
  // comprobación pasaba aunque la escritura fallara.
  await expect.poll(async () => await cambiosDesde(foto), { timeout: 15_000 }).toBe(1);

  // Y se deja como estaba. Lo que llegó a la base de datos lo borra el afterEach.
  await check.click();
  await expect(check).toHaveAttribute('aria-checked', antes ?? 'false');
});

test('intercambia dos días y lo deshace', async ({ app }) => {
  const foto = await protege('week_overrides');
  // Los triggers de la 0006 dejan rastro de este intercambio, y ese rastro se ve en el
  // historial del hogar: una prueba no puede inventarle cambios a nadie.
  await protege('change_log');
  await openTab(app, 'Semana');

  await app
    .getByRole('button', { name: /^Opciones de COMIDA/ })
    .first()
    .click();
  await app.getByRole('button', { name: /Intercambiar con otro día/ }).click();

  const destino = app.getByRole('dialog').getByRole('button', { name: /MARTES/ });
  await destino.click();
  await app.getByRole('button', { name: /^Intercambiar con/ }).click();

  /*
   * No se exige "exactamente 2 filas". Era un número mágico que solo valía con las tablas
   * vacías: si una de las dos celdas ya venía cambiada y le toca justo el bloque que ya
   * tenía, el intercambio escribe una sola fila distinta y la prueba fallaba sin que nada
   * estuviera roto.
   *
   * El contrato de verdad son estas dos cosas: que el intercambio llega a la base de datos,
   * y que deshacer la deja exactamente como estaba. Lo segundo es lo que importa, porque un
   * "Deshacer" a medias dejaría la dieta de alguien cambiada sin que se entere.
   */
  await expect(app.getByRole('status')).toContainText('Intercambiado');
  await expect.poll(async () => await cambiosDesde(foto), { timeout: 15_000 }).toBeGreaterThan(0);

  await app.getByRole('button', { name: 'Deshacer' }).click();

  await expect.poll(async () => await cambiosDesde(foto), { timeout: 15_000 }).toBe(0);
});

test('genera la compra sumando a los dos', async ({ app }) => {
  /*
   * Esta prueba solo puede correr con la lista vacía, y por eso ahora se salta casi
   * siempre: el hogar tiene su lista de verdad.
   *
   * No es que no importe, es que no hay forma segura de hacerlo aquí. Generar encima
   * haría `upsert` sobre las líneas reales, les cambiaría `updated_at`, y entonces la
   * limpieza se las llevaría: perderían la compra de la semana. Saltar es lo correcto
   * mientras la suite apunte al Supabase de casa; lo que hace falta es un proyecto de
   * pruebas aparte (ver README).
   */
  const antes = (await (await admin('shopping_items?select=id')).json()) as unknown[];
  test.skip(
    antes.length > 0,
    'El hogar ya tiene lista de la compra: generar encima borraría la suya',
  );

  await protege('shopping_items');
  await openTab(app, 'Compra');
  await app.getByRole('button', { name: /Generar lista/ }).click();

  await expect(app.getByRole('heading', { name: 'FRUTERÍA' })).toBeVisible({ timeout: 20_000 });

  // El jamón suma lo de las dos personas: 180 + 150.
  const jamon = app.getByRole('button', { name: /Jamón serrano/ }).first();
  await jamon.click();
  await expect(jamon.locator('xpath=ancestor::li')).toContainText('330 g');
});
