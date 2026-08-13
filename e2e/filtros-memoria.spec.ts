import { test, expect, type Page } from "@playwright/test";

/**
 * El viaje que ningún test cubría: aplicar un filtro, SALIR POR EL MENÚ LATERAL y volver.
 *
 * El test que ya existía (backlog-qa) hace `goto("/pipeline?orden=valor")`, o sea entra con los
 * filtros ya en la URL — que es exactamente el caso que NO falla. El menú navega a la ruta
 * pelada, y ahí la única forma de recuperar los filtros es la cookie de memoria. Por eso se
 * reportó dos veces que "los filtros no persisten" con la suite en verde.
 *
 * La regla que se fija acá: se recuerda TODO lo que se puede elegir. La única excepción es el
 * texto libre, y no por producto sino porque rompería el charset de la cookie.
 */

/** Navega como lo hace un usuario: clic en el menú, que apunta a la ruta sin query. */
async function irPorElMenu(page: Page, ruta: string) {
  await page.locator(`a[href="${ruta}"]`).first().click();
  await page.waitForURL(new RegExp(`${ruta.replace("/", "\\/")}(\\?|$)`));
}

/** Cada caso arranca sin memoria previa: si no, un test le presta su cookie al siguiente. */
async function olvidarFiltros(page: Page) {
  const cookies = await page.context().cookies();
  await page.context().clearCookies();
  // Se conserva la sesión: solo se descartan las cookies de memoria de filtros.
  await page.context().addCookies(cookies.filter((c) => !c.name.startsWith("ns-f.")));
}

test.describe("Memoria de filtros · salir por el menú y volver", () => {
  test("Ventas recuerda el PERÍODO, que era la exclusión reportada como bug", async ({ page }) => {
    await page.goto("/ventas");
    await olvidarFiltros(page);
    await page.goto("/ventas");

    // Elegir el año en curso desde el multiselect.
    await page.getByRole("button", { name: "Todos los años" }).click();
    const anio = String(new Date().getFullYear());
    await page.getByRole("button", { name: anio, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`ano=${anio}`));

    // Salir por el menú a otra pantalla y volver, las dos veces a la ruta PELADA.
    await irPorElMenu(page, "/contactos");
    await irPorElMenu(page, "/ventas");

    // Sin esto, el server hidrataba sin el período y la pantalla volvía a "Todos los años".
    await expect(page).toHaveURL(new RegExp(`ano=${anio}`));
    await expect(page.getByRole("button", { name: new RegExp(`^${anio}`) })).toBeVisible();
  });

  test("Reportes recuerda: era la única pantalla que no guardaba nada", async ({ page }) => {
    await page.goto("/reportes");
    await olvidarFiltros(page);
    await page.goto("/reportes");

    await page.getByRole("button", { name: /^Filtros/ }).click();
    await page.getByRole("button", { name: "Años", exact: true }).click();
    const anio = String(new Date().getFullYear());
    await page.getByRole("button", { name: anio, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`ano=${anio}`));

    await irPorElMenu(page, "/ventas");
    await irPorElMenu(page, "/reportes");

    await expect(page).toHaveURL(new RegExp(`ano=${anio}`));
  });

  test("La búsqueda del Pipeline NO se recuerda: es texto libre", async ({ page }) => {
    // No es una preferencia de producto: el charset de la cookie no admite espacios ni acentos,
    // así que guardarla haría que la memoria se borre en silencio. Se fija para que nadie la
    // "arregle" sin darse cuenta de lo que rompe.
    await page.goto("/pipeline");
    await olvidarFiltros(page);
    await page.goto("/pipeline");

    await page.getByRole("button", { name: /^Filtros/ }).click();
    const buscador = page.getByPlaceholder(/buscar/i).first();
    await buscador.fill("acme");
    await expect(page).toHaveURL(/q=acme/);

    await irPorElMenu(page, "/ventas");
    await irPorElMenu(page, "/pipeline");

    await expect(page).not.toHaveURL(/q=acme/);
  });

  test("Limpiar los filtros también borra la memoria", async ({ page }) => {
    // Cae de que los serializadores omiten los defaults: sin filtros el query string es "" y
    // `cookieDeMemoria` devuelve un borrado. Sin este test, esa propiedad se puede perder sin
    // que nada avise.
    await page.goto("/ventas");
    await olvidarFiltros(page);
    await page.goto("/ventas");

    await page.getByRole("button", { name: "Todos los años" }).click();
    const anio = String(new Date().getFullYear());
    await page.getByRole("button", { name: anio, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`ano=${anio}`));

    await page.getByRole("button", { name: "Limpiar todo" }).click();
    await expect(page).not.toHaveURL(/ano=/);

    await irPorElMenu(page, "/contactos");
    await irPorElMenu(page, "/ventas");

    await expect(page).not.toHaveURL(/ano=/);
    const memoria = (await page.context().cookies()).find((c) => c.name === "ns-f.ventas");
    expect(memoria).toBeUndefined();
  });
});
