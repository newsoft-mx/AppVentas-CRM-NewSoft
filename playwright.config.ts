import { defineConfig, devices } from "@playwright/test";

// E2E del CRM: alta de lead → acciones que mueven el termómetro → avance de
// etapa → el reporte de funnel refleja el movimiento. Corre contra el server
// local (3001). Serial (workers: 1) porque las pruebas mutan la MISMA base y
// las aserciones del funnel se hacen por delta antes/después.
const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3001";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [["list"]],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    // 1) inicia sesión una vez y guarda la cookie para reusarla
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    // 2) el flujo de login se prueba a sí mismo, sin sesión previa
    {
      name: "authflow",
      testMatch: /auth\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    // 3) el resto de la app, autenticada como ADMIN
    {
      name: "app",
      testMatch: /(alta-lead|scoring|funnel|journey|backlog-qa|usuarios-login|perfil)\.spec\.ts/,
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"], storageState: "e2e/.auth/admin.json" },
    },
  ],
  // Reusa el server local si ya está arriba (preview MCP en 3001); si no, lo levanta.
  // --webpack: el dev de Turbopack a veces devuelve 404 en rutas API dinámicas
  // ([id]) bajo la carga de la suite; webpack (igual que el build) es estable.
  webServer: {
    command: "npm run dev -- -p 3001 --webpack",
    url: BASE_URL + "/login",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
