/**
 * Flujos críticos (PLAN.md, fase 10): entrar, marcar checks, intercambiar y deshacer,
 * generar la compra.
 *
 * Se ejecutan contra el Supabase real, así que cada prueba deja las cosas como estaban.
 */
import { admin, env, expect, openTab, test } from './fixtures';

test.skip(env === null, 'Hace falta .env.local con SUPABASE_SERVICE_ROLE_KEY');

/**
 * La limpieza va en un afterEach y no al final del test: si una comprobación falla a mitad,
 * la última línea no se ejecuta y la lista se queda puesta, lo que hace que la siguiente
 * ejecución se salte sola y parezca que todo va bien.
 */
let listaGenerada = false;

test.afterEach(async () => {
  if (!listaGenerada) return;
  listaGenerada = false;
  const response = await admin('shopping_items?id=neq.00000000-0000-0000-0000-000000000000', {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error(`No se pudo limpiar la lista: HTTP ${response.status}`);
});

test('entra con la sesión y ve su plan', async ({ app }) => {
  // El perfil del usuario aparece en la cabecera y hay comida en pantalla.
  await expect(app.getByRole('banner')).toContainText(/Cristina|Andrés|Casa/);
  await expect(app.getByRole('heading', { level: 2 }).first()).toBeVisible();
});

test('marca un alimento y se guarda', async ({ app }) => {
  const check = app.getByRole('checkbox').first();
  await expect(check).toHaveAttribute('aria-checked', 'false');

  await check.click();
  await expect(check).toHaveAttribute('aria-checked', 'true');

  // Llega a la base de datos.
  await expect
    .poll(
      async () => {
        const response = await admin('checks?select=item_id');
        return ((await response.json()) as unknown[]).length;
      },
      { timeout: 15_000 },
    )
    .toBeGreaterThan(0);

  // Y se deja como estaba.
  await check.click();
  await expect(check).toHaveAttribute('aria-checked', 'false');
  await admin('checks?item_id=neq.imposible', { method: 'DELETE' });
});

test('intercambia dos días y lo deshace', async ({ app }) => {
  await openTab(app, 'Semana');

  await app
    .getByRole('button', { name: /^Opciones de COMIDA/ })
    .first()
    .click();
  await app.getByRole('button', { name: /Intercambiar con otro día/ }).click();

  const destino = app.getByRole('dialog').getByRole('button', { name: /MARTES/ });
  await destino.click();
  await app.getByRole('button', { name: /^Intercambiar con/ }).click();

  // El aviso confirma y la base de datos tiene las dos filas cruzadas.
  await expect(app.getByRole('status')).toContainText('Intercambiado');
  await expect
    .poll(
      async () => {
        const response = await admin('week_overrides?select=day');
        return ((await response.json()) as unknown[]).length;
      },
      { timeout: 15_000 },
    )
    .toBe(2);

  await app.getByRole('button', { name: 'Deshacer' }).click();

  await expect
    .poll(
      async () => {
        const response = await admin('week_overrides?select=day');
        return ((await response.json()) as unknown[]).length;
      },
      { timeout: 15_000 },
    )
    .toBe(0);
});

test('genera la compra sumando a los dos', async ({ app }) => {
  const antes = (await (await admin('shopping_items?select=id')).json()) as unknown[];
  test.skip(antes.length > 0, 'Ya hay una lista de la compra: no se toca');

  await openTab(app, 'Compra');
  await app.getByRole('button', { name: /Generar lista/ }).click();
  listaGenerada = true;

  await expect(app.getByRole('heading', { name: 'FRUTERÍA' })).toBeVisible({ timeout: 20_000 });

  // El jamón suma lo de las dos personas: 180 + 150.
  const jamon = app.getByRole('button', { name: /Jamón serrano/ }).first();
  await jamon.click();
  await expect(jamon.locator('xpath=ancestor::li')).toContainText('330 g');
});
