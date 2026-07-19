"use client";

import { useEffect, useMemo, useState } from "react";
import { Calculator, Save, FolderOpen, Trash2, Link2 } from "lucide-react";
import Toast, { ToastData } from "@/components/ui/Toast";
import { calcularPlataforma, type CalculadoraInputs, type ServicioConsumo } from "@/lib/calculadora-plataformas";
import { INPUTS_DEFAULT } from "@/lib/calculadora-plataformas-defaults";

interface CasoMeta { id: string; nombre: string; deal_id: string | null; deal_nombre: string | null; updated_at: string }

// Calculadora de Plataformas Administradas (Fase 1, nativa). Captura inputs y pinta el
// resultado del motor puro (lib/calculadora-plataformas). Tres vistas: interna (desglose),
// cliente (propuesta) y configurar consumo. Sin persistencia todavía (Fase 2).

const fmt = (n: number) => "$" + Math.round(n).toLocaleString("es-MX");
const fmtDec = (n: number, d = 4) => "$" + n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: d });
const fmtPct = (n: number) => n.toFixed(1) + "%";
const numInput = "w-full rounded-md border border-surface-border px-2 py-1.5 text-[13px] text-navy outline-none focus:border-orange";

type Tab = "interno" | "cliente" | "consumo";

function Slider({ label, min, max, step, value, onChange, display }: {
  label: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void; display: string;
}) {
  return (
    <div className="mb-4">
      <div className="mb-1 flex justify-between">
        <label className="text-[13px] text-gray-500">{label}</label>
        <span className="text-[13px] font-medium text-navy">{display}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(+e.target.value)} className="w-full accent-orange" />
    </div>
  );
}

const CARD_VARIANT = {
  accent: "bg-navy border-transparent text-white",
  warn: "bg-orange-50 border-orange-200 text-orange-700",
  info: "bg-blue-50 border-blue-200 text-blue-900",
  default: "bg-surface border-surface-border text-navy",
} as const;
function Card({ label, value, sub, variant = "default" }: {
  label: string; value: string; sub?: string; variant?: keyof typeof CARD_VARIANT;
}) {
  const muted = variant === "accent" ? "text-white/60" : variant === "default" ? "text-gray-500" : "opacity-70";
  return (
    <div className={`rounded-xl border p-4 ${CARD_VARIANT[variant]}`}>
      <div className={`mb-1 text-xs ${muted}`}>{label}</div>
      <div className={`font-semibold ${variant === "accent" ? "text-2xl" : "text-xl"}`}>{value}</div>
      {sub && <div className={`mt-0.5 text-xs ${muted}`}>{sub}</div>}
    </div>
  );
}

// Filas de sección/total reutilizables en la vista interna.
const secCls: Record<string, string> = {
  dev: "bg-blue-50 text-blue-900", sop: "bg-emerald-50 text-emerald-700", con: "bg-violet-50 text-violet-700",
};
function SecHeader({ variant, children }: { variant: keyof typeof secCls; children: React.ReactNode }) {
  return (
    <tr className={secCls[variant]}>
      <td colSpan={5} className="px-3 py-1.5 text-[12px] font-semibold uppercase tracking-wide">{children}</td>
    </tr>
  );
}

export default function CalculadoraClient({ casoInicial, dealId }: { casoInicial: string | null; dealId: string | null }) {
  const [inputs, setInputs] = useState<CalculadoraInputs>(INPUTS_DEFAULT);
  const [tab, setTab] = useState<Tab>("interno");
  const set = <K extends keyof CalculadoraInputs>(k: K) => (v: CalculadoraInputs[K]) => setInputs((p) => ({ ...p, [k]: v }));
  const updateServicio = (id: string, campo: keyof ServicioConsumo, valor: unknown) =>
    setInputs((p) => ({ ...p, servicios: p.servicios.map((s) => (s.id === id ? { ...s, [campo]: valor } : s)) }));

  // ── Persistencia (Fase 2): guardar/cargar/borrar cotizaciones, opcionalmente ligadas a un deal.
  const [nombre, setNombre] = useState("");
  const [casos, setCasos] = useState<CasoMeta[]>([]);
  const [dealVinc, setDealVinc] = useState<string | null>(dealId);
  const [dealNombre, setDealNombre] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [toast, setToast] = useState<ToastData | null>(null);

  async function refrescarCasos() {
    const r = await fetch("/api/calculadora/casos");
    if (r.ok) setCasos(await r.json());
  }
  // Cargar la lista de cotizaciones + (si viene ?caso=) abrir una. Fetch-on-mount.
  useEffect(() => {
    let vivo = true;
    (async () => {
      const r = await fetch("/api/calculadora/casos");
      if (r.ok && vivo) setCasos(await r.json());
      if (casoInicial) await cargar(casoInicial, false);
    })();
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [casoInicial]);

  async function cargar(id: string, aviso = true) {
    const r = await fetch(`/api/calculadora/casos/${id}`);
    if (!r.ok) { setToast({ type: "error", message: "No se pudo cargar la cotización" }); return; }
    const c = await r.json();
    const d = c.datos as { inputs?: CalculadoraInputs };
    if (d?.inputs) setInputs({ ...INPUTS_DEFAULT, ...d.inputs });
    setNombre(c.nombre);
    setDealVinc(c.deal_id ?? null);
    if (aviso) setToast({ type: "success", message: `Cargada "${c.nombre}"` });
  }

  async function guardar() {
    const n = nombre.trim();
    if (!n) { setToast({ type: "error", message: "Ponle un nombre a la cotización" }); return; }
    setGuardando(true);
    try {
      const r = await fetch("/api/calculadora/casos", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: n, datos: { inputs }, deal_id: dealVinc }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "No se pudo guardar");
      await refrescarCasos();
      setToast({ type: "success", message: `Guardada "${n}"` });
    } catch (e) { setToast({ type: "error", message: e instanceof Error ? e.message : "Error" }); }
    finally { setGuardando(false); }
  }

  async function borrar(id: string, nom: string) {
    if (!window.confirm(`¿Eliminar la cotización "${nom}"?`)) return;
    const r = await fetch(`/api/calculadora/casos/${id}`, { method: "DELETE" });
    if (r.ok) { await refrescarCasos(); setToast({ type: "success", message: "Cotización eliminada" }); }
    else setToast({ type: "error", message: "No se pudo eliminar" });
  }

  // Nombre del deal vinculado (para el chip), si vino por ?deal= o al cargar un caso. Fetch-on-mount:
  // todo el setState va dentro del async (diferido) para no violar la regla de set-state-en-effect.
  useEffect(() => {
    let vivo = true;
    (async () => {
      if (!dealVinc) { if (vivo) setDealNombre(null); return; }
      const r = await fetch(`/api/calculadora/casos?deal_id=${dealVinc}`);
      const cs: CasoMeta[] = r.ok ? await r.json() : [];
      if (vivo) setDealNombre(cs.find((c) => c.deal_nombre)?.deal_nombre ?? "deal vinculado");
    })();
    return () => { vivo = false; };
  }, [dealVinc]);

  const calc = useMemo(() => calcularPlataforma(inputs), [inputs]);
  const { antiPct, meses, tasa, hrsSoporte, margenConsumo } = inputs;

  const tdL = "px-3 py-2 text-[#374151]";
  const tdR = "px-3 py-2 text-right text-gray-500 text-[12px]";
  const tdMonto = "px-3 py-2 text-right font-semibold text-navy";

  return (
    <div className="mx-auto max-w-3xl">
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      {/* Header */}
      <div className="mb-4 flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange text-white"><Calculator size={18} /></div>
        <div className="flex-1">
          <h1 className="text-base font-bold text-navy">Calculadora · Plataformas Administradas</h1>
          <p className="text-xs text-gray-400">Cuota fija (dev + soporte + infra) · Consumo variable</p>
        </div>
        {dealVinc && (
          <span className="flex items-center gap-1 rounded-full bg-orange/10 px-2.5 py-1 text-[11px] font-semibold text-orange">
            <Link2 size={12} /> {dealNombre ?? "deal vinculado"}
          </span>
        )}
      </div>

      {/* Guardar / cargar cotizaciones */}
      <div className="mb-6 flex flex-wrap items-center gap-2 rounded-lg border border-surface-border bg-surface px-3 py-2">
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre de la cotización…"
          className="min-w-[180px] flex-1 rounded-md border border-surface-border bg-white px-2.5 py-1.5 text-[13px] text-navy outline-none focus:border-orange" />
        <button onClick={guardar} disabled={guardando}
          className="flex items-center gap-1.5 rounded-md bg-navy px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy-700 disabled:opacity-50">
          <Save size={13} /> {guardando ? "Guardando…" : "Guardar"}
        </button>
        {casos.length > 0 && (
          <div className="flex items-center gap-1.5">
            <FolderOpen size={14} className="text-gray-400" />
            <select value="" onChange={(e) => e.target.value && cargar(e.target.value)}
              className="rounded-md border border-surface-border bg-white px-2 py-1.5 text-[12px] text-navy outline-none focus:border-orange">
              <option value="">Cargar… ({casos.length})</option>
              {casos.map((c) => <option key={c.id} value={c.id}>{c.nombre}{c.deal_nombre ? ` · ${c.deal_nombre}` : ""}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Lista de guardadas (con borrar) */}
      {casos.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-1.5">
          {casos.map((c) => (
            <span key={c.id} className="flex items-center gap-1.5 rounded-full border border-surface-border bg-white px-2.5 py-1 text-[11px] text-gray-600">
              <button onClick={() => cargar(c.id)} className="font-medium text-navy hover:text-orange">{c.nombre}</button>
              <button onClick={() => borrar(c.id, c.nombre)} title="Eliminar" className="text-gray-300 hover:text-red-500"><Trash2 size={11} /></button>
            </span>
          ))}
        </div>
      )}

      {/* Sliders */}
      <div className="mb-6 grid gap-6 md:grid-cols-3">
        <div>
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Desarrollo</p>
          <Slider label="Horas" min={10} max={1000} step={10} value={inputs.hrsDesarrollo} onChange={set("hrsDesarrollo")} display={`${inputs.hrsDesarrollo} hrs`} />
          <Slider label="Tarifa / hora" min={500} max={3000} step={50} value={inputs.tarifaHora} onChange={set("tarifaHora")} display={fmt(inputs.tarifaHora)} />
          <div className="flex justify-between rounded-lg bg-blue-50 px-3 py-2 text-[13px] text-navy">
            <span>Valor total</span><strong>{fmt(calc.valorDev)}</strong>
          </div>
        </div>
        <div>
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Financiamiento</p>
          <Slider label="Anticipo %" min={0} max={100} step={10} value={antiPct} onChange={set("antiPct")} display={`${antiPct}%`} />
          {calc.hayFin ? (
            <>
              <Slider label="Plazo" min={6} max={36} step={6} value={meses} onChange={set("meses")} display={`${meses} meses`} />
              <Slider label="Tasa mensual" min={0} max={5} step={0.5} value={tasa} onChange={set("tasa")} display={tasa === 0 ? "Sin costo" : fmtPct(tasa)} />
            </>
          ) : (
            <div className="rounded-lg bg-emerald-50 px-3 py-2 text-[13px] text-emerald-700">Pago 100% upfront — sin cuota de financiamiento</div>
          )}
        </div>
        <div>
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Soporte e infra</p>
          <Slider label="Horas soporte / mes" min={1} max={80} step={1} value={hrsSoporte} onChange={set("hrsSoporte")} display={`${hrsSoporte} hrs/mes`} />
          <Slider label="Tarifa soporte / hora" min={500} max={3000} step={50} value={inputs.tarifaSoporte} onChange={set("tarifaSoporte")} display={fmt(inputs.tarifaSoporte)} />
          <div className="mb-1 text-[13px] text-gray-500">Infra Vercel (MXN/mes)</div>
          <input type="number" min={0} value={inputs.costoVercel} onChange={(e) => set("costoVercel")(+e.target.value)} className={numInput} />
        </div>
      </div>

      {/* Cards */}
      <div className="mb-6 grid grid-cols-2 gap-2 md:grid-cols-4">
        <Card label="Anticipo (upfront)" value={fmt(calc.anticipo)} sub={`${antiPct}% del proyecto`} variant="info" />
        <Card label="Cuota mensual fija" value={fmt(calc.cuotaMensual)} sub="Dev + soporte + infra" variant="accent" />
        <Card label="Consumo est. / mes" value={fmt(calc.totalConsumoCobro)} sub={`Costo: ${fmt(calc.totalConsumoCosto)}`} />
        <Card label={`Total contrato (${meses}m)`} value={fmt(calc.totalContrato)} sub="Anticipo + cuotas fijas" variant="warn" />
      </div>

      {/* Tabs */}
      <div className="mb-5 flex gap-1 rounded-lg bg-gray-100 p-1">
        {([["interno", "Vista interna"], ["cliente", "Vista cliente"], ["consumo", "Configurar consumo"]] as [Tab, string][]).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors ${tab === k ? "bg-navy text-white" : "text-gray-500 hover:text-navy"}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === "interno" && (
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="bg-navy text-white">
              {["Concepto", "Volumen / plazo", "Tarifa / tasa", "Monto", "Tipo"].map((h, i) => (
                <th key={h} className={`px-3 py-2 font-semibold ${i === 0 ? "text-left" : "text-right"}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <SecHeader variant="dev">Desarrollo</SecHeader>
            <tr className="border-b border-gray-100">
              <td className={tdL}>Horas de desarrollo</td><td className={tdR}>{inputs.hrsDesarrollo} hrs</td>
              <td className={tdR}>{fmt(inputs.tarifaHora)}/hr</td><td className={tdMonto}>{fmt(calc.valorDev)}</td><td></td>
            </tr>
            <tr className="border-b border-gray-100">
              <td className={tdL}>Anticipo (upfront)</td><td className={tdR}>{antiPct}%</td><td></td>
              <td className={tdMonto}>{fmt(calc.anticipo)}</td><td className="px-3 py-2 text-right text-[11px] text-gray-400">upfront</td>
            </tr>
            {calc.hayFin && (
              <>
                <tr className="border-b border-gray-100">
                  <td className={tdL}>Amortización mensual</td><td className={tdR}>{meses} meses</td>
                  <td className={tdR}>{fmt(calc.financiado)} ÷ {meses}</td><td className={tdMonto}>{fmt(calc.amort)}/mes</td>
                  <td className="px-3 py-2 text-right text-[11px] text-blue-700">cuota</td>
                </tr>
                {calc.interes > 0 && (
                  <tr className="border-b border-gray-100">
                    <td className={tdL}>Costo de financiamiento</td><td className={tdR}>saldo prom.</td>
                    <td className={tdR}>{fmtPct(tasa)}/mes</td><td className={tdMonto}>{fmt(calc.interes)}/mes</td>
                    <td className="px-3 py-2 text-right text-[11px] text-blue-700">cuota</td>
                  </tr>
                )}
              </>
            )}

            <SecHeader variant="sop">Soporte e infraestructura (cuota fija)</SecHeader>
            <tr className="border-b border-gray-100">
              <td className={tdL}>Soporte N2</td><td className={tdR}>{hrsSoporte} hrs</td>
              <td className={tdR}>{fmt(inputs.tarifaSoporte)}/hr</td><td className={tdMonto}>{fmt(calc.sop)}/mes</td>
              <td className="px-3 py-2 text-right text-[11px] text-emerald-700">cuota</td>
            </tr>
            <tr className="border-b border-gray-100">
              <td className={tdL}>Infraestructura (Vercel)</td><td className={tdR}>fijo mensual</td><td></td>
              <td className={tdMonto}>{fmt(calc.infraVercel)}/mes</td><td className="px-3 py-2 text-right text-[11px] text-emerald-700">cuota</td>
            </tr>
            <tr className="border-b-2 border-gray-200 bg-emerald-50">
              <td colSpan={3} className="px-3 py-2 font-bold text-emerald-700">Cuota mensual fija al cliente</td>
              <td colSpan={2} className="px-3 py-2 text-right text-[15px] font-bold text-emerald-700">{fmt(calc.cuotaMensual)}</td>
            </tr>

            <SecHeader variant="con">Consumo variable (facturación separada)</SecHeader>
            {calc.consumoDetalle.map((s) => (
              <tr key={s.id} className="border-b border-gray-100">
                <td className={tdL}>{s.nombre}</td>
                <td className={tdR}>{s.tipo === "fijo" ? "fijo mensual" : `${(s.volumen ?? 0).toLocaleString()} ${s.unidad}`}</td>
                <td className={tdR}>{s.tipo === "fijo" ? "—" : `${fmtDec((s.precioUnit ?? 0) * (1 + margenConsumo / 100))}/u`}</td>
                <td className={tdMonto}>{fmt(s.cobro)}/mes</td>
                <td className="px-3 py-2 text-right text-[11px] text-violet-700">consumo</td>
              </tr>
            ))}
            <tr className="border-b-2 border-gray-200 bg-violet-50">
              <td colSpan={3} className="px-3 py-2 font-bold text-violet-700">Consumo estimado mensual</td>
              <td colSpan={2} className="px-3 py-2 text-right text-[15px] font-bold text-violet-700">{fmt(calc.totalConsumoCobro)}</td>
            </tr>

            <tr className="bg-orange-50">
              <td colSpan={3} className="px-3 py-2.5 text-[14px] font-bold text-orange-700">Total estimado al cliente / mes (cuota + consumo est.)</td>
              <td colSpan={2} className="px-3 py-2.5 text-right text-[16px] font-bold text-orange-700">{fmt(calc.totalMensualCliente)}</td>
            </tr>
          </tbody>
        </table>
      )}

      {tab === "cliente" && (
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="bg-navy text-white">
              <th className="px-3 py-2 text-left font-semibold">Concepto</th>
              <th className="px-3 py-2 text-right font-semibold">Detalle</th>
              <th className="px-3 py-2 text-right font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            <tr className="bg-blue-50"><td colSpan={3} className="px-3 py-1.5 text-[12px] font-semibold uppercase tracking-wide text-blue-900">Cuota de arranque</td></tr>
            <tr className="border-b-2 border-gray-200">
              <td className={tdL}>Pago de arranque del servicio</td><td className={tdR}>Pago único al inicio</td>
              <td className="px-3 py-2 text-right text-[15px] font-bold text-blue-900">{fmt(calc.anticipo)}</td>
            </tr>
            <tr className="bg-emerald-50"><td colSpan={3} className="px-3 py-1.5 text-[12px] font-semibold uppercase tracking-wide text-emerald-700">Servicio mensual</td></tr>
            <tr className="border-b-2 border-gray-200">
              <td className={tdL}>Plataforma administrada</td>
              <td className={tdR}>Soporte N2 (hasta {hrsSoporte} hrs) + infraestructura + operación</td>
              <td className="px-3 py-2 text-right text-[15px] font-bold text-emerald-700">{fmt(calc.cuotaMensual)}</td>
            </tr>
            <tr className="bg-violet-50"><td colSpan={3} className="px-3 py-1.5 text-[12px] font-semibold uppercase tracking-wide text-violet-700">Consumo variable (según uso real)</td></tr>
            {calc.consumoDetalle.map((s) => (
              <tr key={s.id} className="border-b border-gray-100">
                <td className={tdL}>{s.nombre}</td>
                <td className={tdR}>{s.tipo === "fijo" ? "fijo mensual" : `${fmtDec((s.precioUnit ?? 0) * (1 + margenConsumo / 100))} / ${(s.unidad ?? "").replace(/s$/, "")}`}</td>
                <td className="px-3 py-2 text-right italic text-gray-500">{s.tipo === "fijo" ? fmt(s.cobro) : "según uso"}</td>
              </tr>
            ))}
            <tr className="border-b-2 border-gray-200 bg-violet-50">
              <td colSpan={2} className="px-3 py-2 text-[12px] text-violet-700">Estimado con volúmenes actuales</td>
              <td className="px-3 py-2 text-right font-semibold text-violet-700">~{fmt(calc.totalConsumoCobro)}/mes</td>
            </tr>
            <tr className="bg-orange-50">
              <td className="px-3 py-2.5 text-[14px] font-bold text-orange-700">Estimado mensual total</td>
              <td className="px-3 py-2.5 text-right text-[12px] text-orange-700">Servicio + consumo estimado</td>
              <td className="px-3 py-2.5 text-right text-[16px] font-bold text-orange-700">{fmt(calc.totalMensualCliente)}</td>
            </tr>
          </tbody>
        </table>
      )}

      {tab === "consumo" && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <span className="text-[13px] text-gray-500">Margen sobre costo</span>
            <div className="flex items-center gap-2">
              <input type="range" min={0} max={100} step={5} value={margenConsumo}
                onChange={(e) => set("margenConsumo")(+e.target.value)} className="w-36 accent-orange" />
              <span className="min-w-9 text-[13px] font-medium text-navy">{fmtPct(margenConsumo)}</span>
            </div>
          </div>
          {inputs.servicios.map((s) => {
            const costo = s.tipo === "fijo" ? s.costoFijo ?? 0 : (s.volumen ?? 0) * (s.precioUnit ?? 0);
            const cobro = costo * (1 + margenConsumo / 100);
            return (
              <div key={s.id} className={`mb-2 rounded-lg border p-3 ${s.activo ? "border-surface-border bg-surface" : "border-gray-100 bg-gray-50 opacity-60"}`}>
                <div className={`flex items-center justify-between ${s.activo ? "mb-2.5" : ""}`}>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={s.activo} onChange={(e) => updateServicio(s.id, "activo", e.target.checked)} className="h-3.5 w-3.5 accent-orange" />
                    <span className="text-[13px] font-medium text-navy">{s.nombre}</span>
                    {s.tipo === "fijo" && <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">fijo</span>}
                  </label>
                  {s.activo && <span className="text-[12px] text-gray-500">Cobro: <strong className="text-navy">{fmt(cobro)}/mes</strong></span>}
                </div>
                {s.activo && (
                  <div className="grid grid-cols-2 gap-2.5">
                    {s.tipo === "fijo" ? (
                      <div>
                        <div className="mb-1 text-[11px] text-gray-400">Costo mensual (MXN)</div>
                        <input type="number" min={0} value={s.costoFijo} onChange={(e) => updateServicio(s.id, "costoFijo", +e.target.value)} className={numInput} />
                      </div>
                    ) : (
                      <>
                        <div>
                          <div className="mb-1 text-[11px] text-gray-400">Volumen / mes ({s.unidad})</div>
                          <input type="number" min={0} value={s.volumen} onChange={(e) => updateServicio(s.id, "volumen", +e.target.value)} className={numInput} />
                        </div>
                        <div>
                          <div className="mb-1 text-[11px] text-gray-400">Precio unitario cliente (MXN)</div>
                          <input type="number" min={0} step={0.001} value={s.precioUnit} onChange={(e) => updateServicio(s.id, "precioUnit", +e.target.value)} className={numInput} />
                        </div>
                      </>
                    )}
                    <div className="col-span-2 pt-1 text-[12px] text-gray-400">
                      Costo base: {fmt(costo)}/mes → cobro: <strong className="text-navy">{fmt(cobro)}</strong> (+{fmtPct(margenConsumo)})
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-6 text-center text-[11px] text-gray-300">Newsoft · Uso interno · Herramienta de cotización</p>
    </div>
  );
}
