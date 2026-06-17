import { prisma } from "@/lib/prisma";
import VentasClient from "@/components/ordenes/VentasClient";
import { serializeOrden } from "@/lib/serializers";
import type { Metadata } from "next";
import type { OrdenResumen, FiltroOrdenes } from "@/types/ordenes";
import {
  buildDateOrFilters,
  emptyOrdenFilters,
  parseEstatusList,
  parseNumberList,
  parseStringList,
} from "@/lib/filter-utils";
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
    const ranges = buildDateOrFilters(filtros);
    where.OR = ranges.flatMap((range) => [
      { fecha_venta: range },
      { fecha_venta: null, created_at: range },
    ]);
  }

  return where;
}


interface SearchParams {
  ano?: string | string[];
  "ano[]"?: string | string[];
  q?: string | string[];
  "q[]"?: string | string[];
  mes?: string | string[];
  "mes[]"?: string | string[];
  estatus?: string | string[];
  "estatus[]"?: string | string[];
  cliente_id?: string | string[];
  "cliente_id[]"?: string | string[];
  tipo_cotizacion_id?: string | string[];
  "tipo_cotizacion_id[]"?: string | string[];
  vendedor_id?: string | string[];
  "vendedor_id[]"?: string | string[];
}

export default async function VentasPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const session = await getServerSession();
  // Leer filtros iniciales de la URL
  const initialFiltros: FiltroOrdenes = {
    ...emptyOrdenFilters(),
    ano: parseNumberList([sp.ano, sp["ano[]"]].filter(Boolean).flat()),
    q: parseNumberList([sp.q, sp["q[]"]].filter(Boolean).flat()).filter((q) => q >= 1 && q <= 4),
    mes: parseNumberList([sp.mes, sp["mes[]"]].filter(Boolean).flat()).filter((mes) => mes >= 1 && mes <= 12),
    estatus: parseEstatusList([sp.estatus, sp["estatus[]"]].filter(Boolean).flat()),
    cliente_id: parseStringList([sp.cliente_id, sp["cliente_id[]"]].filter(Boolean).flat()),
    tipo_cotizacion_id: parseStringList([sp.tipo_cotizacion_id, sp["tipo_cotizacion_id[]"]].filter(Boolean).flat()),
    vendedor_id: parseStringList([sp.vendedor_id, sp["vendedor_id[]"]].filter(Boolean).flat()),
  };

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
