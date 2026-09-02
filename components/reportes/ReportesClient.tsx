"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useUrlFilters } from "@/hooks/useUrlFilters";
import { BarChart3 } from "lucide-react";
import FiltrosReportes from "./FiltrosReportes";
import { etiquetaPeriodo } from "@/lib/etiqueta-periodo-reportes";
import { horaAhora } from "@/lib/utils";
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
import { REPORTES_FILTROS, serializeReporteFiltros } from "@/lib/reportes-filtros";
import { formatMXNEntero as formatMXN } from "@/lib/utils";

interface Props {
  initialData: ReportesInitialData;
  initialFiltros: FiltroReportes;
  /** Hora en que el server generó estos datos (ver el comentario en la página). */
  generadoEn: string;
}

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export default function ReportesClient({ initialData, initialFiltros, generadoEn }: Props) {
  // Filtros persistentes en la URL (mecanismo compartido — pilar 3)
  const [filtros, setFiltros, isPending] = useUrlFilters(initialFiltros, REPORTES_FILTROS);
  const [ventasMensuales, setVentasMensuales] = useState<VentasMensualesData>(initialData.ventasMensuales);
  const [pipeline, setPipeline] = useState<PipelineData>(initialData.pipeline);
  const [topClientes, setTopClientes] = useState<TopClienteItem[]>(initialData.topClientes);
  const [ventasPorVendedor, setVentasPorVendedor] = useState<VentasVendedorItem[]>(initialData.ventasPorVendedor);
  const [ventasPorTipo, setVentasPorTipo] = useState<VentasTipoItem[]>(initialData.ventasPorTipo);
  const [stats, setStats] = useState<ReporteStats>(initialData.stats);
  const [loading, setLoading] = useState(false);
  // Hora del dato: arranca con la que estampó el SERVER —cuando generó estos datos— y se
  // actualiza en cada recarga. No se calcula en el cliente al montar: además de romper la
  // hidratación, diría la hora en que se abrió la pantalla, no la del dato.
  const [actualizado, setActualizado] = useState(generadoEn);
  const [falloCarga, setFalloCarga] = useState(false);

  // ── Re-fetch on filter change ─────────────────────────────────
  const refetch = useCallback(async (f: FiltroReportes) => {
    const qs = serializeReporteFiltros(f);
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
      setActualizado(horaAhora());
      setFalloCarga(false);
    } catch {
      // Antes acá había un `catch` vacío con el comentario "silently keep previous data on
      // error". El resultado era el peor de los mundos: la pantalla se quedaba con los números
      // del filtro ANTERIOR bajo el filtro NUEVO, sin ninguna señal. Alguien podía leer las
      // ventas de julio creyendo que eran las de agosto.
      //
      // Se conservan los datos viejos —borrarlos no ayuda a nadie— pero se DICE que están
      // viejos y de cuándo son.
      setFalloCarga(true);
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
          {/* Qué se está mirando, en palabras y derivado de los MISMOS filtros que se
              consultaron. Es el patrón del reporte de embudo, que hoy es la única pantalla
              de la app que declara su período. */}
          <p className="text-sm text-gray-500 mt-0.5">
            {etiquetaPeriodo(filtros)}
            {actualizado && <span className="text-gray-500"> · actualizado {actualizado}</span>}
          </p>
        </div>
        <FiltrosReportes filtros={filtros} onChange={setFiltros} />
      </div>

      {/* Un fallo de carga se DICE. Los números que quedan en pantalla son los del filtro
          anterior, así que el aviso aclara justamente eso: el problema no es que falten
          datos, es que los que se ven no corresponden a lo que se pidió. */}
      {falloCarga && (
        <div
          role="status"
          className="flex flex-wrap items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-700"
        >
          <span>
            No se pudieron cargar los datos de <b>{etiquetaPeriodo(filtros)}</b>. Las cifras de
            abajo son las de la consulta anterior.
          </span>
          <button
            type="button"
            onClick={() => refetch(filtros)}
            className="rounded-md border border-orange-300 px-2 py-0.5 text-xs font-semibold hover:bg-orange-100"
          >
            Reintentar
          </button>
        </div>
      )}

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
