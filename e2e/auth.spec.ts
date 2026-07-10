import { test, expect } from "@playwright/test";

// Flujo A — Autenticación (2 casos). Sin sesión previa.
test.describe("A · Autenticación", () => {
  test("A1 · login válido entra al dashboard", async ({ page }) => {
    await page.goto("/login");
    await page.fill("#email", "roldan@newsoft.mx");
    await page.fill("#password", "newsoft2026");
    await page.getByRole("button", { name: "Iniciar sesión" }).click();

    await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15_000 });
    await expect(page).toHaveURL(/\/(ventas|pipeline|reportes)/);
    // La cookie de sesión quedó seteada
    const cookies = await page.context().cookies();
    expect(cookies.some((c) => c.name === "ns-auth")).toBeTruthy();
  });

  test("A2 · login inválido es rechazado", async ({ page }) => {
    await page.goto("/login");
    await page.fill("#email", "roldan@newsoft.mx");
    await page.fill("#password", "clave-incorrecta");
    await page.getByRole("button", { name: "Iniciar sesión" }).click();

    await expect(page.getByText(/incorrect/i)).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });
});
