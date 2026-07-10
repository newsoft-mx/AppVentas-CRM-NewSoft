import { test as setup, expect } from "@playwright/test";

const authFile = "e2e/.auth/admin.json";

// Inicia sesión como ADMIN por la UI y guarda la cookie de sesión para que el
// resto de la suite la reutilice sin re-loguear.
setup("autenticar admin", async ({ page }) => {
  await page.goto("/login");
  await page.fill("#email", "roldan@newsoft.mx");
  await page.fill("#password", "newsoft2026");
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  // Aterriza fuera de /login (por defecto /ventas)
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15_000 });
  await expect(page).toHaveURL(/\/(ventas|pipeline|reportes)/);
  await page.context().storageState({ path: authFile });
});
