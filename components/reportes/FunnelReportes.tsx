"use client";

import { useCallback, useEffect, useState } from "react";
import { TrendingUp, Trophy, XCircle, Activity } from "lucide-react";

interface Vendedor {
  id: string;
  nombre: string;
}
interface FunnelData {
  total: number;
  etapas: { stage_id: string; nombre: string; count: number; conversion: number }[];
  ganados: number;
  perdidos: number;
  tasa_cierre: number;
}
interface ResultadosData {
  total: number;
  ganados: number;
  perdidos: number;
  tasa_ganados: number;
  por_razon: { razon: string; count: number }[];
}
interface AnatItem {
  count: number;
  avg_dias: number;
  por_tipo: Record<string, number>;
}
interface AnatData {
  ganados: AnatItem;
  perdidos: AnatItem;
}

const PERIODOS: { value: string; label: string }[] = [
  { value: "semana", label: "Última semana" },
  { value: "mes", label: "Último mes" },
  { value: "semestre", label: "Último semestre" },
];

// LLAMADA se presenta como "Reunión/Llamada" (decisión de negocio).
const TIPOS: { key: string; label: string }[] = [
  { key: "LLAMADA", label: "Reunión/Llamada" },
  { key: "EMAIL", label: "Email" },
  { key: "WHATSAPP", label: "WhatsApp" },
  { key: "NOTA", label: "Nota" },
];

export default function FunnelReportes({
  puedeElegir,
  vendedores,
}: {
  puedeElegir: boolean;
  vendedores: Vendedor[];
}) {
  const [periodo, setPeriodo] = useState("mes");
  const [vendedor, setVendedor] = useState(""); // "" = todo el equipo (agregado)
  const [funnel, setFunnel] = useState<FunnelData | null>(null);
  const [resultados, setResultados] = useState<ResultadosData | null>(null);
  const [anatomia, setAnatomia] = useState<AnatData | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    setCargando(true);
    setError("");
    const qs = new URLSearchParams({ periodo });
    if (vendedor) qs.set("vendedor", vendedor);
    try {
      const [f, r, a] = await Promise.all([
        fetch(`/api/reportes/funnel?${qs}`).then((res) => (res.ok ? res.json() : Promise.reject())),
        fetch(`/api/reportes/resultados?${qs}`).then((res) => (res.ok ? res.json() : Promise.reject())),
        fetch(`/api/reportes/anatomia?${qs}`).then((res) => (res.ok ? res.json() : Promise.reject())),
      ]);
      setFunnel(f);
      setResultados(r);
      setAnatomia(a);
    } catch {
      setError("No se pudieron cargar los reportes. Intentá de nuevo.");
    } finally {
      setCargando(false);
    }
  }, [periodo, vendedor]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const maxRazon = resultados?.por_razon[0]?.count ?? 1;

  return (
    <div className="space-y-6">
      {/* Encabezado + filtros */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Reportes de Funnel</h1>
          <p className="text-sm text-gray-500">Conversión, resultados y anatomía del pipeline</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value)}
            className="rounded-lg border border-surface-border bg-white px-3 py-2 text-sm text-navy outline-none focus:border-orange"
          >
            {PERIODOS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
          {puedeElegir && (
            <select
              value={vendedor}
              onChange={(e) => setVendedor(e.target.value)}
              className="rounded-lg border border-surface-border bg-white px-3 py-2 text-sm text-navy outline-none focus:border-orange"
            >
              <option value="">Todo el equipo</option>
              {vendedores.map((v) => (
                <option key={v.id} value={v.id}>{v.nombre}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {cargando ? (
        <p className="py-12 text-center text-sm text-gray-400">Cargando reportes…</p>
      ) : (
        <>
          {/* ── Bloque 1: Embudo de conversión ── */}
          <section className="rounded-xl border border-surface-border bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <TrendingUp size={18} className="text-orange" />
              <h2 className="text-sm font-bold uppercase tracking-wide text-navy">Embudo de conversión</h2>
              <span className="ml-auto text-xs text-gray-400">
                {funnel?.total ?? 0} deals · tasa de cierre {funnel?.tasa_cierre ?? 0}%
              </span>
            </div>
            {!funnel || funnel.total === 0 ? (
              <p className="py-6 text-center text-sm text-gray-400">Sin deals en el periodo.</p>
            ) : (
              <div className="space-y-2">
                {funnel.etapas.map((e, i) => (
                  <div key={e.stage_id} className="flex items-center gap-3">
                    <span className="w-32 shrink-0 truncate text-xs font-medium text-gray-600">{e.nombre}</span>
                    <div className="relative h-7 flex-1 overflow-hidden rounded-md bg-gray-100">
                      <div
                        className="flex h-full items-center rounded-md bg-navy px-2 text-xs font-semibold text-white transition-all"
                        style={{ width: `${funnel.total > 0 ? Math.max(6, (e.count / funnel.total) * 100) : 0}%` }}
                      >
                        {e.count}
                      </div>
                    </div>
                    <span className="w-16 shrink-0 text-right text-xs text-gray-400">
                      {i === 0 ? "—" : `${e.conversion}%`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── Bloque 2: Resultados (ganados vs perdidos) ── */}
          <section className="rounded-xl border border-surface-border bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <Trophy size={18} className="text-orange" />
              <h2 className="text-sm font-bold uppercase tracking-wide text-navy">Resultados</h2>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-lg bg-emerald-50 p-4 text-center">
                <p className="text-2xl font-bold text-emerald-700">{resultados?.ganados ?? 0}</p>
                <p className="text-xs font-medium text-emerald-600">Ganados</p>
              </div>
              <div className="rounded-lg bg-red-50 p-4 text-center">
                <p className="text-2xl font-bold text-red-700">{resultados?.perdidos ?? 0}</p>
                <p className="text-xs font-medium text-red-600">Perdidos</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-4 text-center">
                <p className="text-2xl font-bold text-navy">{resultados?.tasa_ganados ?? 0}%</p>
                <p className="text-xs font-medium text-gray-500">Tasa de ganados</p>
              </div>
            </div>
            {resultados && resultados.por_razon.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Razones de pérdida</p>
                <div className="space-y-1.5">
                  {resultados.por_razon.map((r) => (
                    <div key={r.razon} className="flex items-center gap-2">
                      <span className="w-40 shrink-0 truncate text-xs text-gray-600">{r.razon}</span>
                      <div className="h-4 flex-1 overflow-hidden rounded bg-gray-100">
                        <div className="h-full rounded bg-red-400" style={{ width: `${(r.count / maxRazon) * 100}%` }} />
                      </div>
                      <span className="w-8 shrink-0 text-right text-xs font-medium text-gray-500">{r.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* ── Bloque 3: Anatomía de conversión (ganado vs perdido) ── */}
          <section className="rounded-xl border border-surface-border bg-white p-5 shadow-sm">
            <div className="mb-1 flex items-center gap-2">
              <Activity size={18} className="text-orange" />
              <h2 className="text-sm font-bold uppercase tracking-wide text-navy">Anatomía de conversión</h2>
            </div>
            <p className="mb-4 text-xs text-gray-400">Promedio por deal — qué llevó ganar vs perder</p>
            {!anatomia || (anatomia.ganados.count === 0 && anatomia.perdidos.count === 0) ? (
              <p className="py-6 text-center text-sm text-gray-400">Sin deals cerrados en el periodo.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-surface-border text-xs uppercase tracking-wide text-gray-400">
                      <th className="py-2 text-left font-semibold">Métrica (promedio/deal)</th>
                      <th className="py-2 text-right font-semibold text-emerald-600">Ganados ({anatomia.ganados.count})</th>
                      <th className="py-2 text-right font-semibold text-red-500">Perdidos ({anatomia.perdidos.count})</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-border">
                    {TIPOS.map((t) => (
                      <tr key={t.key}>
                        <td className="py-2 text-gray-600">{t.label}</td>
                        <td className="py-2 text-right font-medium text-navy">{anatomia.ganados.por_tipo[t.key] ?? 0}</td>
                        <td className="py-2 text-right font-medium text-navy">{anatomia.perdidos.por_tipo[t.key] ?? 0}</td>
                      </tr>
                    ))}
                    <tr className="bg-gray-50">
                      <td className="py-2 font-semibold text-gray-700">Días al cierre</td>
                      <td className="py-2 text-right font-semibold text-navy">{anatomia.ganados.avg_dias}</td>
                      <td className="py-2 text-right font-semibold text-navy">{anatomia.perdidos.avg_dias}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
