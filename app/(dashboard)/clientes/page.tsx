import { prisma } from "@/lib/prisma";
import ClientesClient from "@/components/clientes/ClientesClient";
import { netAmount, netAmountMxn } from "@/lib/net-amounts";
import type { Metadata } from "next";
import { getServerSession } from "@/lib/server-session";
import { canManageClients } from "@/lib/session";

export const metadata: Metadata = { title: "Clientes" };
export const dynamic = "force-dynamic";

export default async function ClientesPage() {
  const session = await getServerSession();
  // Fetch en paralelo: clientes con stats + condiciones activas para el formulario
  const [clientes, condiciones] = await Promise.all([
    prisma.cliente.findMany({
      where: { activo: true },
      include: {
        condicion_pago: {
          select: { id: true, nombre: true, dias_credito: true },
        },
        ordenes: {
          select: { moneda: true, tipo_cambio: true, subtotal_con_descuento: true },
        },
      },
      orderBy: { nombre: "asc" },
    }),
    prisma.condicionComercial.findMany({
      where: { activo: true },
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true, dias_credito: true },
    }),
  ]);

  // Serializar y agregar stats en el servidor
  const clientesSerializados = clientes.map(({ ordenes, ...c }) => {
    const mxnOrdenes = ordenes.filter((o) => o.moneda === "MXN");
    const usdOrdenes = ordenes.filter((o) => o.moneda === "USD");
    return {
      ...c,
      created_at: c.created_at.toISOString(),
      updated_at: c.updated_at.toISOString(),
      stats: {
        num_ordenes: ordenes.length,
        total_mxn: mxnOrdenes.reduce((s, o) => s + netAmount(o), 0),
        total_usd: usdOrdenes.reduce((s, o) => s + netAmount(o), 0),
        grand_total_mxn: ordenes.reduce((s, o) => s + netAmountMxn(o), 0),
      },
    };
  });

  return (
    <ClientesClient
      initialClientes={clientesSerializados}
      condiciones={condiciones}
      canWrite={canManageClients(session)}
    />
  );
}
