/**
 * Carga `.env` y `.env.local` en process.env — sin dependencias.
 *
 * El CLI de Prisma lee el `.env` por su cuenta, pero nada más lo hace: Jest y el
 * `ts-node` del seed arrancan con el entorno pelado y fallan al instanciar el cliente
 * ("Environment variable not found: POSTGRES_PRISMA_URL"). Este preload cierra esa
 * grieta para que un `npm test` / `npm run db:seed` recién clonado funcione.
 *
 * Lo que ya viene exportado en el entorno GANA sobre el archivo: en CI las variables
 * llegan por el runner y no deben pisarse. Igual criterio que usa Prisma.
 */
const fs = require("fs");
const path = require("path");

// `.env.local` se lee después pero no pisa: el primero que define una clave, manda.
const ARCHIVOS = [".env", ".env.local"];

function parsear(contenido) {
  const vars = {};
  for (const linea of contenido.split(/\r?\n/)) {
    const limpia = linea.trim();
    if (!limpia || limpia.startsWith("#")) continue;

    const corte = limpia.indexOf("=");
    if (corte === -1) continue;

    const clave = limpia.slice(0, corte).trim().replace(/^export\s+/, "");
    if (!clave) continue;

    let valor = limpia.slice(corte + 1).trim();
    // Comillas envolventes: las saca, como hace dotenv.
    const comilla = valor[0];
    if ((comilla === '"' || comilla === "'") && valor.endsWith(comilla) && valor.length > 1) {
      valor = valor.slice(1, -1);
    }
    vars[clave] = valor;
  }
  return vars;
}

for (const archivo of ARCHIVOS) {
  const ruta = path.resolve(process.cwd(), archivo);
  if (!fs.existsSync(ruta)) continue;

  const vars = parsear(fs.readFileSync(ruta, "utf8"));
  for (const [clave, valor] of Object.entries(vars)) {
    if (process.env[clave] === undefined) process.env[clave] = valor;
  }
}
