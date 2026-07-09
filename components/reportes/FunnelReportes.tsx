"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowUp, ArrowDown } from "lucide-react";

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
interface Datos {
  funnel: FunnelData;
  resultados: ResultadosData;
  anatomia: AnatData;
}

const PERIODOS: { value: string; label: string }[] = [
  { value: "hoy", label: "Hoy" },
  { value: "semana", label: "Semana" },
  { value: "mes", label: "Mes" },
  { value: "semestre", label: "Semestre" },
  { value: "año", label: "Año" },
  { value: "custom", label: "Personalizado…" },
];

const TIPOS: { key: string; label: string }[] = [
  { key: "LLAMADA", label: "Reunión/Llamada" },
  { key: "EMAIL", label: "Email" },
  { key: "WHATSAPP", label: "WhatsApp" },
  { key: "NOTA", label: "Nota" },
];

const iso = (d: Date) => d.toISOString().slice(0, 10);
const DIA = 86_400_000;
const menosDias = (d: Date, n: number) => new Date(d.getTime() - n * DIA);
const menosMeses = (d: Date, m: number) => {
  const x = new Date(d);
  x.setMonth(x.getMonth() - m);
  return x;
};

// Rango actual + rango anterior equivalente (para anclar cada KPI con su delta).
function rangos(preset: string, desde: string, hasta: string) {
  const hoy = new Date();
  if (preset === "custom") {
    if (!desde) return null;
    const d0 = new Date(`${desde}T00:00:00`);
    const d1 = hasta ? new Date(`${hasta}T00:00:00`) : hoy;
    const len = Math.max(1, Math.round((d1.getTime() - d0.getTime()) / DIA) + 1);
    return {
      actual: { desde, hasta: hasta || iso(hoy) },
      anterior: { desde: iso(menosDias(d0, len)), hasta: iso(menosDias(d0, 1)) },
    };
  }
  if (preset === "hoy") {
    return {
      actual: { desde: iso(hoy), hasta: iso(hoy) },
      anterior: { desde: iso(menosDias(hoy, 1)), hasta: iso(menosDias(hoy, 1)) },
    };
  }
  if (preset === "semana") {
    return {
      actual: { desde: iso(menosDias(hoy, 7)), hasta: iso(hoy) },
      anterior: { desde: iso(menosDias(hoy, 14)), hasta: iso(menosDias(hoy, 7)) },
    };
  }
  if (preset === "semestre") {
    return {
      actual: { desde: iso(menosMeses(hoy, 6)), hasta: iso(hoy) },
      anterior: { desde: iso(menosMeses(hoy, 12)), hasta: iso(menosMeses(hoy, 6)) },
    };
  }
  if (preset === "año") {
    // Año calendario actual (1-ene → hoy); anterior = mismo tramo del año pasado.
    const inicio = new Date(hoy.getFullYear(), 0, 1);
    const inicioPrev = new Date(hoy.getFullYear() - 1, 0, 1);
    const hoyPrev = new Date(hoy.getFullYear() - 1, hoy.getMonth(), hoy.getDate());
    return {
      actual: { desde: iso(inicio), hasta: iso(hoy) },
      anterior: { desde: iso(inicioPrev), hasta: iso(hoyPrev) },
    };
  }
  return {
    actual: { desde: iso(menosMeses(hoy, 1)), hasta: iso(hoy) },
    anterior: { desde: iso(menosMeses(hoy, 2)), hasta: iso(menosMeses(hoy, 1)) },
  };
}

async function traer(rango: { desde: string; hasta: string }, vendedor: string): Promise<Datos> {
  const qs = new URLSearchParams(rango);
  if (vendedor) qs.set("vendedor", vendedor);
  const [funnel, resultados, anatomia] = await Promise.all([
    fetch(`/api/reportes/funnel?${qs}`).then((r) => (r.ok ? r.json() : Promise.reject())),
    fetch(`/api/reportes/resultados?${qs}`).then((r) => (r.ok ? r.json() : Promise.reject())),
    fetch(`/api/reportes/anatomia?${qs}`).then((r) => (r.ok ? r.json() : Promise.reject())),
  ]);
  return { funnel, resultados, anatomia };
}

// ── Scorecard: número grande + ancla (delta vs período anterior) ──
function Scorecard({
  label,
  value,
  suffix,
  delta,
  mejorSiSube = true,
}: {
  label: string;
  value: string | number;
  suffix?: string;
  delta: number | null; // puntos/porcentaje vs período anterior
  mejorSiSube?: boolean;
}) {
  const bueno = delta !== null && (mejorSiSube ? delta > 0 : delta < 0);
  const malo = delta !== null && (mejorSiSube ? delta < 0 : delta > 0);
  const color = bueno ? "text-emerald-600" : malo ? "text-red-600" : "text-gray-400";
  const Icono = delta !== null && delta >= 0 ? ArrowUp : ArrowDown;
  return (
    <div className="rounded-xl border border-surface-border bg-white p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 text-3xl font-bold tracking-tight text-navy">
        {value}
        {suffix && <span className="text-lg font-semibold text-gray-400">{suffix}</span>}
      </p>
      {delta !== null && delta !== 0 ? (
        <p className={`mt-1 flex items-center gap-0.5 text-xs font-medium ${color}`}>
          <Icono size={12} />
          {Math.abs(delta)}
          {suffix === "%" ? " pts" : "%"} vs período anterior
        </p>
      ) : (
        <p className="mt-1 text-xs text-gray-400">sin cambio vs anterior</p>
      )}
    </div>
  );
}

export default function FunnelReportes({
  puedeElegir,
  vendedores,
}: {
  puedeElegir: boolean;
  vendedores: Vendedor[];
}) {
  const [preset, setPreset] = useState("mes");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [vendedor, setVendedor] = useState("");
  const [act, setAct] = useState<Datos | null>(null);
  const [prev, setPrev] = useState<Datos | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [actualizado, setActualizado] = useState("");

  const cargar = useCallback(async () => {
    const r = rangos(preset, desde, hasta);
    if (!r) return; // custom sin fecha "desde" aún
    setCargando(true);
    setError("");
    try {
      const [a, p] = await Promise.all([traer(r.actual, vendedor), traer(r.anterior, vendedor)]);
      setAct(a);
      setPrev(p);
      setActualizado(new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }));
    } catch {
      setError("No se pudieron cargar los reportes. Intentá de nuevo.");
    } finally {
      setCargando(false);
    }
  }, [preset, desde, hasta, vendedor]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Delta en puntos (para %) o en % (para conteos), según la métrica.
  const deltaPct = (a: number, b: number) => (b === 0 ? (a > 0 ? 100 : 0) : Math.round(((a - b) / b) * 100));
  const deltaPts = (a: number, b: number) => Math.round(a - b);

  const f = act?.funnel;
  const rz = act?.resultados;
  const an = act?.anatomia;
  const razonMax = rz?.por_razon[0]?.count ?? 1;

  return (
    <div className="space-y-6">
      {/* Barra de filtros — SIEMPRE visible (sticky) */}
      <div className="sticky top-0 z-10 -mx-4 border-b border-surface-border bg-surface/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-lg font-bold text-navy">Reportes de Funnel</h1>
            <p className="text-xs text-gray-400">
              {actualizado ? `Actualizado ${actualizado}` : "Conversión, resultados y anatomía"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {puedeElegir && (
              <select
                value={vendedor}
                onChange={(e) => setVendedor(e.target.value)}
                className="rounded-lg border border-surface-border bg-white px-3 py-1.5 text-sm text-navy outline-none focus:border-orange"
              >
                <option value="">Todo el equipo</option>
                {vendedores.map((v) => (
                  <option key={v.id} value={v.id}>{v.nombre}</option>
                ))}
              </select>
            )}
            {/* Cada rango como botón visible (sin desplegar), incluido Personalizado */}
            <div className="flex flex-wrap items-center gap-0.5 rounded-lg bg-gray-100 p-0.5">
              {PERIODOS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPreset(p.value)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    preset === p.value ? "bg-white text-navy shadow-sm" : "text-gray-500 hover:text-navy"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {preset === "custom" && (
              <div className="flex items-center gap-1.5">
                <input type="date" value={desde} max={hasta || undefined} onChange={(e) => setDesde(e.target.value)} className="rounded-lg border border-surface-border bg-white px-2 py-1.5 text-sm text-navy outline-none focus:border-orange" />
                <span className="text-xs text-gray-400">a</span>
                <input type="date" value={hasta} min={desde || undefined} onChange={(e) => setHasta(e.target.value)} className="rounded-lg border border-surface-border bg-white px-2 py-1.5 text-sm text-navy outline-none focus:border-orange" />
              </div>
            )}
          </div>
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {cargando || !f || !rz || !an ? (
        <p className="py-16 text-center text-sm text-gray-400">Cargando reportes…</p>
      ) : (
        <>
          {/* NIVEL 1 — ¿cómo venimos? (KPIs con ancla) */}
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-400">¿Cómo venimos?</p>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Scorecard label="Tasa de cierre" value={f.tasa_cierre} suffix="%" delta={prev ? deltaPts(f.tasa_cierre, prev.funnel.tasa_cierre) : null} />
              <Scorecard label="Ganados" value={rz.ganados} delta={prev ? deltaPct(rz.ganados, prev.resultados.ganados) : null} />
              <Scorecard label="Perdidos" value={rz.perdidos} delta={prev ? deltaPct(rz.perdidos, prev.resultados.perdidos) : null} mejorSiSube={false} />
              <Scorecard label="Días al ganar" value={an.ganados.avg_dias} delta={prev ? deltaPct(an.ganados.avg_dias, prev.anatomia.ganados.avg_dias) : null} mejorSiSube={false} />
            </div>
          </div>

          {/* NIVEL 2 — ¿hacia dónde vamos? / ¿qué lo explica? (embudo + razones) */}
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-400">¿Dónde se convierte y dónde se fuga?</p>
            <div className="grid gap-6 lg:grid-cols-5">
              {/* Embudo */}
              <section className="rounded-xl border border-surface-border bg-white p-5 lg:col-span-3">
                <div className="mb-3 flex items-baseline justify-between">
                  <h2 className="text-sm font-semibold text-navy">Embudo de conversión</h2>
                  <span className="text-xs text-gray-400">{f.total} deals</span>
                </div>
                {f.total === 0 ? (
                  <p className="py-6 text-center text-sm text-gray-400">Sin deals en el periodo.</p>
                ) : (
                  <div className="space-y-1.5">
                    {f.etapas.map((e, i) => {
                      const prevCount = i === 0 ? f.total : f.etapas[i - 1].count;
                      const drop = prevCount - e.count;
                      const w = f.total > 0 ? Math.max(4, (e.count / f.total) * 100) : 0;
                      return (
                        <div key={e.stage_id} className="flex items-center gap-3">
                          <span className="w-28 shrink-0 truncate text-xs text-gray-500">{e.nombre}</span>
                          <div className="h-6 flex-1 rounded bg-gray-100">
                            <div className="flex h-full items-center rounded bg-navy px-2 text-xs font-semibold text-white" style={{ width: `${w}%` }}>
                              {e.count}
                            </div>
                          </div>
                          <span className="w-16 shrink-0 text-right text-xs tabular-nums">
                            {i === 0 ? (
                              <span className="text-gray-300">base</span>
                            ) : (
                              <span className={drop > 0 ? "text-gray-500" : "text-gray-400"}>
                                {e.conversion}%
                              </span>
                            )}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* Razones de pérdida — dónde está la fuga */}
              <section className="rounded-xl border border-surface-border bg-white p-5 lg:col-span-2">
                <div className="mb-3 flex items-baseline justify-between">
                  <h2 className="text-sm font-semibold text-navy">Por qué se pierden</h2>
                  <span className="text-xs text-gray-400">{rz.perdidos} perdidos</span>
                </div>
                {rz.por_razon.length === 0 ? (
                  <p className="py-6 text-center text-sm text-gray-400">Sin pérdidas en el periodo.</p>
                ) : (
                  <div className="space-y-2">
                    {rz.por_razon.map((r) => (
                      <div key={r.razon} className="flex items-center gap-2">
                        <span className="w-32 shrink-0 truncate text-xs text-gray-600" title={r.razon}>{r.razon}</span>
                        <div className="h-4 flex-1 rounded bg-gray-100">
                          <div className="h-full rounded bg-red-400" style={{ width: `${(r.count / razonMax) * 100}%` }} />
                        </div>
                        <span className="w-6 shrink-0 text-right text-xs font-medium text-gray-600 tabular-nums">{r.count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>

          {/* NIVEL 3 — ¿qué hicimos distinto? (anatomía: diverging ganado vs perdido) */}
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-400">¿Qué llevó ganar vs perder?</p>
            <section className="rounded-xl border border-surface-border bg-white p-5">
              <div className="mb-4 grid grid-cols-[8rem_1fr] items-center gap-3 text-[11px] font-semibold uppercase tracking-wide">
                <span className="text-gray-400">Promedio / deal</span>
                <div className="flex justify-between">
                  <span className="text-emerald-600">← Ganados ({an.ganados.count})</span>
                  <span className="text-red-500">Perdidos ({an.perdidos.count}) →</span>
                </div>
              </div>
              {an.ganados.count === 0 && an.perdidos.count === 0 ? (
                <p className="py-6 text-center text-sm text-gray-400">Sin deals cerrados en el periodo.</p>
              ) : (
                <div className="space-y-2.5">
                  {[
                    ...TIPOS.map((t) => ({ label: t.label, g: an.ganados.por_tipo[t.key] ?? 0, p: an.perdidos.por_tipo[t.key] ?? 0 })),
                    { label: "Días al cierre", g: an.ganados.avg_dias, p: an.perdidos.avg_dias },
                  ].map((row) => {
                    const max = Math.max(row.g, row.p, 1);
                    return (
                      <div key={row.label} className="grid grid-cols-[8rem_1fr] items-center gap-3">
                        <span className="text-xs text-gray-600">{row.label}</span>
                        {/* barra divergente: ganados a la izquierda, perdidos a la derecha, divisor al centro */}
                        <div className="flex items-center">
                          <div className="flex flex-1 items-center justify-end gap-1.5">
                            <span className="text-xs font-medium tabular-nums text-gray-700">{row.g}</span>
                            <div className="h-3.5 rounded-l bg-emerald-500" style={{ width: `${(row.g / max) * 100}%` }} />
                          </div>
                          <div className="h-6 w-px shrink-0 bg-gray-300" />
                          <div className="flex flex-1 items-center gap-1.5">
                            <div className="h-3.5 rounded-r bg-red-400" style={{ width: `${(row.p / max) * 100}%` }} />
                            <span className="text-xs font-medium tabular-nums text-gray-700">{row.p}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <p className="mt-4 border-t border-surface-border pt-3 text-xs text-gray-400">
                Más toques y más días en los ganados = el patrón que conviene repetir.
              </p>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
