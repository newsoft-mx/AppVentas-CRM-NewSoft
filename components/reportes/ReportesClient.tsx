"use client";

import { useState, useEffect, useTransition, useCallback, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { BarChart3 } from "lucide-react";
import FiltrosReportes from "./FiltrosReportes";
import GraficoVentasMensuales from "./GraficoVentasMensuales";
import GraficoVentasPorTipo from "./GraficoVentasPorTipo";
import TarjetasVentasPorTipo from "./TarjetasVentasPorTipo";
import TablaTopClientes from "./TablaTopClientes";
import TablaVentasVendedor from "./TablaVentasVendedor";
import type {
  FiltroReportes,
  ReportesInitialData,
  VentasMensualesData,
  PipelineData,
  TopClienteItem,
  VentasVendedorItem,
  VentasTipoItem,
  ConversionTipoItem,
  ReporteStats,
} from "@/types/reportes";
import { appendArrayParams } from "@/lib/filter-utils";
import { formatMXNEntero as formatMXN } from "@/lib/utils";

interface Props {
  initialData: ReportesInitialData;
  initialFiltros: FiltroReportes;
}

function buildQS(f: FiltroReportes) {
  const p = new URLSearchParams();
  appendArrayParams(p, "ano", f.ano);
  appendArrayParams(p, "q", f.q);
  appendArrayParams(p, "mes", f.mes);
  return p.toString();
}

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export default function ReportesClient({ initialData, initialFiltros }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const [filtros, setFiltros] = useState<FiltroReportes>(initialFiltros);
  const [ventasMensuales, setVentasMensuales] = useState<VentasMensualesData>(initialData.ventasMensuales);
  const [pipeline, setPipeline] = useState<PipelineData>(initialData.pipeline);
  const [topClientes, setTopClientes] = useState<TopClienteItem[]>(initialData.topClientes);
  const [ventasPorVendedor, setVentasPorVendedor] = useState<VentasVendedorItem[]>(initialData.ventasPorVendedor);
  const [ventasPorTipo, setVentasPorTipo] = useState<VentasTipoItem[]>(initialData.ventasPorTipo);
  const [stats, setStats] = useState<ReporteStats>(initialData.stats);
  const [loading, setLoading] = useState(false);

  // ── URL sync ──────────────────────────────────────────────────
  useEffect(() => {
    const qs = buildQS(filtros);
    const url = qs ? `${pathname}?${qs}` : pathname;
    startTransition(() => router.replace(url));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtros]);

  // ── Re-fetch on filter change ─────────────────────────────────
  const refetch = useCallback(async (f: FiltroReportes) => {
    const qs = buildQS(f);
    const base = (path: string) => `${path}${qs ? `?${qs}` : ""}`;

    setLoading(true);
    try {
      const [vm, pl, tc, vv, vt, cv] = await Promise.all([
        fetchJSON<VentasMensualesData>(base("/api/reportes/ventas-mensuales")),
        fetchJSON<PipelineData>(base("/api/reportes/pipeline")),
        fetchJSON<TopClienteItem[]>(base("/api/reportes/top-clientes")),
        fetchJSON<VentasVendedorItem[]>(base("/api/reportes/ventas-vendedor")),
        fetchJSON<VentasTipoItem[]>(base("/api/reportes/ventas-tipo")),
        fetchJSON<{ conversion: ConversionTipoItem[]; stats: ReporteStats }>(base("/api/reportes/conversion")),
      ]);
      setVentasMensuales(vm);
      setPipeline(pl);
      setTopClientes(tc);
      setVentasPorVendedor(vv);
      setVentasPorTipo(vt);
      setStats(cv.stats);
    } catch {
      // silently keep previous data on error
    } finally {
      setLoading(false);
    }
  }, []);

  // Trigger fetch when filtros change (skip on initial render — initial data already loaded)
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    refetch(filtros);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtros]);

  return (
    <div className={`space-y-6 transition-opacity duration-150 ${loading || isPending ? "opacity-60 pointer-events-none" : ""}`}>

      {/* ── Header + Filtros ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Reportes</h1>
          <p className="text-sm text-gray-500 mt-0.5">Análisis de ventas y rendimiento comercial</p>
        </div>
        <FiltrosReportes filtros={filtros} onChange={setFiltros} />
      </div>

      <div className="rounded-xl border border-surface-border bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-5 md:flex-row md:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-green-100 text-green-600">
              <BarChart3 size={24} />
            </div>
            <div className="min-w-0">
              <p className="break-words text-xl font-bold leading-tight text-green-600 sm:text-2xl">
                {formatMXN(pipeline.ventas_mxn)} MXN
              </p>
              <p className="mt-0.5 text-sm text-navy">Ventas totales · sin IVA</p>
            </div>
          </div>

          <div className="hidden h-12 w-px bg-surface-border md:block" />

          <div className="grid grid-cols-2 gap-4 text-center sm:gap-6 md:text-left">
            <div>
              <p className="text-lg font-bold text-green-600">{stats.total_ventas}</p>
              <p className="text-xs text-gray-500 sm:text-sm">Venta</p>
            </div>
            <div>
              <p className="text-lg font-bold text-blue-600">{stats.total_cotizadas}</p>
              <p className="text-xs text-gray-500 sm:text-sm">Cotización</p>
            </div>
          </div>
        </div>
      </div>

      <TarjetasVentasPorTipo data={ventasPorTipo} />

      {/* ── Charts row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <GraficoVentasMensuales
            data={ventasMensuales.data}
            anoActual={ventasMensuales.ano_actual}
            anoAnterior={ventasMensuales.ano_anterior}
          />
        </div>
        <GraficoVentasPorTipo data={ventasPorTipo} />
      </div>

      {/* ── Tables row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TablaTopClientes data={topClientes} />
        <TablaVentasVendedor data={ventasPorVendedor} />
      </div>
    </div>
  );
}
