export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/session";
import { excelResponse } from "@/lib/csv";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await requireAuth(req);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const [clientes, tipos, condiciones, vendedores] = await Promise.all([
    prisma.cliente.findMany({
      where: { activo: true },
      orderBy: { nombre: "asc" },
      select: { nombre: true },
    }),
    prisma.tipoCotizacion.findMany({
      where: { activo: true },
      orderBy: { nombre: "asc" },
      select: { nombre: true },
    }),
    prisma.condicionComercial.findMany({
      where: { activo: true },
      orderBy: { nombre: "asc" },
      select: { nombre: true },
    }),
    prisma.vendedor.findMany({
      where: session.rol === "VENDEDOR"
        ? { activo: true, id: session.vendedorId ?? "__sin-vendedor-asignado__" }
        : { activo: true },
      orderBy: { nombre: "asc" },
      select: { nombre: true },
    }),
  ]);

  const cliente = clientes[0]?.nombre ?? "Nombre exacto del cliente";
  const tipo = tipos[0]?.nombre ?? "Proyecto Fijo";
  const condicion = condiciones[0]?.nombre ?? "Contado";
  const vendedor = vendedores[0]?.nombre ?? "Nombre exacto del vendedor";

  return excelResponse("layout_ordenes_newsoft.xls", [
    {
      name: "Ordenes",
      rows: [
        ["folio", "fecha_cotizacion", "cliente", "tipo_cotizacion", "condicion_pago", "vendedor", "descripcion", "estatus", "moneda", "tipo_cambio", "vigencia", "fecha_venta", "aplica_iva", "tasa_iva", "descuento_porcentaje", "descuento_descripcion", "notas", "partida_descripcion", "cantidad", "precio_unitario"],
        ["", "2026-04-15", cliente, tipo, condicion, vendedor, "Portal web corporativo", "COTIZADO", "MXN", "", "2026-05-30", "", "SI", "16", "", "", "Propuesta inicial", "Diseño UX/UI", "1", "25000"],
        ["", "2026-04-15", cliente, tipo, condicion, vendedor, "Portal web corporativo", "COTIZADO", "MXN", "", "2026-05-30", "", "SI", "16", "", "", "Propuesta inicial", "Desarrollo frontend", "1", "60000"],
      ],
    },
    {
      name: "Opciones",
      rows: [
        ["clientes", "tipo_cotizacion", "condicion_pago", "vendedor", "estatus", "moneda", "aplica_iva"],
        ...Array.from({
          length: Math.max(clientes.length, tipos.length, condiciones.length, vendedores.length, 3, 2),
        }).map((_, index) => [
          clientes[index]?.nombre ?? "",
          tipos[index]?.nombre ?? "",
          condiciones[index]?.nombre ?? "",
          vendedores[index]?.nombre ?? "",
          ["BORRADOR", "COTIZADO", "VENTA"][index] ?? "",
          ["MXN", "USD"][index] ?? "",
          ["SI", "NO"][index] ?? "",
        ]),
      ],
    },
  ]);
}
