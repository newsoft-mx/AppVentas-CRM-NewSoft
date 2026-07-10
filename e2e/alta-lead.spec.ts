import { test, expect } from "@playwright/test";
import { catalogo, stageDeOrden, limpiarDatosDeTest, db, type Catalogo } from "./helpers/db";
import { getFunnel, countEtapa, crearDealAPI, rangoHoy } from "./helpers/api";

// Flujo B — Alta de lead (2 casos). El alta debe: aparecer en el pipeline en la
// etapa Leads Y sumar en el reporte de funnel (total y etapa Leads).
test.describe("B · Alta de lead", () => {
  let cat: Catalogo;
  const rango = rangoHoy();

  test.beforeAll(async () => {
    cat = await catalogo();
  });
  test.afterAll(async () => {
    await limpiarDatosDeTest();
    await db.$disconnect();
  });

  test("B1 · prospecto nuevo desde el modal (UI) aparece en Leads y suma al funnel", async ({ page, request }) => {
    const sello = `E2E Prospecto UI ${Date.now()}`;
    const antes = await getFunnel(request, rango);

    await page.goto("/pipeline");
    await page.getByRole("button", { name: "Nuevo Deal" }).click();
    await page.getByRole("heading", { name: "Nuevo Deal" }).waitFor();

    await page.getByPlaceholder("Ej. Portal de Proveedores").fill(sello);
    await page.getByRole("button", { name: "Nuevo prospecto" }).click();
    await page.getByPlaceholder("Empresa / nombre del prospecto").fill(`E2E Cliente ${Date.now()}`);
    await page.getByPlaceholder("Ej. Irvin Álvarez").fill("E2E Contacto");
    await page.getByRole("button", { name: "Crear deal" }).click();

    // La tarjeta aparece en el tablero (etapa Leads por defecto)
    await expect(page.getByText(sello, { exact: true })).toBeVisible();

    const despues = await getFunnel(request, rango);
    expect(despues.total).toBe(antes.total + 1);
    expect(countEtapa(despues, 1)).toBe(countEtapa(antes, 1) + 1); // Leads
  });

  test("B2 · cliente existente vía API queda ABIERTO en Leads y suma al funnel", async ({ page, request }) => {
    expect(cat.clienteActivo, "no hay cliente ACTIVO en la BD").toBeTruthy();
    const leads = stageDeOrden(cat, 1);
    const antes = await getFunnel(request, rango);

    const deal = await crearDealAPI(request, {
      nombre: `E2E API ${Date.now()}`,
      cliente_id: cat.clienteActivo!.id,
      stage_id: leads.id,
    });
    expect(deal.resultado).toBe("ABIERTO");
    expect(deal.stage_id).toBe(leads.id);

    const despues = await getFunnel(request, rango);
    expect(despues.total).toBe(antes.total + 1);
    expect(countEtapa(despues, 1)).toBe(countEtapa(antes, 1) + 1);

    // Y es navegable en el detalle
    await page.goto(`/pipeline/${deal.id}`);
    await expect(page.getByText(deal.nombre).first()).toBeVisible();
  });
});
