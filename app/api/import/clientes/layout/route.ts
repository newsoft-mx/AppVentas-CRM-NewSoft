export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { canManageClients, requireAuth } from "@/lib/session";
import { excelResponse } from "@/lib/csv";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await requireAuth(req);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!canManageClients(session)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const condiciones = await prisma.condicionComercial.findMany({
    where: { activo: true },
    orderBy: { nombre: "asc" },
    select: { nombre: true },
  });

  return excelResponse("layout_clientes_newsoft.xls", [
    {
      name: "Clientes",
      rows: [
        ["nombre", "rfc", "email", "contacto", "ciudad", "telefono", "condicion_pago", "notas"],
        ["TechCorp México S.A. de C.V.", "TCM210501AB3", "carlos@techcorp.mx", "Carlos Mendoza", "Ciudad de México", "+52 55 9876 5432", condiciones[0]?.nombre ?? "Contado", "Cliente estratégico"],
        ["Cliente sin RFC", "", "ventas@cliente.com", "Ana López", "Monterrey", "", condiciones[1]?.nombre ?? condiciones[0]?.nombre ?? "30 días", ""],
        ["Cliente sin email", "ABC010203XYZ", "", "Roberto Pérez", "Guadalajara", "+52 33 1234 5678", condiciones[0]?.nombre ?? "Contado", ""],
      ],
    },
    {
      name: "Opciones",
      rows: [
        ["condicion_pago"],
        ...condiciones.map((condicion) => [condicion.nombre]),
      ],
    },
  ]);
}
