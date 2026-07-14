// Gate de migraciones destructivas (Bloque B — bordes).
//
// El build de Vercel corre `prisma migrate deploy` automáticamente contra la BD.
// Una migración que borra datos (DROP TABLE/COLUMN, TRUNCATE) se aplicaría sola en
// staging/prod sin que nadie lo apruebe. Este guard corre ANTES de migrate deploy:
// mira qué migraciones están PENDIENTES (no aplicadas todavía), y si alguna contiene
// DDL destructiva, aborta el deploy salvo que se apruebe explícitamente con
//   ALLOW_DESTRUCTIVE_MIGRATIONS=1
//
// Es un cinturón de seguridad, no una dependencia dura: ante cualquier error
// (sin BD, tabla de migraciones inexistente, etc.) hace FAIL-OPEN (deja pasar el
// deploy), para no romper builds legítimos por un problema transitorio.

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS_DIR = join(process.cwd(), "prisma", "migrations");

// Patrones que implican pérdida de datos (no DROP TYPE de un enum: eso no borra filas).
const DESTRUCTIVOS = [
  { re: /\bDROP\s+TABLE\b/i, que: "DROP TABLE" },
  { re: /\bDROP\s+COLUMN\b/i, que: "DROP COLUMN" },
  { re: /\bTRUNCATE\b/i, que: "TRUNCATE" },
  { re: /\bDROP\s+SCHEMA\b/i, que: "DROP SCHEMA" },
];

function ddlDestructiva(sql) {
  const hits = [];
  for (const { re, que } of DESTRUCTIVOS) if (re.test(sql)) hits.push(que);
  return hits;
}

function listarMigraciones() {
  if (!existsSync(MIGRATIONS_DIR)) return [];
  return readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

async function migracionesAplicadas() {
  // Import perezoso: si el client no está generado, fail-open.
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL`
    );
    return new Set(rows.map((r) => r.migration_name));
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  if (process.env.ALLOW_DESTRUCTIVE_MIGRATIONS === "1" || process.env.ALLOW_DESTRUCTIVE_MIGRATIONS === "true") {
    console.log("[guard-migrations] Destructivas aprobadas por ALLOW_DESTRUCTIVE_MIGRATIONS. Continúo.");
    return;
  }

  const todas = listarMigraciones();
  if (todas.length === 0) return;

  let aplicadas;
  try {
    aplicadas = await migracionesAplicadas();
  } catch (err) {
    console.warn(`[guard-migrations] No pude leer el estado de migraciones (${err?.message ?? err}). FAIL-OPEN: dejo pasar el deploy.`);
    return;
  }

  const pendientes = todas.filter((m) => !aplicadas.has(m));
  const problemas = [];
  for (const m of pendientes) {
    const file = join(MIGRATIONS_DIR, m, "migration.sql");
    if (!existsSync(file)) continue;
    const hits = ddlDestructiva(readFileSync(file, "utf8"));
    if (hits.length) problemas.push({ m, hits });
  }

  if (problemas.length === 0) {
    if (pendientes.length) console.log(`[guard-migrations] ${pendientes.length} migración(es) pendiente(s), ninguna destructiva. OK.`);
    return;
  }

  console.error("\n[guard-migrations] ⛔ Migración(es) PENDIENTE(s) con DDL destructiva:");
  for (const { m, hits } of problemas) console.error(`  - ${m}: ${hits.join(", ")}`);
  console.error(
    "\nEste deploy aplicaría cambios que borran datos. Si es intencional, reintentá con:\n" +
      "  ALLOW_DESTRUCTIVE_MIGRATIONS=1\n" +
      "(en Vercel: agregá la env var para este deploy y quitala luego).\n"
  );
  process.exit(1);
}

main().catch((err) => {
  // Última red: cualquier fallo inesperado no debe romper el deploy.
  console.warn(`[guard-migrations] Error inesperado (${err?.message ?? err}). FAIL-OPEN.`);
});
