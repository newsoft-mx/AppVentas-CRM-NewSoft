import { prisma } from "@/lib/prisma";
import VentasClient from "@/components/ordenes/VentasClient";
import { serializeOrden } from "@/lib/serializers";
import type { Metadata } from "next";
import type { OrdenResumen, FiltroOrdenes } from "@/types/ordenes";
import { wherePeriodoOrden } from "@/lib/filter-utils";
import { ORDENES_FILTROS } from "@/lib/ordenes-filtros";
import { filtrosIniciales } from "@/lib/filtros-servidor";
import type { ParamMap } from "@/lib/filtros-memoria";
import { getServerSession } from "@/lib/server-session";
import { canWrite } from "@/lib/session";
import { scopeOrdenWhere } from "@/lib/access-control";

export const metadata: Metadata = { title: "Ventas" };
export const dynamic = "force-dynamic";

// Construye el objeto `where` de Prisma a partir de los filtros
function buildWhere(filtros: FiltroOrdenes) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};

  if (filtros.estatus.length) where.estatus = { in: filtros.estatus };
  if (filtros.cliente_id.length) where.cliente_id = { in: filtros.cliente_id };
  if (filtros.tipo_cotizacion_id.length) where.tipo_cotizacion_id = { in: filtros.tipo_cotizacion_id };
  if (filtros.vendedor_id.length) where.vendedor_id = { in: filtros.vendedor_id };

  if (filtros.ano.length || filtros.q.length || filtros.mes.length) {
    where.OR = wherePeriodoOrden(filtros, "fecha_efectiva");
  }

  return where;
}


export default async function VentasPage({
  searchParams,
}: {
  searchParams: Promise<ParamMap>;
}) {
  const session = await getServerSession();
  // Filtros iniciales: URL > memoria de la pantalla > default. El códec vive en
  // lib/ordenes-filtros (antes el parser estaba copiado acá y el serializador en el cliente).
  const initialFiltros = await filtrosIniciales(ORDENES_FILTROS, await searchParams);

  // Cargar TODAS las órdenes (filtrado fine-grained se hace client-side)
  // Pero si hay filtros de fecha/estatus en URL los aplicamos en el servidor
  // para reducir carga inicial — el cliente re-filtra sin API call adicional
  const where = scopeOrdenWhere(session, buildWhere(initialFiltros));

  const [ordenes, tipos, vendedores] = await Promise.all([
    prisma.ordenVenta.findMany({
      where,
      include: {
        cliente: {
          select: {
            id: true,
            nombre: true,
            rfc: true,
            contacto: true,
            email: true,
            ciudad: true,
          },
        },
        tipo_cotizacion: { select: { id: true, nombre: true } },
        condicion_pago: { select: { id: true, nombre: true } },
        vendedor: { select: { id: true, nombre: true } },
      },
      orderBy: { created_at: "desc" },
    }),
    prisma.tipoCotizacion.findMany({
      where: { activo: true },
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
    prisma.vendedor.findMany({
      where: session?.rol === "VENDEDOR"
        ? { activo: true, id: session.vendedorId ?? "__sin-vendedor-asignado__" }
        : { activo: true },
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
  ]);

  const serialized = ordenes.map((o) =>
    serializeOrden({ ...o, partidas: [] })
  ) as OrdenResumen[];

  return (
    <VentasClient
      initialOrdenes={serialized}
      initialFiltros={initialFiltros}
      tipos={tipos.map((tipo) => ({ id: tipo.id, label: tipo.nombre }))}
      vendedores={vendedores.map((vendedor) => ({ id: vendedor.id, label: vendedor.nombre }))}
      canWrite={canWrite(session)}
    />
  );
}
