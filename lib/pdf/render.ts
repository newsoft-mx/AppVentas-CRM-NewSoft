import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import os from "node:os";
import puppeteer from "puppeteer-core";

// Motor central de generación de PDF (SOL-14): HTML → PDF con Chromium.
// Reutilizable por cualquier superficie que arme su propio HTML; la plantilla
// vive en cada consumidor, el motor (resolución de Chromium + render) vive acá.

const ARGS = ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"];

function primerExistente(rutas: string[]): string | undefined {
  return rutas.find((r) => existsSync(r));
}

// Chromium/Chrome/Edge del sistema según el SO. Windows/macOS locales usan el
// navegador instalado; Docker/Lightsail el chromium de apt.
function chromiumLocal(): string | undefined {
  if (process.platform === "win32") {
    return primerExistente([
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
      "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    ]);
  }
  if (process.platform === "darwin") {
    return primerExistente([
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    ]);
  }
  return primerExistente(["/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome"]);
}

// Vercel/serverless → @sparticuz/chromium (no hay binario del sistema).
// CHROMIUM_PATH fuerza una ruta manual en cualquier entorno.
async function resolveChromium(): Promise<{ executablePath: string; args: string[] }> {
  if (process.env.CHROMIUM_PATH) {
    return { executablePath: process.env.CHROMIUM_PATH, args: ARGS };
  }
  if (process.env.VERCEL) {
    const chromium = (await import("@sparticuz/chromium")).default;
    return { executablePath: await chromium.executablePath(), args: chromium.args };
  }
  const executablePath = chromiumLocal();
  if (!executablePath) {
    throw new Error(
      "No se encontró Chromium/Chrome/Edge en el sistema. Definí CHROMIUM_PATH con la ruta al ejecutable."
    );
  }
  return { executablePath, args: ARGS };
}

export async function renderHtmlToPdf(html: string): Promise<Buffer> {
  const { executablePath, args } = await resolveChromium();
  // Perfil temporal ÚNICO por invocación (Bloque B): un userDataDir fijo compartido
  // rompe con requests concurrentes (Chromium toma un SingletonLock del perfil, así
  // que el 2º PDF simultáneo fallaba). Se crea y se borra por render.
  const userDataDir = mkdtempSync(join(os.tmpdir(), "chromium-pdf-"));
  const browser = await puppeteer.launch({
    executablePath,
    userDataDir,
    args,
    headless: true,
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdf = await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
    // Limpiar el perfil temporal (best-effort; no romper el response si falla).
    try {
      rmSync(userDataDir, { recursive: true, force: true });
    } catch {
      /* noop */
    }
  }
}
