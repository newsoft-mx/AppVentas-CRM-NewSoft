import { prisma } from "@/lib/prisma";
import { serializeOrden } from "@/lib/serializers";
import OrdenDetalleClient from "@/components/ordenes/OrdenDetalleClient";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { OrdenDetalle } from "@/types/ordenes";
import { getServerSession } from "@/lib/server-session";
import { canAccessOrden, canMutateOrden, scopeClienteWhere } from "@/lib/access-control";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const orden = await prisma.ordenVenta.findUnique({
    where: { id },
    select: { folio: true, descripcion: true },
  });
  if (!orden) return { title: "Orden no encontrada" };
  return { title: `${orden.folio} — ${orden.descripcion}` };
}

export default async function OrdenDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getServerSession();
  const [orden, clientes, tipos, condiciones, vendedores, empresa] = await Promise.all([
    prisma.ordenVenta.findUnique({
      where: { id },
      include: {
        cliente: { select: { id: true, nombre: true, rfc: true, contacto: true, email: true, ciudad: true } },
        tipo_cotizacion: { select: { id: true, nombre: true } },
        condicion_pago: { select: { id: true, nombre: true } },
        vendedor: { select: { id: true, nombre: true } },
        partidas: { orderBy: { orden_display: "asc" } },
      },
    }),
    prisma.cliente.findMany({
      // Picker scopeado: el VENDEDOR solo ordena para sus clientes. El cliente de la
      // orden en edición siempre queda en scope (tiene esta orden, que es suya).
      where: scopeClienteWhere(session, { activo: true }),
      select: { id: true, nombre: true, rfc: true, condicion_pago_id: true },
      orderBy: { nombre: "asc" },
    }),
    prisma.tipoCotizacion.findMany({
      where: { activo: true },
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
    prisma.condicionComercial.findMany({
      where: { activo: true },
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
    prisma.vendedor.findMany({
      where: { activo: true },
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
    prisma.empresa.findFirst({ select: { tasa_iva: true } }),
  ]);

  if (!orden) notFound();
  if (!canAccessOrden(session, orden)) notFound();

  const tasaIvaDefault = empresa?.tasa_iva.toNumber() ?? 16;
  const serialized = serializeOrden(orden) as OrdenDetalle;

  return (
    <OrdenDetalleClient
      orden={serialized}
      clientes={clientes}
      tipos={tipos}
      condiciones={condiciones}
      vendedores={
        session?.rol === "VENDEDOR"
          ? vendedores.filter((vendedor) => vendedor.id === session.vendedorId)
          : vendedores
      }
      tasaIvaDefault={tasaIvaDefault}
      canWrite={canMutateOrden(session, orden)}
    />
  );
}
