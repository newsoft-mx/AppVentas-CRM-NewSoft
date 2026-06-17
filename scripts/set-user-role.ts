import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ROLES = new Set(["ADMIN", "GERENTE_COMERCIAL", "VENDEDOR", "ADMINISTRATIVO"]);

function argValue(name: string) {
  const prefix = `--${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length).trim();

  const index = process.argv.indexOf(`--${name}`);
  if (index >= 0) return process.argv[index + 1]?.trim();
  return undefined;
}

function printUsage() {
  console.log(`
Uso:
  npm run user:role -- --email correo@dominio.com --role ADMIN
  npm run user:role -- --email correo@dominio.com --role GERENTE_COMERCIAL
  npm run user:role -- --email correo@dominio.com --role ADMINISTRATIVO
  npm run user:role -- --email correo@dominio.com --role VENDEDOR --vendedor "Nombre del vendedor"

Roles válidos:
  ADMIN
  GERENTE_COMERCIAL
  VENDEDOR
  ADMINISTRATIVO
`);
}

async function main() {
  const email = argValue("email")?.toLowerCase();
  const role = argValue("role")?.toUpperCase();
  const vendedorName = argValue("vendedor");

  if (!email || !role || !ROLES.has(role)) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, nombre: true },
  });

  if (!user) {
    throw new Error(`No existe usuario con email: ${email}`);
  }

  let vendedorId: string | null = null;

  if (role === "VENDEDOR") {
    if (!vendedorName) {
      throw new Error("Para role VENDEDOR debes indicar --vendedor \"Nombre exacto\"");
    }

    const vendedor = await prisma.vendedor.findFirst({
      where: { nombre: vendedorName, activo: true },
      select: { id: true, nombre: true },
    });

    if (!vendedor) {
      throw new Error(`No existe vendedor activo con nombre exacto: ${vendedorName}`);
    }

    vendedorId = vendedor.id;
  }

  await prisma.$executeRawUnsafe(
    'UPDATE "user" SET rol = $1::user_role, vendedor_id = $2::uuid WHERE id = $3::uuid',
    role,
    vendedorId,
    user.id
  );

  console.log("Rol actualizado:");
  console.log(`  Usuario: ${user.nombre} <${user.email}>`);
  console.log(`  Rol: ${role}`);
  console.log(`  Vendedor ID: ${vendedorId ?? "N/A"}`);
  console.log("Nota: el usuario debe cerrar sesión e iniciar sesión nuevamente.");
}

main()
  .catch((error) => {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
