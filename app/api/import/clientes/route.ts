export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { catalogKey, parseImportBuffer, nullable } from "@/lib/csv";
import { canManageClients, requireAuth } from "@/lib/session";
import { clienteCreateSchema } from "@/lib/validations/clientes";

interface ImportError {
  fila: number;
  mensaje: string;
}

export async function POST(req: NextRequest) {
  const session = await requireAuth(req);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!canManageClients(session)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const rows = parseImportBuffer(Buffer.from(await req.arrayBuffer()), "Clientes");
  const errors: ImportError[] = [];
  let created = 0;

  if (rows.length === 0) {
    return NextResponse.json(
      { error: "El archivo no contiene filas válidas" },
      { status: 400 }
    );
  }

  const condiciones = await prisma.condicionComercial.findMany({
    where: { activo: true },
    select: { id: true, nombre: true },
  });
  const condicionesByName = new Map(
    condiciones.map((c) => [catalogKey(c.nombre), c.id])
  );

  for (const [index, row] of rows.entries()) {
    const fila = index + 2;
    const condicionId = condicionesByName.get(catalogKey(row.condicion_pago));

    const data = {
      nombre: row.nombre ?? "",
      rfc: nullable(row.rfc ?? ""),
      email: nullable(row.email ?? ""),
      contacto: row.contacto ?? "",
      ciudad: row.ciudad ?? "",
      telefono: nullable(row.telefono ?? ""),
      condicion_pago_id: condicionId ?? "",
      notas: nullable(row.notas ?? ""),
    };

    const parsed = clienteCreateSchema.safeParse(data);
    if (!parsed.success) {
      errors.push({
        fila,
        mensaje: parsed.error.issues.map((issue) => issue.message).join("; "),
      });
      continue;
    }

    if (!condicionId) {
      errors.push({
        fila,
        mensaje: `Condición de pago no encontrada o inactiva: "${row.condicion_pago ?? ""}"`,
      });
      continue;
    }

    const rfcExistente = parsed.data.rfc
      ? await prisma.cliente.findFirst({ where: { rfc: parsed.data.rfc } })
      : null;

    if (rfcExistente) {
      errors.push({ fila, mensaje: "Ya existe un cliente con ese RFC" });
      continue;
    }

    try {
      await prisma.cliente.create({
        data: parsed.data as Parameters<typeof prisma.cliente.create>[0]["data"],
      });
      created += 1;
    } catch {
      errors.push({ fila, mensaje: "No se pudo crear el cliente" });
    }
  }

  return NextResponse.json({ created, errors, total: rows.length });
}
