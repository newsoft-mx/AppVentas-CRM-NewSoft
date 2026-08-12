import { prisma } from "@/lib/prisma";
import ReportesClient from "@/components/reportes/ReportesClient";
import { netAmountMxn, sumaNetaMxn, ticketPromedioMxn } from "@/lib/net-amounts";
import { rankingClientes } from "@/lib/ranking-clientes";
import type {
  FiltroReportes,
  ReportesInitialData,
  VentasMensualesData,
  MesVenta,
  PipelineData,
  TopClienteItem,
  VentasVendedorItem,
  VentasTipoItem,
  ConversionTipoItem,
  ReporteStats,
} from "@/types/reportes";
import { buildDateOrFilters, selectedMonths } from "@/lib/filter-utils";
import { REPORTES_FILTROS } from "@/lib/reportes-filtros";
import { filtrosIniciales } from "@/lib/filtros-servidor";
import type { ParamMap } from "@/lib/filtros-memoria";
import { getServerSession } from "@/lib/server-session";
import { scopeOrdenWhere } from "@/lib/access-control";
import type { SessionPayload } from "@/lib/session";

export const metadata = { title: "Reportes" };
export const dynamic = "force-dynamic";

const MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildWhere(filtros: FiltroReportes, session: SessionPayload | null): any {
  if (!filtros.ano.length && !filtros.q.length && !filtros.mes.length) return scopeOrdenWhere(session, {});
  const ranges = buildDateOrFilters(filtros);
  return scopeOrdenWhere(session, {
    OR: ranges.flatMap((range) => [
      { fecha_venta: range },
      { estatus: { not: "VENTA" }, fecha_venta: null, created_at: range },
    ]),
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildSalesWhere(filtros: FiltroReportes, session: SessionPayload | null, ano?: number): any {
  const filterWithYear = ano ? { ...filtros, ano: [ano] } : filtros;
  return scopeOrdenWhere(session, {
    estatus: "VENTA",
    OR: buildDateOrFilters(filterWithYear).map((range) => ({ fecha_venta: range })),
  });
}

async function fetchVentasMensuales(filtros: FiltroReportes, session: SessionPayload | null): Promise<VentasMensualesData> {
  const years = filtros.ano.length ? [...filtros.ano].sort((a, b) => b - a) : [new Date().getFullYear()];
  const ano = years[0];
  const anoComparativo = years[1] ?? ano - 1;
  const [actual, anterior] = await Promise.all([
    prisma.ordenVenta.findMany({
      where: buildSalesWhere(filtros, session, ano),
      select: { fecha_venta: true, moneda: true, tipo_cambio: true, subtotal_con_descuento: true },
    }),
    prisma.ordenVenta.findMany({
      where: buildSalesWhere(filtros, session, anoComparativo),
      select: { fecha_venta: true, moneda: true, tipo_cambio: true, subtotal_con_descuento: true },
    }),
  ]);

  const porMesActual = Array.from({ length: 12 }, (_, i) => ({ mes: i + 1, total: 0 }));
  const porMesAnterior = Array.from({ length: 12 }, (_, i) => ({ mes: i + 1, total: 0 }));

  // `?? 0`: una orden USD sin tipo de cambio no se puede sumar a pesos. Se omite en vez de
  // inventar una paridad 1:1, que es lo que hacía antes en silencio.
  for (const o of actual) porMesActual[new Date(o.fecha_venta!).getUTCMonth()].total += netAmountMxn(o) ?? 0;
  for (const o of anterior) porMesAnterior[new Date(o.fecha_venta!).getUTCMonth()].total += netAmountMxn(o) ?? 0;

  const visibleMonths = selectedMonths(filtros);
  const data: MesVenta[] = visibleMonths.map((month) => ({
    mes: month,
    nombre: MESES[month - 1],
    actual: porMesActual[month - 1]?.total ?? 0,
    anterior: porMesAnterior[month - 1]?.total ?? 0,
  }));

  return {
    data,
    ano_actual: ano,
    ano_anterior: anoComparativo,
    total_actual: data.reduce((s, d) => s + d.actual, 0),
    total_anterior: data.reduce((s, d) => s + d.anterior, 0),
  };
}

async function fetchPipeline(filtros: FiltroReportes, session: SessionPayload | null): Promise<PipelineData> {
  const ordenes = await prisma.ordenVenta.findMany({
    where: buildWhere(filtros, session),
    select: { estatus: true, moneda: true, tipo_cambio: true, subtotal_con_descuento: true },
  });

  return {
    borradores_count: ordenes.filter((o) => o.estatus === "BORRADOR").length,
    cotizaciones_count: ordenes.filter((o) => o.estatus === "COTIZADO").length,
    ventas_count: ordenes.filter((o) => o.estatus === "VENTA").length,
    cotizaciones_mxn: sumaNetaMxn(ordenes.filter((o) => o.estatus === "COTIZADO")).mxn,
    ventas_mxn: sumaNetaMxn(ordenes.filter((o) => o.estatus === "VENTA")).mxn,
    total_ordenes: ordenes.length,
  };
}

async function fetchTopClientes(filtros: FiltroReportes, session: SessionPayload | null): Promise<TopClienteItem[]> {
  const ordenes = await prisma.ordenVenta.findMany({
    where: buildWhere(filtros, session),
    select: {
      estatus: true,
      moneda: true,
      tipo_cambio: true,
      subtotal_con_descuento: true,
      cliente: { select: { id: true, nombre: true } },
    },
  });

  // Mismo helper que GET /api/reportes/top-clientes: este payload es el render inicial de esa
  // misma tabla, así que tienen que dar el mismo número por construcción, no por disciplina.
  return rankingClientes(ordenes).map((g) => ({
    cliente_id: g.cliente_id,
    nombre: g.nombre,
    ordenes_totales: g.ordenes_totales,
    ordenes_venta: g.ordenes_venta,
    total_mxn: g.facturado_mxn,
  }));
}

async function fetchVentasPorVendedor(filtros: FiltroReportes, session: SessionPayload | null): Promise<VentasVendedorItem[]> {
  const ordenes = await prisma.ordenVenta.findMany({
    where: buildSalesWhere(filtros, session),
    select: {
      moneda: true,
      tipo_cambio: true,
      subtotal_con_descuento: true,
      vendedor: { select: { id: true, nombre: true } },
    },
  });

  const map = new Map<string, VentasVendedorItem>();
  for (const orden of ordenes) {
    const key = orden.vendedor?.id ?? "sin-vendedor";
    const current = map.get(key) ?? {
      vendedor_id: orden.vendedor?.id ?? null,
      vendedor: orden.vendedor?.nombre ?? "Sin vendedor",
      ordenes_venta: 0,
      total_mxn: 0,
    };
    current.ordenes_venta += 1;
    current.total_mxn += netAmountMxn(orden) ?? 0;
    map.set(key, current);
  }

  return Array.from(map.values()).sort((a, b) => b.total_mxn - a.total_mxn);
}

async function fetchVentasPorTipo(filtros: FiltroReportes, session: SessionPayload | null): Promise<VentasTipoItem[]> {
  const ordenes = await prisma.ordenVenta.findMany({
    where: buildSalesWhere(filtros, session),
    select: {
      moneda: true,
      tipo_cambio: true,
      subtotal_con_descuento: true,
      tipo_cotizacion: { select: { id: true, nombre: true, color: true } },
    },
  });

  const map = new Map<string, VentasTipoItem>();
  for (const orden of ordenes) {
    const key = orden.tipo_cotizacion.id;
    const current = map.get(key) ?? {
      tipo_id: key,
      tipo: orden.tipo_cotizacion.nombre,
      color: orden.tipo_cotizacion.color,
      ordenes_venta: 0,
      total_mxn: 0,
    };
    current.ordenes_venta += 1;
    current.total_mxn += netAmountMxn(orden) ?? 0;
    map.set(key, current);
  }

  return Array.from(map.values()).sort((a, b) => b.total_mxn - a.total_mxn);
}

async function fetchConversionAndStats(filtros: FiltroReportes, session: SessionPayload | null): Promise<{ conversion: ConversionTipoItem[]; stats: ReporteStats }> {
  const ordenes = await prisma.ordenVenta.findMany({
    where: buildWhere(filtros, session),
    select: {
      estatus: true,
      moneda: true,
      tipo_cambio: true,
      subtotal_con_descuento: true,
      created_at: true,
      fecha_venta: true,
      tipo_cotizacion: { select: { id: true, nombre: true } },
    },
  });

  const tipoMap = new Map<string, { nombre: string; total: number; ventas: number; cotizadas: number }>();
  for (const o of ordenes) {
    const id = o.tipo_cotizacion.id;
    const existing = tipoMap.get(id);
    if (!existing) {
      tipoMap.set(id, {
        nombre: o.tipo_cotizacion.nombre,
        total: 1,
        ventas: o.estatus === "VENTA" ? 1 : 0,
        cotizadas: o.estatus === "COTIZADO" ? 1 : 0,
      });
    } else {
      existing.total += 1;
      if (o.estatus === "VENTA") existing.ventas += 1;
      if (o.estatus === "COTIZADO") existing.cotizadas += 1;
    }
  }

  const conversion: ConversionTipoItem[] = Array.from(tipoMap.entries())
    .map(([tipo_id, d]) => ({
      tipo_id,
      tipo: d.nombre,
      total: d.total,
      ventas: d.ventas,
      cotizadas: d.cotizadas,
      tasa: d.total > 0 ? Math.round((d.ventas / d.total) * 100) : 0,
    }))
    .sort((a, b) => b.tasa - a.tasa);

  const ventas = ordenes.filter((o) => o.estatus === "VENTA");
  const cotizadas = ordenes.filter((o) => o.estatus === "COTIZADO");

  const { promedio: ticket_promedio_mxn, sin_tipo_cambio: ticket_sin_tipo_cambio } =
    ticketPromedioMxn(ventas);

  const ventasConFecha = ventas.filter((o) => o.fecha_venta != null);
  let tiempo_promedio_cierre_dias: number | null = null;
  if (ventasConFecha.length > 0) {
    const totalDias = ventasConFecha.reduce((s, o) => {
      const dias =
        (new Date(o.fecha_venta!).getTime() - new Date(o.created_at).getTime()) /
        (1000 * 60 * 60 * 24);
      return s + Math.max(0, Math.round(dias));
    }, 0);
    tiempo_promedio_cierre_dias = Math.round(totalDias / ventasConFecha.length);
  }

  return {
    conversion,
    stats: {
      ticket_promedio_mxn,
      ticket_sin_tipo_cambio,
      tiempo_promedio_cierre_dias,
      total_ventas: ventas.length,
      total_cotizadas: cotizadas.length,
    },
  };
}

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<ParamMap>;
}) {
  const session = await getServerSession();
  // Hidrata con la precedencia URL > cookie > default, igual que el resto de los listados.
  const filtros = await filtrosIniciales(REPORTES_FILTROS, await searchParams);

  const [ventasMensuales, pipeline, topClientes, ventasPorVendedor, ventasPorTipo, { conversion, stats }] = await Promise.all([
    fetchVentasMensuales(filtros, session),
    fetchPipeline(filtros, session),
    fetchTopClientes(filtros, session),
    fetchVentasPorVendedor(filtros, session),
    fetchVentasPorTipo(filtros, session),
    fetchConversionAndStats(filtros, session),
  ]);

  const initialData: ReportesInitialData = {
    ventasMensuales,
    pipeline,
    topClientes,
    ventasPorVendedor,
    ventasPorTipo,
    conversion,
    stats,
  };

  return (
    <div className="p-6">
      <ReportesClient initialData={initialData} initialFiltros={filtros} />
    </div>
  );
}
