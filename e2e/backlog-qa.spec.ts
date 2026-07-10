import { test, expect, type APIRequestContext } from "@playwright/test";
import { db, catalogo, stageDeOrden, limpiarDatosDeTest, type Catalogo } from "./helpers/db";
import { crearDealAPI, getFunnel, rangoHoy } from "./helpers/api";

// QA del lote 2026-07-10 (SOL-14 a SOL-20). Verifica que cada cambio quedó
// aplicado, contra el server local. Se auto-limpia (deals con prefijo E2E).
const DEMO_DEAL_CONTACTO = "60000000-0000-0000-0000-000000000002"; // Suite Operativa (Irvin DECISOR c/ datos)

async function metricas(request: APIRequestContext, r: { desde: string; hasta: string }) {
  const res = await request.get(`/api/reportes/metricas?desde=${r.desde}&hasta=${r.hasta}`);
  expect(res.ok(), `metricas GET falló: ${res.status()}`).toBeTruthy();
  return res.json() as Promise<{
    valor_pipeline: number;
    deals_activos: number;
    calientes: number;
    promedio_deal: number;
  }>;
}

test.describe("QA lote SOL-14..20", () => {
  let cat: Catalogo;
  test.beforeAll(async () => {
    cat = await catalogo();
  });
  test.afterAll(async () => {
    await limpiarDatosDeTest();
    await db.$disconnect();
  });

  test("SOL-16/20 · nota Markdown se renderiza estructurada; nota gigante → 422", async ({ page, request }) => {
    const deal = await crearDealAPI(request, {
      nombre: `E2E QA MD ${Date.now()}`,
      cliente_id: cat.clienteActivo!.id,
      stage_id: stageDeOrden(cat, 1).id,
    });
    const md = "## Título QA\n\n- item **negrita**\n\n| a | b |\n| --- | --- |\n| 1 | 2 |";
    const ok = await request.post(`/api/crm/deals/${deal.id}/actividades`, { data: { tipo: "NOTA", contenido: md } });
    expect(ok.status()).toBe(201);

    await page.goto(`/pipeline/${deal.id}`);
    await expect(page.getByRole("heading", { name: "Título QA" })).toBeVisible();
    await expect(page.locator("table").first()).toBeVisible();
    await expect(page.getByText("negrita")).toBeVisible();

    // SOL-20: el límite (20.000) rechaza con 422 y campo contenido
    const grande = await request.post(`/api/crm/deals/${deal.id}/actividades`, {
      data: { tipo: "NOTA", contenido: "x".repeat(20_001) },
    });
    expect(grande.status()).toBe(422);
    expect((await grande.json()).campo).toBe("contenido");
  });

  test("SOL-15 · contacto accionable: tel:/mailto:/wa.me + badge Decisor", async ({ page }) => {
    await page.goto(`/pipeline/${DEMO_DEAL_CONTACTO}`);
    // Badge de tomador de decisión
    await expect(page.getByText("Decisor", { exact: true }).first()).toBeVisible();
    // Links accionables
    const tel = page.locator('a[href^="tel:"]').first();
    const mail = page.locator('a[href^="mailto:"]').first();
    const wa = page.locator('a[href^="https://wa.me/"]').first();
    await expect(tel).toBeVisible();
    await expect(mail).toBeVisible();
    await expect(wa).toBeVisible();
    expect(await wa.getAttribute("href")).toMatch(/wa\.me\/\d+/); // solo dígitos
  });

  test("SOL-17 · buscador filtra por nombre / cliente / contacto", async ({ page }) => {
    await page.goto("/pipeline");
    // pasar a lista para contar filas
    await page.getByRole("button", { name: "Vista lista" }).click();
    const input = page.getByPlaceholder("Buscar deal, cliente o contacto…");
    await expect(input).toBeVisible();

    await input.fill("Irvin"); // contacto del deal demo 0002
    await expect(page.getByRole("row", { name: /Suite Operativa/ })).toBeVisible();
    await expect(page.locator("tbody tr")).toHaveCount(1);

    await input.fill("Portal"); // por nombre de deal
    await expect(page.getByRole("row", { name: /Portal de Proveedores/ })).toBeVisible();
    await input.fill("");
  });

  test("SOL-18 · filtro multi-estado: chips + columna sintética de perdidos", async ({ page, request }) => {
    // Crear un deal y marcarlo PERDIDO (con prefijo E2E → se limpia)
    const perdido = await crearDealAPI(request, {
      nombre: `E2E QA Perdido ${Date.now()}`,
      cliente_id: cat.clienteActivo!.id,
      stage_id: stageDeOrden(cat, 1).id,
    });
    await db.deal.update({ where: { id: perdido.id }, data: { resultado: "PERDIDO", razon_perdida: "Precio" } });

    await page.goto("/pipeline");
    // Los 4 chips existen con conteo
    for (const est of ["Activo", "Pausado", "Ganado", "Perdido"]) {
      await expect(page.getByRole("button", { name: new RegExp(`^${est} \\(\\d+\\)`) })).toBeVisible();
    }
    // Activar Perdido → aparece columna sintética "Perdidos" + strip de motivos
    await page.getByRole("button", { name: /^Perdido \(\d+\)/ }).click();
    await expect(page.getByText("Perdidos", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Motivos de pérdida")).toBeVisible();
    await expect(page.getByText(perdido.nombre).first()).toBeVisible();
  });

  test("SOL-19 · métricas del funnel == encabezado del pipeline (invariante SSOT)", async ({ page, request }) => {
    const hoy = new Date();
    const rango = { desde: `${hoy.getFullYear()}-01-01`, hasta: hoy.toISOString().slice(0, 10) };
    const m = await metricas(request, rango);
    expect(m.deals_activos).toBeGreaterThan(0);

    // El encabezado del pipeline muestra los mismos números
    await page.goto("/pipeline");
    await expect(page.getByText("Deals activos")).toBeVisible();
    const dealsActivosTxt = await page
      .getByText("Deals activos")
      .locator("xpath=following-sibling::*[1]")
      .textContent();
    expect(Number(dealsActivosTxt)).toBe(m.deals_activos);

    // El reporte de funnel (Año) muestra la fila de métricas del pipeline
    await page.goto("/pipeline/reportes");
    await page.getByRole("button", { name: "Año" }).click();
    await expect(page.getByText("Pipeline (activos en el período)")).toBeVisible();
  });

  test("SOL-14 · PDF de cotización genera un PDF válido (200 application/pdf)", async ({ request }) => {
    const orden = await db.ordenVenta.findFirst({ select: { id: true } });
    expect(orden, "no hay órdenes en la BD para probar el PDF").toBeTruthy();
    const res = await request.get(`/api/pdf/${orden!.id}`);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("application/pdf");
    const buf = await res.body();
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
  });
});
