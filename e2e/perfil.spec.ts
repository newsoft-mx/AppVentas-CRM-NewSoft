import { test, expect } from "@playwright/test";

// Perfil propio: un usuario cambia SU contraseña (verificando la actual) y luego
// entra con la nueva. Cubre el flujo end-to-end por la UI, en contexto limpio.
const ADMIN = { email: "roldan@newsoft.mx", password: "newsoft2026" };

async function loginUI(page: import("@playwright/test").Page, email: string, password: string) {
  await page.goto("/login");
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 15_000 });
}

test("el usuario cambia su contraseña y entra con la nueva", async ({ browser }) => {
  const email = `perfil.e2e+${Date.now()}@newsoft.mx`;
  const pass1 = "Perfil-Vieja-01";
  const pass2 = "Perfil-Nueva-02";

  // 1) Admin crea el usuario (API).
  const adminCtx = await browser.newContext();
  await adminCtx.request.post("/api/auth/login", { data: ADMIN });
  const create = await adminCtx.request.post("/api/configuracion/usuarios", {
    data: { nombre: "Perfil E2E", email, password: pass1, rol: "ADMINISTRATIVO" },
  });
  expect(create.status()).toBe(201);
  await adminCtx.close();

  // 2) El usuario entra con la contraseña vieja y la cambia en /perfil.
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await loginUI(page, email, pass1);
  await page.goto("/perfil");
  await page.fill("#perfil-actual", pass1);
  await page.fill("#perfil-nueva", pass2);
  await page.fill("#perfil-confirmar", pass2);
  await page.getByRole("button", { name: "Cambiar contraseña" }).click();
  await expect(page.getByText("Contraseña actualizada")).toBeVisible({ timeout: 10_000 });
  await ctx.close();

  // 3) La contraseña vieja ya NO sirve y la nueva SÍ.
  const viejo = await browser.newContext();
  const loginViejo = await viejo.request.post("/api/auth/login", { data: { email, password: pass1 } });
  expect(loginViejo.status()).toBe(401);
  await viejo.close();

  const nuevo = await browser.newContext();
  const pageN = await nuevo.newPage();
  await loginUI(pageN, email, pass2);
  await expect(pageN).toHaveURL(/\/(ventas|pipeline|reportes)/);
  await nuevo.close();
});
