import { test, expect } from "@playwright/test";

// Simulador de casos: contrato del API (guardar/listar/borrar, upsert por nombre) y que
// la página monte el simulador NATIVO.
//
// Antes esto afirmaba que la página montaba un `<iframe>`. Ese iframe se eliminó al migrar el
// simulador a componentes propios (PR #106, "mata el iframe") y los dos tests quedaron rojos
// desde entonces sin que nadie se enterara: el CI no corre e2e. Ahora se verifica contra lo
// que la página realmente rinde.
const ADMIN = { email: "roldan@newsoft.mx", password: "newsoft2026" };

test("simulador: guardar/listar/borrar un caso y montar la pantalla", async ({ browser, page }) => {
  const nombre = `Caso E2E ${Date.now()}`;

  // API con una sesión propia (request context).
  const ctx = await browser.newContext();
  await ctx.request.post("/api/auth/login", { data: ADMIN });

  const create = await ctx.request.post("/api/simulador/casos", {
    data: { nombre, datos: { name: nombre, period: "mensual" } },
  });
  expect(create.status()).toBe(201);

  // Upsert por nombre: guardar el mismo nombre no duplica.
  await ctx.request.post("/api/simulador/casos", { data: { nombre, datos: { name: nombre, v: 2 } } });
  const lista = await (await ctx.request.get("/api/simulador/casos")).json();
  const propios = lista.filter((c: { nombre: string }) => c.nombre === nombre);
  expect(propios).toHaveLength(1);

  const del = await ctx.request.delete(`/api/simulador/casos/${propios[0].id}`);
  expect(del.ok()).toBeTruthy();
  await ctx.close();

  // La página (autenticada por el storageState del proyecto) monta el simulador nativo.
  await page.goto("/simulador");
  await expect(page.getByRole("heading", { name: "Simulador de Casos de Negocio" })).toBeVisible();
  await expect(page.getByPlaceholder("Nombre de la cotización…")).toBeVisible();
});

test("simulador Fase 2: deep-link ?caso= precarga el caso en la pantalla", async ({ page, request }) => {
  const nombre = `Deep-link ${Date.now()}`;
  // Crear un caso con la sesión del proyecto (storageState admin).
  const create = await request.post("/api/simulador/casos", {
    data: { nombre, datos: { name: nombre, period: "mensual", mode: "absolute" } },
  });
  const caso = await create.json();

  // Abrir el simulador vía deep-link: la página debe cargar ese caso (nombre precargado).
  await page.goto(`/simulador?caso=${caso.id}`);
  await expect(page.getByPlaceholder("Nombre de la cotización…")).toHaveValue(nombre);

  await request.delete(`/api/simulador/casos/${caso.id}`);
});
