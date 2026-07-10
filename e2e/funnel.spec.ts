import { test, expect } from "@playwright/test";
import { catalogo, stageDeOrden, limpiarDatosDeTest, db, type Catalogo } from "./helpers/db";
import { getFunnel, countEtapa, crearDealAPI, moverStage, rangoHoy, type Funnel } from "./helpers/api";

// Flujo D — El avance de etapa se refleja en el reporte de funnel (2 casos).
// El funnel cuenta, por deal, la etapa MÁS LEJANA alcanzada (historial
// DealStageEvent), acumulativo. Se verifica por delta antes/después.
test.describe("D · Avance de etapa ↔ reporte de funnel", () => {
  let cat: Catalogo;
  const rango = rangoHoy();

  test.beforeAll(async () => {
    cat = await catalogo();
  });
  test.afterAll(async () => {
    await limpiarDatosDeTest();
    await db.$disconnect();
  });

  test("D1 · avanzar Leads→Calificado→Req.Definidos suma en las 3 etapas alcanzadas", async ({ request }) => {
    const antes = await getFunnel(request, rango);

    const deal = await crearDealAPI(request, {
      nombre: `E2E Funnel-fwd ${Date.now()}`,
      cliente_id: cat.clienteActivo!.id,
      stage_id: stageDeOrden(cat, 1).id,
    });
    await moverStage(request, deal.id, stageDeOrden(cat, 2).id);
    await moverStage(request, deal.id, stageDeOrden(cat, 3).id);

    const despues = await getFunnel(request, rango);

    // El deal alcanzó orden 3 → suma +1 en etapas 1, 2 y 3…
    for (const orden of [1, 2, 3]) {
      expect(countEtapa(despues, orden), `etapa orden ${orden}`).toBe(countEtapa(antes, orden) + 1);
    }
    // …y NO en las etapas más profundas que no alcanzó
    for (const orden of [4, 5, 6]) {
      expect(countEtapa(despues, orden), `etapa orden ${orden}`).toBe(countEtapa(antes, orden));
    }
    expect(despues.total).toBe(antes.total + 1);
  });

  test("D2 · retroceder NO reduce el conteo de etapas ya alcanzadas (por diseño)", async ({ request }) => {
    const deal = await crearDealAPI(request, {
      nombre: `E2E Funnel-back ${Date.now()}`,
      cliente_id: cat.clienteActivo!.id,
      stage_id: stageDeOrden(cat, 1).id,
    });
    // Salta directo a Req. Definidos (orden 3)
    await moverStage(request, deal.id, stageDeOrden(cat, 3).id);
    const enProfundidad: Funnel = await getFunnel(request, rango);

    // Retrocede a Leads
    await moverStage(request, deal.id, stageDeOrden(cat, 1).id);
    const trasRetroceso: Funnel = await getFunnel(request, rango);

    // Las etapas 2 y 3 no bajan: el funnel mide "alcanzó alguna vez"
    for (const orden of [2, 3]) {
      expect(countEtapa(trasRetroceso, orden), `etapa orden ${orden}`).toBe(countEtapa(enProfundidad, orden));
    }
  });
});
