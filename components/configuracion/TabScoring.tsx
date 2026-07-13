"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Sparkles, SlidersHorizontal, Gauge, ChevronDown, Workflow } from "lucide-react";
import Toast, { ToastData } from "@/components/ui/Toast";
import { TEMPERATURA_META, type Temperatura } from "@/types/crm";
import type { PipelineStageConfig } from "@/types/configuracion";

interface TipoAccion {
  id: string; nombre: string; color: string; peso: number;
  agendable: boolean; con_resultado: boolean; activo: boolean;
}
interface ResultadoAccion {
  id: string; nombre: string; factor: number;
  efecto: "POSITIVO" | "NEUTRO" | "NEGATIVO"; sugiere_reagendar: boolean; activo: boolean;
}
interface CrmConfig {
  avance_modo: "SUGERIR" | "AUTOMATICO";
  umbral_inactividad_dias: number;
  score_inicial: number;
  decay_por_dia: number;
  sensibilidad_prob: number;
  niveles_umbral: number[]; // [FRIO, TIBIO, CALIENTE, MUY_CALIENTE]
}

const NIVELES: Temperatura[] = ["MUY_FRIO", "FRIO", "TIBIO", "CALIENTE", "MUY_CALIENTE"];
const efectoDeFactor = (f: number) => (f > 0 ? "POSITIVO" : f < 0 ? "NEGATIVO" : "NEUTRO");

// Config del motor de scoring (SOL-19 rediseño): reúne en un solo tab, con
// jerarquía, lo que antes vivía repartido entre "Modelo de actividad" y "Etapas".
// ① qué alimenta el score (pesos + factores) · ② cómo se comporta (parámetros) ·
// ③ qué resulta (distribución real de deals + bandas de nivel).
export default function TabScoring({
  initialTipos,
  initialResultados,
  stages = [],
}: {
  initialTipos: TipoAccion[];
  initialResultados: ResultadoAccion[];
  stages?: PipelineStageConfig[];
}) {
  const [tipos, setTipos] = useState<TipoAccion[]>(initialTipos);
  const [resultados, setResultados] = useState<ResultadoAccion[]>(initialResultados);
  const [nuevoTipo, setNuevoTipo] = useState("");
  const [nuevoRes, setNuevoRes] = useState("");
  const [cfg, setCfg] = useState<CrmConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [avanzadoOpen, setAvanzadoOpen] = useState(false);
  const [dist, setDist] = useState<Record<string, number> | null>(null);
  const [toast, setToast] = useState<ToastData | null>(null);

  const pesoMax = useMemo(() => Math.max(1, ...tipos.map((t) => t.peso)), [tipos]);
  const etapasActivas = useMemo(
    () => stages.filter((s) => s.activo).sort((a, b) => a.orden - b.orden),
    [stages]
  );

  useEffect(() => {
    fetch("/api/configuracion/crm-config").then((r) => (r.ok ? r.json() : null)).then((d) => d && setCfg(d)).catch(() => {});
    fetch("/api/admin/audit-score").then((r) => (r.ok ? r.json() : null)).then((d) => d && setDist(d.distribucion)).catch(() => {});
  }, []);

  // Resultados ordenados por efecto: positivos (mayor factor) → neutro → negativos.
  const resultadosOrdenados = useMemo(
    () => [...resultados].sort((a, b) => b.factor - a.factor),
    [resultados]
  );

  // ── Tipos ──
  async function patchTipo(id: string, data: Partial<TipoAccion>) {
    setTipos((t) => t.map((x) => (x.id === id ? { ...x, ...data } : x)));
    await fetch(`/api/configuracion/tipos-accion/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  }
  async function addTipo() {
    const nombre = nuevoTipo.trim();
    if (!nombre) return;
    const res = await fetch("/api/configuracion/tipos-accion", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nombre }) });
    if (res.ok) { const nuevo = await res.json(); setTipos((t) => [...t, nuevo]); setNuevoTipo(""); }
  }
  async function delTipo(id: string) {
    if (!window.confirm("¿Eliminar este tipo de acción?")) return;
    const res = await fetch(`/api/configuracion/tipos-accion/${id}`, { method: "DELETE" });
    if (res.ok) setTipos((t) => t.filter((x) => x.id !== id));
    else window.alert("No se pudo eliminar (puede tener actividades asociadas).");
  }

  // ── Resultados ──
  async function patchRes(id: string, data: Partial<ResultadoAccion>) {
    setResultados((r) => r.map((x) => (x.id === id ? { ...x, ...data } : x)));
    await fetch(`/api/configuracion/resultados-accion/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  }
  async function addRes() {
    const nombre = nuevoRes.trim();
    if (!nombre) return;
    const res = await fetch("/api/configuracion/resultados-accion", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nombre }) });
    if (res.ok) { const nuevo = await res.json(); setResultados((r) => [...r, nuevo]); setNuevoRes(""); }
  }
  async function delRes(id: string) {
    if (!window.confirm("¿Eliminar este resultado?")) return;
    const res = await fetch(`/api/configuracion/resultados-accion/${id}`, { method: "DELETE" });
    if (res.ok) setResultados((r) => r.filter((x) => x.id !== id));
    else window.alert("No se pudo eliminar (puede tener actividades asociadas).");
  }

  async function guardarParams() {
    if (!cfg) return;
    setSaving(true);
    try {
      const res = await fetch("/api/configuracion/crm-config", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cfg) });
      if (!res.ok) throw new Error();
      setToast({ type: "success", message: "Parámetros guardados" });
    } catch {
      setToast({ type: "error", message: "No se pudo guardar" });
    } finally {
      setSaving(false);
    }
  }

  const totalDeals = dist ? NIVELES.reduce((s, n) => s + (dist[n] ?? 0), 0) : 0;

  return (
    <div className="space-y-10">
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      {/* ① QUÉ ALIMENTA EL SCORE ───────────────────────────────── */}
      <section>
        <SectionTitle icon={<Sparkles size={16} />} n="1" title="Qué alimenta el score" sub="Lo que el vendedor mueve: cuánto pesa cada interacción y qué tan bueno fue su desenlace." />
        <div className="grid gap-5 lg:grid-cols-2">
          {/* Pesos por tipo */}
          <Card title="Pesos por tipo de acción" hint="Importancia relativa de la interacción (0 = sin señal).">
            <div className="divide-y divide-surface-border">
              {tipos.map((t) => (
                <div key={t.id} className={`flex items-center gap-2 py-2 ${t.activo ? "" : "opacity-50"}`}>
                  <input type="color" value={t.color} onChange={(e) => patchTipo(t.id, { color: e.target.value })} className="h-6 w-6 shrink-0 cursor-pointer rounded border border-surface-border" title="Color" />
                  <input value={t.nombre} onChange={(e) => setTipos((ts) => ts.map((x) => x.id === t.id ? { ...x, nombre: e.target.value } : x))} onBlur={(e) => patchTipo(t.id, { nombre: e.target.value.trim() })} className="input min-w-0 flex-1 py-1 text-sm" />
                  {/* Barra relativa: se ve la importancia sin leer el número */}
                  <div className="hidden h-1.5 w-14 shrink-0 overflow-hidden rounded-full bg-gray-100 sm:block" title={`Peso relativo: ${t.peso}/${pesoMax}`}>
                    <div className="h-full rounded-full" style={{ width: `${(t.peso / pesoMax) * 100}%`, background: t.color }} />
                  </div>
                  <input type="number" min={0} max={100} value={t.peso} onChange={(e) => setTipos((ts) => ts.map((x) => x.id === t.id ? { ...x, peso: Number(e.target.value) } : x))} onBlur={(e) => patchTipo(t.id, { peso: Math.max(0, Math.round(Number(e.target.value))) })} className="input w-14 py-1 text-center text-sm font-semibold" title="Peso" />
                  <button onClick={() => delTipo(t.id)} className="shrink-0 text-gray-300 hover:text-red-500" title="Eliminar"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
            <AddRow value={nuevoTipo} setValue={setNuevoTipo} onAdd={addTipo} placeholder="Nuevo tipo de acción…" />
          </Card>

          {/* Factores por resultado — ordenados por efecto */}
          <Card title="Factores por resultado" hint="Calidad del desenlace [−1…+1]. Multiplica el peso del tipo. Ordenados de mejor a peor.">
            <div className="divide-y divide-surface-border">
              {resultadosOrdenados.map((r) => {
                const signo = r.factor > 0 ? "▲" : r.factor < 0 ? "▼" : "•";
                const col = r.factor > 0 ? "text-emerald-600" : r.factor < 0 ? "text-red-500" : "text-gray-400";
                return (
                  <div key={r.id} className={`flex items-center gap-2 py-2 ${r.activo ? "" : "opacity-50"}`}>
                    <span className={`w-3 shrink-0 text-center text-xs font-bold ${col}`}>{signo}</span>
                    <input value={r.nombre} onChange={(e) => setResultados((rs) => rs.map((x) => x.id === r.id ? { ...x, nombre: e.target.value } : x))} onBlur={(e) => patchRes(r.id, { nombre: e.target.value.trim() })} className="input min-w-0 flex-1 py-1 text-sm" />
                    <input type="number" min={-1} max={1} step={0.1} value={r.factor} onChange={(e) => setResultados((rs) => rs.map((x) => x.id === r.id ? { ...x, factor: Number(e.target.value), efecto: efectoDeFactor(Number(e.target.value)) } : x))} onBlur={(e) => { const f = Math.max(-1, Math.min(1, Number(e.target.value))); patchRes(r.id, { factor: f, efecto: efectoDeFactor(f) }); }} className={`input w-16 py-1 text-center text-sm font-semibold ${col}`} title="Factor [-1..+1]" />
                    <button onClick={() => delRes(r.id)} className="shrink-0 text-gray-300 hover:text-red-500" title="Eliminar"><Trash2 size={14} /></button>
                  </div>
                );
              })}
            </div>
            <AddRow value={nuevoRes} setValue={setNuevoRes} onAdd={addRes} placeholder="Nuevo resultado…" />
          </Card>
        </div>
      </section>

      {/* ② CÓMO SE COMPORTA ─────────────────────────────────────── */}
      {cfg && (
        <section>
          <SectionTitle icon={<SlidersHorizontal size={16} />} n="2" title="Cómo se comporta" sub="Los parámetros del motor: de dónde parte el score, cómo se enfría y dónde están los cortes de nivel." />
          <div className="rounded-xl border border-surface-border bg-white p-5">
            {/* Básico: lo que casi todos tocan */}
            <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              <Field label="Modo de avance" hint="Sugerir muestra un banner; Automático mueve la etapa solo.">
                <select className="input" value={cfg.avance_modo} onChange={(e) => setCfg({ ...cfg, avance_modo: e.target.value as CrmConfig["avance_modo"] })}>
                  <option value="SUGERIR">Sugerir (recomendado)</option>
                  <option value="AUTOMATICO">Automático</option>
                </select>
              </Field>
              <Field label="Cortes de nivel (frío → caliente)" hint="El score 0–100 se parte en 5 niveles según estos 4 cortes.">
                <div className="flex flex-wrap items-center gap-2">
                  {cfg.niveles_umbral.map((c, i) => (
                    <div key={i} className="flex items-center gap-1">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: TEMPERATURA_META[NIVELES[i + 1]].color }} />
                      <input type="number" min={1} max={99} className="input w-16 text-center" value={c}
                        onChange={(e) => setCfg({ ...cfg, niveles_umbral: cfg.niveles_umbral.map((x, j) => (j === i ? Number(e.target.value) : x)) })} />
                    </div>
                  ))}
                </div>
              </Field>
            </div>

            {/* Avanzado: perillas de experto, colapsadas para no abrumar */}
            <div className="mt-5 border-t border-surface-border pt-3">
              <button
                onClick={() => setAvanzadoOpen((o) => !o)}
                className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-navy"
              >
                <ChevronDown size={15} className={`transition-transform ${avanzadoOpen ? "rotate-180" : ""}`} />
                Ajustes avanzados
                {!avanzadoOpen && <span className="text-xs font-normal text-gray-400">— score inicial, enfriamiento, sensibilidad</span>}
              </button>
              {avanzadoOpen && (
                <div className="mt-3 grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
                  <Field label="Score inicial" hint="Con qué score nace un deal sin actividad.">
                    <input type="number" min={0} max={100} className="input" value={cfg.score_inicial} onChange={(e) => setCfg({ ...cfg, score_inicial: Number(e.target.value) })} />
                  </Field>
                  <Field label="Días de gracia" hint="Días sin actividad antes de empezar a enfriar.">
                    <input type="number" min={1} className="input" value={cfg.umbral_inactividad_dias} onChange={(e) => setCfg({ ...cfg, umbral_inactividad_dias: Number(e.target.value) })} />
                  </Field>
                  <Field label="Enfría por día" hint="Puntos que pierde por cada día de inactividad pasado el umbral.">
                    <input type="number" min={0} className="input" value={cfg.decay_por_dia} onChange={(e) => setCfg({ ...cfg, decay_por_dia: Number(e.target.value) })} />
                  </Field>
                  <Field label="Sensibilidad de probabilidad" hint="En etapas sin umbral, cuánto mueve el score a la probabilidad.">
                    <input type="number" min={0} max={5} step={0.1} className="input" value={cfg.sensibilidad_prob} onChange={(e) => setCfg({ ...cfg, sensibilidad_prob: Number(e.target.value) })} />
                  </Field>
                </div>
              )}
            </div>

            <div className="mt-4 flex justify-end">
              <button onClick={guardarParams} disabled={saving} className="btn-primary justify-center">
                {saving ? "Guardando…" : "Guardar parámetros"}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ③ QUÉ RESULTA ──────────────────────────────────────────── */}
      {cfg && (
        <section>
          <SectionTitle icon={<Gauge size={16} />} n="3" title="Qué resulta" sub="El efecto de esta configuración sobre el pipeline real. Solo lectura." />
          <div className="rounded-xl border border-surface-border bg-white p-5">
            {/* Banda de niveles 0–100 según los cortes */}
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Bandas de nivel (0–100)</div>
            <div className="flex h-6 w-full overflow-hidden rounded-md">
              {NIVELES.map((n, i) => {
                const lo = i === 0 ? 0 : cfg.niveles_umbral[i - 1];
                const hi = i === NIVELES.length - 1 ? 100 : cfg.niveles_umbral[i];
                const w = Math.max(0, hi - lo);
                return (
                  <div key={n} className="flex items-center justify-center text-[10px] font-bold text-white" style={{ width: `${w}%`, background: TEMPERATURA_META[n].color }} title={`${TEMPERATURA_META[n].label}: ${lo}–${hi}`}>
                    {w >= 12 ? TEMPERATURA_META[n].label : ""}
                  </div>
                );
              })}
            </div>

            {/* Distribución real de deals por nivel (audit endpoint) */}
            <div className="mb-1 mt-5 flex items-baseline justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Distribución de deals abiertos</span>
              <span className="text-xs text-gray-400">{dist ? `${totalDeals} deals` : "cargando…"}</span>
            </div>
            {dist && (
              <div className="space-y-1.5">
                {NIVELES.map((n) => {
                  const c = dist[n] ?? 0;
                  const pct = totalDeals > 0 ? (c / totalDeals) * 100 : 0;
                  return (
                    <div key={n} className="flex items-center gap-2">
                      <span className="w-24 shrink-0 text-xs text-gray-500">{TEMPERATURA_META[n].label}</span>
                      <div className="h-4 flex-1 rounded bg-gray-100">
                        <div className="h-full rounded" style={{ width: `${Math.max(pct, c > 0 ? 3 : 0)}%`, background: TEMPERATURA_META[n].color }} />
                      </div>
                      <span className="w-8 shrink-0 text-right text-xs font-medium tabular-nums text-gray-600">{c}</span>
                    </div>
                  );
                })}
              </div>
            )}
            <p className="mt-4 border-t border-surface-border pt-3 text-xs text-gray-400">
              Si al mover pesos/factores/cortes la distribución se corre hacia frío o caliente, es el efecto directo de este cambio.
            </p>
          </div>
        </section>
      )}

      {/* ④ EL SCORE EN EL PIPELINE ──────────────────────────────── */}
      {etapasActivas.length > 0 && (
        <section>
          <SectionTitle icon={<Workflow size={16} />} n="4" title="El score en el pipeline" sub="Etapa y score no son sistemas separados: cada etapa tiene una probabilidad base y el score mueve la probabilidad del deal desde esa base hacia la de la etapa siguiente." />
          <div className="rounded-xl border border-surface-border bg-white p-5">
            {/* Escalera de probabilidad: se ve el vínculo etapa → probabilidad */}
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Escalera de probabilidad por etapa</div>
            <div className="space-y-1.5">
              {etapasActivas.map((s) => (
                <div key={s.id} className="flex items-center gap-3">
                  <span className="flex w-40 shrink-0 items-center gap-1.5 text-xs text-gray-600">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.color }} />
                    <span className="truncate">{s.nombre}</span>
                  </span>
                  <div className="h-5 flex-1 rounded bg-gray-100">
                    <div className="flex h-full items-center justify-end rounded px-2 text-[10px] font-bold text-white" style={{ width: `${Math.max(6, s.probabilidad_base)}%`, background: s.color }}>
                      {s.probabilidad_base}%
                    </div>
                  </div>
                  <span className="w-24 shrink-0 text-right text-[11px] text-gray-400">
                    {s.umbral_avance_score != null ? `avanza ≥ ${s.umbral_avance_score}` : "sin umbral"}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-start gap-2 rounded-lg bg-surface p-3 text-xs text-gray-500">
              <Gauge size={14} className="mt-0.5 shrink-0 text-gray-400" />
              <p>
                Con <b>umbral de avance</b> cargado, el score interpola la probabilidad entre la etapa actual y la
                siguiente, y al alcanzarlo sugiere avanzar. Sin umbral (<i>“sin umbral”</i>), el score solo empuja la
                base según la sensibilidad. La probabilidad base y el umbral se editan en la pestaña{" "}
                <b>Etapas del Pipeline</b>.
              </p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

// ── Subcomponentes de layout ──
function SectionTitle({ icon, n, title, sub }: { icon: React.ReactNode; n: string; title: string; sub: string }) {
  return (
    <div className="mb-3 flex items-start gap-2.5">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-navy text-[11px] font-bold text-white">{n}</span>
      <div>
        <h2 className="flex items-center gap-1.5 text-base font-semibold text-navy">{icon} {title}</h2>
        <p className="mt-0.5 text-sm text-gray-500">{sub}</p>
      </div>
    </div>
  );
}
function Card({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-surface-border bg-white p-4">
      <div className="mb-2">
        <h3 className="text-sm font-semibold text-navy">{title}</h3>
        <p className="text-xs text-gray-400">{hint}</p>
      </div>
      {children}
    </div>
  );
}
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{label}</span>
      {children}
      {hint && <span className="mt-0.5 block text-[11px] leading-tight text-gray-400">{hint}</span>}
    </label>
  );
}
function AddRow({ value, setValue, onAdd, placeholder }: { value: string; setValue: (v: string) => void; onAdd: () => void; placeholder: string }) {
  return (
    <div className="mt-3 flex gap-2">
      <input value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => e.key === "Enter" && onAdd()} placeholder={placeholder} className="input flex-1 py-1.5 text-sm" />
      <button onClick={onAdd} className="btn-primary shrink-0"><Plus size={16} /> Agregar</button>
    </div>
  );
}
