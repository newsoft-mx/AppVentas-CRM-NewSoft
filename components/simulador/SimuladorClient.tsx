"use client";

import { useMemo, useState } from "react";
import { Target, FileDown } from "lucide-react";
import {
  computeSimulador, SIMULADOR_DEFAULT, periodLabel,
  type SimuladorState, type Periodo, type Modo, type LadoInputs,
} from "@/lib/simulador";
import { useCotizadorCasos } from "@/components/cotizador/useCotizadorCasos";
import { CotizadorShell, Panel, CotizadorTabs, CotizadorButton } from "@/components/cotizador/CotizadorShell";

// Simulador de Casos de Negocio (nativo, sobre el kit de cotizador). Migrado del HTML/iframe:
// mismo cálculo (lib/simulador) y mismo shape de `datos` (compatibilidad con casos guardados).
// El chrome (header/toolbar/paneles/tarjetas/segmented) es el del kit → consistente con la
// Calculadora. Compara Estado Actual vs Con Mejora y deriva el ingreso incremental.

const fmtMoney = (n: number) => "$" + Math.round(n).toLocaleString("es-MX");
const fmtNum = (n: number, d = 0) => n.toLocaleString("es-MX", { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtPct = (n: number, d = 1) => (Number.isFinite(n) ? n.toFixed(d) + "%" : "—");
const numInput = "w-full rounded-lg border border-surface-border px-3 py-2 text-[14px] text-navy outline-none focus:border-navy";

// Campo numérico etiquetado.
function Campo({ label, value, onChange, hint }: {
  label: string; value: number; onChange: (v: number) => void; hint?: string;
}) {
  return (
    <div className="mb-3">
      <label className="mb-1 block text-[13px] text-gray-500">{label}</label>
      <input type="number" value={value} onChange={(e) => onChange(+e.target.value)} className={numInput} />
      {hint && <p className="mt-1 text-[11px] text-gray-400">{hint}</p>}
    </div>
  );
}

// Slider de mejora en modo % (variación sobre el actual).
function SliderPct({ label, min, max, step, value, onChange, suffix = "%" }: {
  label: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void; suffix?: string;
}) {
  return (
    <div className="mb-3">
      <div className="mb-1 flex justify-between text-[13px]">
        <span className="text-gray-500">{label}</span>
        <span className="font-medium text-navy tabular-nums">{value >= 0 ? "+" : ""}{value}{suffix}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(+e.target.value)} className="w-full accent-orange" />
    </div>
  );
}

export default function SimuladorClient({ casoInicial, dealId }: { casoInicial: string | null; dealId: string | null }) {
  const [st, setSt] = useState<SimuladorState>(SIMULADOR_DEFAULT);
  const set = <K extends keyof SimuladorState>(k: K, v: SimuladorState[K]) => setSt((p) => ({ ...p, [k]: v }));
  const setActual = (k: keyof LadoInputs, v: number) => setSt((p) => ({ ...p, actual: { ...p.actual, [k]: v } }));
  const setMejora = (k: keyof LadoInputs, v: number) => setSt((p) => ({ ...p, mejoraAbsolute: { ...p.mejoraAbsolute, [k]: v } }));
  const setPct = (k: keyof SimuladorState["pct"], v: number) => setSt((p) => ({ ...p, pct: { ...p.pct, [k]: v } }));

  const casos = useCotizadorCasos<SimuladorState>({
    base: "/api/simulador/casos", casoInicial, dealId, entidad: "caso",
    // `nombre` lo persiste el hook en su columna; `datos` es solo el estado del simulador.
    getDatos: () => st,
    aplicarDatos: (d) => setSt({ ...SIMULADOR_DEFAULT, ...d }),
  });

  const r = useMemo(() => computeSimulador(st), [st]);
  const lbl = periodLabel(st.period);
  const notaMensual = st.period !== "mensual";
  const up = (n: number) => (n >= 0 ? "text-emerald-300" : "text-red-300");

  // Filas del embudo (mensualizado) y de la tabla.
  const funnel: [string, number, number][] = [
    ["Leads / mes", r.actual.leadsMensual, r.mejora.leadsMensual],
    ["Cotizaciones / mes", r.actual.cotizMensual, r.mejora.cotizMensual],
    ["Ventas cerradas / mes", r.actual.ventas, r.mejora.ventas],
  ];
  const tabla: [string, number, number, "money" | "num" | "pct", number][] = [
    ["Leads / mes", r.actual.leadsMensual, r.mejora.leadsMensual, "num", 0],
    ["Precio promedio de venta", st.actual.precio, r.mejoraInputs.precio, "money", 0],
    ["Cotizaciones / mes", r.actual.cotizMensual, r.mejora.cotizMensual, "num", 1],
    ["% Cierre de cotizaciones", st.actual.cierre, r.mejoraInputs.cierre, "pct", 1],
    ["Ventas cerradas / mes", r.actual.ventas, r.mejora.ventas, "num", 1],
    ["Ingreso estimado / mes", r.actual.ingreso, r.mejora.ingreso, "money", 0],
  ];
  const fmtCell = (v: number, kind: "money" | "num" | "pct", d: number) =>
    kind === "money" ? fmtMoney(v) : kind === "pct" ? fmtPct(v, d) : fmtNum(v, d);

  return (
    <CotizadorShell
      header={{
        titulo: "Simulador de Casos de Negocio",
        descripcion: "Compará el estado actual del cliente contra el escenario con mejora implementada, y obtené el ingreso incremental al instante.",
        icono: <Target size={22} />,
      }}
      casos={casos}
      onNuevo={() => { setSt(SIMULADOR_DEFAULT); casos.setNombre(""); }}
      acciones={
        <CotizadorButton onClick={() => window.print()}><FileDown size={13} /> Exportar PDF</CotizadorButton>
      }
    >
      {/* Segmented: periodicidad + modo de captura */}
      <Panel className="flex flex-wrap items-center gap-x-8 gap-y-3">
        <div className="flex items-center gap-3">
          <span className="text-[13px] font-medium text-gray-500">Periodicidad de leads</span>
          <CotizadorTabs<Periodo> value={st.period} onChange={(v) => set("period", v)}
            tabs={[["diario", "Diario"], ["semanal", "Semanal"], ["mensual", "Mensual"]]} />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[13px] font-medium text-gray-500">Modo de captura de mejora</span>
          <CotizadorTabs<Modo> value={st.mode} onChange={(v) => set("mode", v)}
            tabs={[["absolute", "Valores absolutos"], ["percent", "% de incremento"]]} />
        </div>
      </Panel>

      {/* Dos escenarios */}
      <div className="grid gap-4 md:grid-cols-2">
        <Panel className="border-t-4 border-t-navy">
          <p className="mb-4 flex items-center gap-2 font-semibold text-navy">
            <span className="h-2.5 w-2.5 rounded-full bg-navy" /> Estado Actual
          </p>
          <Campo label="Cantidad de leads" value={st.actual.leads} onChange={(v) => setActual("leads", v)}
            hint={`Conversión Leads → Cotización: ${fmtPct(r.actual.tasaLeadCotiz)}${notaMensual ? ` · ≈ ${fmtNum(r.actual.leadsMensual)} leads/mes` : ""}`} />
          <Campo label="Precio promedio de venta" value={st.actual.precio} onChange={(v) => setActual("precio", v)} />
          <Campo label="Cantidad de cotizaciones" value={st.actual.cotiz} onChange={(v) => setActual("cotiz", v)} />
          <Campo label="% de cierre de cotizaciones" value={st.actual.cierre} onChange={(v) => setActual("cierre", v)} />
          <EscenarioOut ventas={r.actual.ventasNative} ingreso={r.actual.ingresoNative} lbl={lbl}
            nota={notaMensual ? `≈ ${fmtNum(r.actual.ventas, 1)} ventas y ${fmtMoney(r.actual.ingreso)} al mes` : ""} />
        </Panel>

        <Panel className="border-t-4 border-t-orange">
          <p className="mb-4 flex items-center gap-2 font-semibold text-orange">
            <span className="h-2.5 w-2.5 rounded-full bg-orange" /> Con Mejora Implementada
          </p>
          {st.mode === "absolute" ? (
            <>
              <Campo label="Cantidad de leads" value={st.mejoraAbsolute.leads} onChange={(v) => setMejora("leads", v)} />
              <Campo label="Precio promedio de venta" value={st.mejoraAbsolute.precio} onChange={(v) => setMejora("precio", v)} />
              <Campo label="Cantidad de cotizaciones" value={st.mejoraAbsolute.cotiz} onChange={(v) => setMejora("cotiz", v)} />
              <Campo label="% de cierre de cotizaciones" value={st.mejoraAbsolute.cierre} onChange={(v) => setMejora("cierre", v)} />
            </>
          ) : (
            <>
              <SliderPct label="Leads" min={0} max={200} step={5} value={st.pct.leads} onChange={(v) => setPct("leads", v)} />
              <SliderPct label="Precio de venta" min={-50} max={100} step={5} value={st.pct.precio} onChange={(v) => setPct("precio", v)} />
              <SliderPct label="Cotizaciones" min={0} max={200} step={5} value={st.pct.cotiz} onChange={(v) => setPct("cotiz", v)} />
              <SliderPct label="Cierre" min={0} max={50} step={1} value={st.pct.cierre} onChange={(v) => setPct("cierre", v)} suffix=" pts" />
              <p className="mb-3 rounded-lg bg-orange-50 px-3 py-2 text-[12px] text-orange-700">
                Mejora resuelta: {fmtNum(r.mejoraInputs.leads)} leads · {fmtMoney(r.mejoraInputs.precio)} · {fmtNum(r.mejoraInputs.cotiz, 1)} cotiz · {fmtPct(r.mejoraInputs.cierre)} cierre
              </p>
            </>
          )}
          <EscenarioOut ventas={r.mejora.ventasNative} ingreso={r.mejora.ingresoNative} lbl={lbl}
            nota={notaMensual ? `≈ ${fmtNum(r.mejora.ventas, 1)} ventas y ${fmtMoney(r.mejora.ingreso)} al mes` : ""} />
        </Panel>
      </div>

      {/* Hero de impacto */}
      <div className="rounded-2xl bg-gradient-to-br from-navy to-[#081530] p-6 text-white">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/50">Impacto del caso de negocio</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-4xl font-bold tabular-nums">{fmtMoney(r.deltaAnual)}</div>
            <div className="text-sm text-white/60">Ingreso incremental anualizado</div>
          </div>
          <div className="flex flex-wrap gap-8">
            <HeroStat value={`${r.deltaMensual >= 0 ? "+" : ""}${fmtMoney(r.deltaMensual)}`} label={`Incremento / ${lbl === "mes" ? "mes" : "mes"}`} cls={up(r.deltaMensual)} />
            <HeroStat value={`${r.pctCrecimiento >= 0 ? "+" : ""}${fmtPct(r.pctCrecimiento)}`} label="% crecimiento de ingreso" cls={up(r.pctCrecimiento)} />
            <HeroStat value={`${r.deltaVentas >= 0 ? "+" : ""}${fmtNum(r.deltaVentas, 1)}`} label="Ventas cerradas adicionales / mes" cls={up(r.deltaVentas)} />
          </div>
        </div>
      </div>

      {/* Embudo comparativo */}
      <Panel>
        <p className="mb-4 font-semibold text-navy">Embudo comparativo — mensualizado</p>
        <div className="space-y-4">
          {funnel.map(([label, a, m]) => {
            const max = Math.max(a, m, 1);
            return (
              <div key={label}>
                <div className="mb-1 flex justify-between text-[12px]">
                  <span className="text-gray-500">{label}</span>
                  <span className="tabular-nums text-navy">{fmtNum(a, 1)} → {fmtNum(m, 1)}</span>
                </div>
                <div className="space-y-1">
                  <div className="h-2.5 rounded-full bg-navy" style={{ width: `${Math.max(3, (a / max) * 100)}%` }} />
                  <div className="h-2.5 rounded-full bg-orange" style={{ width: `${Math.max(3, (m / max) * 100)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      {/* Detalle de variables */}
      <Panel>
        <p className="mb-4 font-semibold text-navy">Detalle de variables</p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-surface-border text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                <th className="py-2 pr-3">Variable</th>
                <th className="py-2 px-3 text-right">Actual</th>
                <th className="py-2 px-3 text-right">Con mejora</th>
                <th className="py-2 px-3 text-right">Delta</th>
                <th className="py-2 pl-3 text-right">Delta %</th>
              </tr>
            </thead>
            <tbody>
              {tabla.map(([label, a, m, kind, d], i) => {
                const delta = m - a;
                const dPct = a !== 0 ? (delta / Math.abs(a)) * 100 : NaN;
                const cls = delta > 0 ? "text-emerald-600" : delta < 0 ? "text-red-500" : "text-gray-400";
                const total = i === tabla.length - 1;
                return (
                  <tr key={label} className={`border-b border-gray-100 ${total ? "bg-surface font-semibold" : ""}`}>
                    <td className="py-2 pr-3 text-navy">{label}</td>
                    <td className="py-2 px-3 text-right tabular-nums text-gray-600">{fmtCell(a, kind, d)}</td>
                    <td className="py-2 px-3 text-right tabular-nums text-gray-600">{fmtCell(m, kind, d)}</td>
                    <td className={`py-2 px-3 text-right tabular-nums ${cls}`}>{delta >= 0 ? "+" : ""}{fmtCell(delta, kind, d)}</td>
                    <td className={`py-2 pl-3 text-right tabular-nums ${cls}`}>{Number.isFinite(dPct) ? `${dPct >= 0 ? "+" : ""}${fmtPct(dPct)}` : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* Supuestos / notas */}
      <Panel>
        <p className="mb-2 font-semibold text-navy">Supuestos / notas del caso</p>
        <textarea value={st.notes ?? ""} onChange={(e) => set("notes", e.target.value)} rows={3}
          placeholder="Ej. Migración de canal telefónico a WhatsApp, fase 1 catálogo estructurado. Supuesto: 40 llamadas/día capturadas hoy como leads no cuantificados…"
          className="w-full resize-y rounded-lg border border-surface-border px-3 py-2 text-[13px] text-navy outline-none focus:border-navy" />
      </Panel>
    </CotizadorShell>
  );
}

function EscenarioOut({ ventas, ingreso, lbl, nota }: { ventas: number; ingreso: number; lbl: string; nota: string }) {
  return (
    <div className="mt-4 grid grid-cols-2 gap-3 border-t border-surface-border pt-4">
      <div className="rounded-lg bg-surface p-3">
        <div className="text-[11px] uppercase tracking-wide text-gray-400">Ventas cerradas / {lbl}</div>
        <div className="text-lg font-semibold text-navy tabular-nums">{fmtNum(ventas, 1)}</div>
      </div>
      <div className="rounded-lg bg-surface p-3">
        <div className="text-[11px] uppercase tracking-wide text-gray-400">Ingreso estimado / {lbl}</div>
        <div className="text-lg font-semibold text-navy tabular-nums">{fmtMoney(ingreso)}</div>
      </div>
      {nota && <p className="col-span-2 text-[11px] text-gray-400">{nota}</p>}
    </div>
  );
}

function HeroStat({ value, label, cls }: { value: string; label: string; cls: string }) {
  return (
    <div>
      <div className={`text-2xl font-bold tabular-nums ${cls}`}>{value}</div>
      <div className="text-xs text-white/60">{label}</div>
    </div>
  );
}
