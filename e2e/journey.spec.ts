import { test, expect } from "@playwright/test";
import {
  catalogo, stageDeOrden, resultadoPorNombre, setUmbralAvance, limpiarDatosDeTest, db, type Catalogo,
} from "./helpers/db";
import { getFunnel, countEtapa, rangoHoy } from "./helpers/api";

// Journey — principio a fin por la UI, como lo haría el vendedor:
// alta de prospecto → registrar una acción fuerte que sube el termómetro →
// cruza el umbral → aparece el banner de avance → avanza de etapa →
// el reporte de funnel refleja el deal en la etapa alcanzada.
test.describe("J · Journey completo del vendedor", () => {
  let cat: Catalogo;
  const rango = rangoHoy();

  test.beforeAll(async () => {
    cat = await catalogo();
    // Precondición: Leads sugiere avance cuando el score cruza 70.
    await setUmbralAvance(1, 70);
  });
  test.afterAll(async () => {
    await setUmbralAvance(1, null);
    await limpiarDatosDeTest();
    await db.$disconnect();
  });

  test("alta → acción sube termómetro → avanza de etapa → funnel lo refleja", async ({ page, request }) => {
    const sello = `E2E Journey ${Date.now()}`;
    const antes = await getFunnel(request, rango);

    // 1) Alta de prospecto nuevo desde el pipeline
    await page.goto("/pipeline");
    await page.getByRole("button", { name: "Nuevo Deal" }).click();
    await page.getByRole("heading", { name: "Nuevo Deal" }).waitFor();
    await page.getByPlaceholder("Ej. Portal de Proveedores").fill(sello);
    await page.getByRole("button", { name: "Nuevo prospecto" }).click();
    await page.getByPlaceholder("Empresa / nombre del prospecto").fill(`E2E Cliente ${Date.now()}`);
    await page.getByPlaceholder("Ej. Irvin Álvarez").fill("E2E Contacto");
    await page.getByRole("button", { name: "Crear deal" }).click();

    // 2) Abrir el deal recién creado
    await page.getByText(sello, { exact: true }).click();
    await page.waitForURL(/\/pipeline\/[0-9a-f-]{36}/i);
    const dealId = page.url().split("/").pop()!;

    // 3) Registrar Reunión con resultado "Se concretó / avanzó"
    const concreto = resultadoPorNombre(cat, "Se concretó / avanzó");
    await page.getByRole("button", { name: "Reunión", exact: true }).click();
    await page
      .locator("select")
      .filter({ has: page.locator('option:has-text("Se concretó")') })
      .selectOption(concreto.id);
    await page.getByPlaceholder("Escribe una nota interna…").fill("Cerramos la reunión, avanza.");
    await page.getByRole("button", { name: "Registrar" }).click();

    // El termómetro sube a Muy caliente (actualiza en vivo)
    await expect(page.getByText(/muy caliente/i).first()).toBeVisible();

    // 4) Aparece el banner de avance y se confirma
    const banner = page.getByRole("button", { name: /Listo para avanzar a Calificado/i });
    await expect(banner).toBeVisible();
    await banner.click();

    // 5) El deal quedó en Calificado (orden 2). El banner se oculta cuando el
    // avance se confirmó (evita la carrera con el PATCH).
    await expect(banner).toBeHidden();
    await expect
      .poll(async () => {
        const d = await db.deal.findUnique({ where: { id: dealId }, select: { stage_id: true } });
        return d?.stage_id;
      }, { timeout: 10_000 })
      .toBe(stageDeOrden(cat, 2).id);

    // 6) El reporte de funnel renderiza y refleja el movimiento
    await page.goto("/pipeline/reportes");
    await expect(page.getByRole("heading", { name: "Reportes de Funnel" })).toBeVisible();

    const despues = await getFunnel(request, rango);
    expect(despues.total).toBe(antes.total + 1);
    expect(countEtapa(despues, 1)).toBe(countEtapa(antes, 1) + 1); // Leads
    expect(countEtapa(despues, 2)).toBe(countEtapa(antes, 2) + 1); // Calificado (alcanzada)
    expect(countEtapa(despues, 3)).toBe(countEtapa(antes, 3)); // no alcanzó Req. Definidos
  });
});
