import { test, expect } from "@playwright/test";

// Regresión del reporte "creo el usuario pero no puede entrar": un usuario recién
// creado debe poder loguearse con la contraseña que se le asignó. Cubre el flujo
// completo crear→entrar en un navegador real (contexto limpio, sin autofill).
const ADMIN = { email: "roldan@newsoft.mx", password: "newsoft2026" };

test("usuario recién creado puede iniciar sesión", async ({ browser }) => {
  const email = `luistrevino.e2e+${Date.now()}@newsoft.mx`;
  const password = "LuisTrevino-2026";

  // 1) Como ADMIN, crear el usuario (vía API con sesión admin).
  const adminCtx = await browser.newContext();
  const login = await adminCtx.request.post("/api/auth/login", { data: ADMIN });
  expect(login.ok(), "login admin").toBeTruthy();
  const create = await adminCtx.request.post("/api/configuracion/usuarios", {
    data: { nombre: "Luis Treviño", email, password, rol: "ADMINISTRATIVO" },
  });
  expect(create.status(), "crear usuario").toBe(201);
  await adminCtx.close();

  // 2) El usuario nuevo inicia sesión por la UI en un contexto limpio.
  const userCtx = await browser.newContext();
  const page = await userCtx.newPage();
  await page.goto("/login");
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 15_000 });
  await expect(page, "aterriza en el dashboard").toHaveURL(/\/(ventas|pipeline|reportes)/);
  await userCtx.close();
});
