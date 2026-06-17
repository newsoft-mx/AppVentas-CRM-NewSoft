import { prisma } from "@/lib/prisma";
import ReportesClient from "@/components/reportes/ReportesClient";
import { netAmountMxn } from "@/lib/net-amounts";
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
import {
  buildDateOrFilters,
  emptyReporteFilters,
  parseNumberList,
  selectedMonths,
} from "@/lib/filter-utils";
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

  for (const o of actual) porMesActual[new Date(o.fecha_venta!).getUTCMonth()].total += netAmountMxn(o);
  for (const o of anterior) porMesAnterior[new Date(o.fecha_venta!).getUTCMonth()].total += netAmountMxn(o);

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
    cotizaciones_mxn: ordenes.filter((o) => o.estatus === "COTIZADO").reduce((s, o) => s + netAmountMxn(o), 0),
    ventas_mxn: ordenes.filter((o) => o.estatus === "VENTA").reduce((s, o) => s + netAmountMxn(o), 0),
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

  const map = new Map<string, TopClienteItem>();
  for (const o of ordenes) {
    const key = o.cliente.id;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        cliente_id: key,
        nombre: o.cliente.nombre,
        ordenes_totales: 1,
        ordenes_venta: o.estatus === "VENTA" ? 1 : 0,
        total_mxn: o.estatus === "VENTA" ? netAmountMxn(o) : 0,
      });
    } else {
      existing.ordenes_totales += 1;
      if (o.estatus === "VENTA") {
        existing.ordenes_venta += 1;
        existing.total_mxn += netAmountMxn(o);
      }
    }
  }

  return Array.from(map.values())
    .filter((c) => c.ordenes_venta > 0)
    .sort((a, b) => b.total_mxn - a.total_mxn)
    .slice(0, 10);
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
    current.total_mxn += netAmountMxn(orden);
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
      tipo_cotizacion: { select: { id: true, nombre: true } },
    },
  });

  const map = new Map<string, VentasTipoItem>();
  for (const orden of ordenes) {
    const key = orden.tipo_cotizacion.id;
    const current = map.get(key) ?? {
      tipo_id: key,
      tipo: orden.tipo_cotizacion.nombre,
      ordenes_venta: 0,
      total_mxn: 0,
    };
    current.ordenes_venta += 1;
    current.total_mxn += netAmountMxn(orden);
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

  const ticket_promedio_mxn =
    ventas.length > 0
      ? ventas.reduce((s, o) => s + netAmountMxn(o), 0) / ventas.length
      : 0;

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
      tiempo_promedio_cierre_dias,
      total_ventas: ventas.length,
      total_cotizadas: cotizadas.length,
    },
  };
}

interface PageProps {
  searchParams: Promise<{
    ano?: string | string[];
    "ano[]"?: string | string[];
    q?: string | string[];
    "q[]"?: string | string[];
    mes?: string | string[];
    "mes[]"?: string | string[];
  }>;
}

export default async function ReportesPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const session = await getServerSession();
  const filtros: FiltroReportes = {
    ...emptyReporteFilters(),
    ano: parseNumberList([sp.ano, sp["ano[]"]].filter(Boolean).flat()),
    q: parseNumberList([sp.q, sp["q[]"]].filter(Boolean).flat()).filter((q) => q >= 1 && q <= 4),
    mes: parseNumberList([sp.mes, sp["mes[]"]].filter(Boolean).flat()).filter((mes) => mes >= 1 && mes <= 12),
  };

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
