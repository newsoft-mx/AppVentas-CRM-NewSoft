import { test, expect, type APIRequestContext } from "@playwright/test";
import { db, catalogo, stageDeOrden, limpiarDatosDeTest, type Catalogo } from "./helpers/db";
import { crearDealAPI } from "./helpers/api";

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
    // Los filtros de estado viven en el popover "Filtros" (rediseño): abrirlo primero.
    await page.getByRole("button", { name: /^Filtros/ }).click();
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

    // El encabezado del pipeline muestra los mismos números (KPI condensado: valor + "activos")
    await page.goto("/pipeline");
    const etiquetaActivos = page.getByText("activos", { exact: true });
    await expect(etiquetaActivos).toBeVisible();
    const dealsActivosTxt = await etiquetaActivos.locator("xpath=preceding-sibling::*[1]").textContent();
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

  test("O · health-check de invariantes responde estructurado (admin)", async ({ request }) => {
    const res = await request.get("/api/admin/health");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.checks)).toBeTruthy();
    expect(typeof body.sano).toBe("boolean");
    for (const c of body.checks) {
      expect(c).toHaveProperty("count");
      expect(["violacion", "informativo"]).toContain(c.tipo);
    }
  });

  test("F · una orden VENTA no se puede borrar en duro (409)", async ({ request }) => {
    const venta = await db.ordenVenta.findFirst({ where: { estatus: "VENTA" }, select: { id: true } });
    test.skip(!venta, "no hay orden VENTA en la BD para probar el guard");
    const res = await request.delete(`/api/ordenes/${venta!.id}`);
    expect(res.status()).toBe(409);
  });

  test("F · transición de orden ilegal es rechazada por la máquina (409)", async ({ request }) => {
    const venta = await db.ordenVenta.findFirst({ where: { estatus: "VENTA" }, select: { id: true } });
    test.skip(!venta, "no hay orden VENTA");
    // VENTA solo puede volver a COTIZADO; VENTA→BORRADOR es ilegal
    const res = await request.patch(`/api/ordenes/${venta!.id}/estatus`, { data: { estatus: "BORRADOR" } });
    expect(res.status()).toBe(409);
  });

  test("E · un deal PERDIDO no se reabre ni se gana (máquina de estados, 409)", async ({ request }) => {
    const deal = await crearDealAPI(request, {
      nombre: `E2E Emaquina ${Date.now()}`,
      cliente_id: cat.clienteActivo!.id,
      stage_id: stageDeOrden(cat, 1).id,
    });
    // Marcar PERDIDO (transición legal ABIERTO→PERDIDO)
    const perder = await request.post(`/api/crm/deals/${deal.id}/resultado`, {
      data: { resultado: "PERDIDO", razon_perdida: "Precio" },
    });
    expect(perder.status()).toBe(200);
    // PERDIDO es terminal: reabrir (→ABIERTO) es ilegal
    const reabrir = await request.post(`/api/crm/deals/${deal.id}/resultado`, {
      data: { resultado: "ABIERTO" },
    });
    expect(reabrir.status()).toBe(409);
    // …y ganarlo por /ganar también es ilegal
    const ganar = await request.post(`/api/crm/deals/${deal.id}/ganar`);
    expect(ganar.status()).toBe(409);
  });

  test("T · orden creada desde un deal ganado queda vinculada (orden_id)", async ({ request }) => {
    const deal = await crearDealAPI(request, {
      nombre: `E2E Tlink ${Date.now()}`,
      cliente_id: cat.clienteActivo!.id,
      stage_id: stageDeOrden(cat, 1).id,
    });
    await request.post(`/api/crm/deals/${deal.id}/ganar`);
    const [tipo, cond, vend] = await Promise.all([
      db.tipoCotizacion.findFirst({ where: { activo: true }, select: { id: true } }),
      db.condicionComercial.findFirst({ where: { activo: true }, select: { id: true } }),
      db.vendedor.findFirst({ where: { activo: true }, select: { id: true } }),
    ]);
    const ord = await request.post("/api/ordenes", {
      data: {
        cliente_id: cat.clienteActivo!.id, tipo_cotizacion_id: tipo!.id, condicion_pago_id: cond!.id,
        vendedor_id: vend!.id, descripcion: "E2E Tlink orden", estatus: "BORRADOR", moneda: "MXN",
        aplica_iva: true, tasa_iva: 16, deal_id: deal.id,
        partidas: [{ descripcion: "item", cantidad: 1, precio_unitario: 1000, orden_display: 1 }],
      },
    });
    expect(ord.status()).toBe(201);
    const orden = await ord.json();
    const dealDb = await db.deal.findUnique({ where: { id: deal.id }, select: { orden_id: true } });
    expect(dealDb?.orden_id).toBe(orden.id);
    // cleanup: desvincular + borrar la orden (el deal E2E lo limpia el afterAll)
    await db.deal.update({ where: { id: deal.id }, data: { orden_id: null } });
    await db.ordenVenta.delete({ where: { id: orden.id } });
  });

  test("B · PDFs concurrentes no colisionan (perfil único por render)", async ({ request }) => {
    const orden = await db.ordenVenta.findFirst({ select: { id: true } });
    test.skip(!orden, "no hay órdenes para probar el PDF");
    // Con el userDataDir fijo anterior, el 2º/3º render simultáneo fallaba (SingletonLock).
    const reqs = await Promise.all([1, 2, 3].map(() => request.get(`/api/pdf/${orden!.id}`)));
    for (const r of reqs) {
      expect(r.status()).toBe(200);
      expect(r.headers()["content-type"]).toContain("application/pdf");
    }
  });

  test("S · marcar PERDIDO por la ruta enlaza el motivo del catálogo (FK)", async ({ request }) => {
    const motivo = await db.motivoPerdida.findFirst({ where: { activo: true }, select: { id: true, nombre: true } });
    expect(motivo, "no hay motivos de pérdida en el catálogo").toBeTruthy();
    const deal = await crearDealAPI(request, {
      nombre: `E2E Smotivo ${Date.now()}`,
      cliente_id: cat.clienteActivo!.id,
      stage_id: stageDeOrden(cat, 1).id,
    });
    const res = await request.post(`/api/crm/deals/${deal.id}/resultado`, {
      data: { resultado: "PERDIDO", razon_perdida: motivo!.nombre },
    });
    expect(res.status()).toBe(200);
    const dealDb = await db.deal.findUnique({
      where: { id: deal.id },
      select: { razon_perdida: true, motivo_perdida_id: true },
    });
    expect(dealDb?.razon_perdida).toBe(motivo!.nombre); // etiqueta denormalizada
    expect(dealDb?.motivo_perdida_id).toBe(motivo!.id); // FK al catálogo
  });

  test("C · editar el contacto principal se refleja en la ficha del cliente (invariante)", async ({ request }) => {
    // Cliente del deal demo "Suite Operativa" (0002)
    const CLIENTE = "30000000-0000-0000-0000-000000000002";
    const listRes = await request.get(`/api/clientes/${CLIENTE}/contactos`);
    expect(listRes.status()).toBe(200);
    const { contactos } = (await listRes.json()) as { contactos: Array<{ id: string; nombre: string; es_principal: boolean }> };
    const principal = contactos.find((c) => c.es_principal)!;
    expect(principal).toBeTruthy();
    const original = principal.nombre;
    const nuevo = `E2E Ppal ${Date.now()}`;

    // Editar el contacto principal
    const patch = await request.patch(`/api/clientes/${CLIENTE}/contactos/${principal.id}`, { data: { nombre: nuevo } });
    expect(patch.status()).toBe(200);
    // El espejo del cliente refleja el cambio (SSOT del principal)
    const cliDb = await db.cliente.findUnique({ where: { id: CLIENTE }, select: { contacto: true } });
    expect(cliDb?.contacto).toBe(nuevo);

    // Restaurar
    await request.patch(`/api/clientes/${CLIENTE}/contactos/${principal.id}`, { data: { nombre: original } });
  });
});
