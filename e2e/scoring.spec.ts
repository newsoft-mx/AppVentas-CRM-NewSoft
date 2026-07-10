import { test, expect } from "@playwright/test";
import {
  catalogo, stageDeOrden, tipoPorNombre, resultadoPorNombre, limpiarDatosDeTest, db, type Catalogo,
} from "./helpers/db";
import { crearDealAPI, registrarAccionAPI } from "./helpers/api";

// Flujo C — Las acciones mueven el termómetro/score (2 casos). Verifica el
// invariante del motor: mismo número en la respuesta de la API y en la aguja
// del detalle.
test.describe("C · Acciones mueven el termómetro", () => {
  let cat: Catalogo;

  test.beforeAll(async () => {
    cat = await catalogo();
  });
  test.afterAll(async () => {
    await limpiarDatosDeTest();
    await db.$disconnect();
  });

  async function nuevoDeal(request: import("@playwright/test").APIRequestContext, nombre: string) {
    return crearDealAPI(request, {
      nombre,
      cliente_id: cat.clienteActivo!.id,
      stage_id: stageDeOrden(cat, 1).id,
    });
  }

  test("C1 · Reunión + 'Se concretó' sube el score a 100 / MUY_CALIENTE", async ({ page, request }) => {
    const deal = await nuevoDeal(request, `E2E Score+ ${Date.now()}`);
    const reunion = tipoPorNombre(cat, "Reunión");
    const concreto = resultadoPorNombre(cat, "Se concretó / avanzó");

    const r = await registrarAccionAPI(request, deal.id, {
      tipo: "NOTA",
      tipo_accion_id: reunion.id,
      resultado_id: concreto.id,
    });
    expect(r.score).toBe(100);
    expect(r.temperatura).toBe("MUY_CALIENTE");

    // La aguja del detalle muestra el mismo número (SSOT)
    await page.goto(`/pipeline/${deal.id}`);
    await expect(page.getByText("100", { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/muy caliente/i).first()).toBeVisible();
  });

  test("C2 · Email + 'No le interesó' baja el score a 0 / MUY_FRIO", async ({ page, request }) => {
    const deal = await nuevoDeal(request, `E2E Score- ${Date.now()}`);
    const email = tipoPorNombre(cat, "Email");
    const cancelo = resultadoPorNombre(cat, "No le interesó / canceló");

    const r = await registrarAccionAPI(request, deal.id, {
      tipo: "EMAIL",
      tipo_accion_id: email.id,
      resultado_id: cancelo.id,
    });
    expect(r.score).toBe(0);
    expect(r.temperatura).toBe("MUY_FRIO");

    await page.goto(`/pipeline/${deal.id}`);
    await expect(page.getByText(/muy fr[íi]o/i).first()).toBeVisible();
  });
});
