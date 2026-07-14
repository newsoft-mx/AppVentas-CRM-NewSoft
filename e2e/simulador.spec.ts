import { test, expect } from "@playwright/test";

// Simulador de casos: contrato del API (guardar/listar/borrar, upsert por nombre) y que
// la página monte el iframe de la calculadora.
const ADMIN = { email: "roldan@newsoft.mx", password: "newsoft2026" };

test("simulador: guardar/listar/borrar un caso y montar el iframe", async ({ browser, page }) => {
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

  // La página (autenticada por el storageState del proyecto) monta el iframe.
  await page.goto("/simulador");
  await expect(page.locator('iframe[title="Simulador de casos de negocio"]')).toBeVisible();
});
