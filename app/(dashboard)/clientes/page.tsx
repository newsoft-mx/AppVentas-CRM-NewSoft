import { prisma } from "@/lib/prisma";
import ClientesClient from "@/components/clientes/ClientesClient";
import { statsDeOrdenes } from "@/lib/clientes-stats";
import type { Metadata } from "next";
import { getServerSession } from "@/lib/server-session";
import { canManageClients } from "@/lib/session";
import { scopeClienteWhere } from "@/lib/access-control";

export const metadata: Metadata = { title: "Clientes" };
export const dynamic = "force-dynamic";

export default async function ClientesPage() {
  const session = await getServerSession();
  // Fetch en paralelo: clientes con stats + condiciones activas para el formulario
  const [clientes, condiciones] = await Promise.all([
    prisma.cliente.findMany({
      // Scoping por vendedor: el VENDEDOR solo ve SUS clientes (mismo criterio que la API).
      where: scopeClienteWhere(session, { activo: true }),
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
  const clientesSerializados = clientes.map(({ ordenes, ...c }) => ({
    ...c,
    created_at: c.created_at.toISOString(),
    updated_at: c.updated_at.toISOString(),
    stats: statsDeOrdenes(ordenes),
  }));

  return (
    <ClientesClient
      initialClientes={clientesSerializados}
      condiciones={condiciones}
      canWrite={canManageClients(session)}
    />
  );
}
