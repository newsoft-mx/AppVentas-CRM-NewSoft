"use client";

import { Save, FolderOpen, Trash2, Link2, Plus } from "lucide-react";
import Toast from "@/components/ui/Toast";
import type { UseCotizadorCasos } from "@/components/cotizador/useCotizadorCasos";

// Kit visual compartido de los cotizadores (Simulador, Calculadora, y los que vengan). Codifica
// el lenguaje del Simulador (navy/orange, paneles blancos radius 14, botones primary/ghost) para
// que TODOS luzcan igual: el cotizador solo aporta su cuerpo; header, toolbar, paneles, botones,
// tarjetas y tabs los pone el kit. La funcionalidad es única; el chrome es consistente.

// ── Botón ──────────────────────────────────────────────────────
const BTN: Record<"primary" | "default" | "ghost", string> = {
  primary: "bg-navy text-white border-navy hover:bg-navy-700",
  default: "border-surface-border text-gray-600 hover:border-navy hover:bg-surface",
  ghost: "border-transparent text-gray-500 hover:bg-surface hover:text-navy",
};
export function CotizadorButton({
  variant = "default", className = "", children, ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof BTN }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-45 disabled:cursor-not-allowed ${BTN[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

// ── Panel (card blanca estándar) ───────────────────────────────
export function Panel({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return <div className={`rounded-2xl border border-surface-border bg-white p-5 shadow-sm ${className}`}>{children}</div>;
}

// ── Stat card (tarjeta de resultado) ───────────────────────────
const STAT: Record<"accent" | "info" | "warn" | "default", string> = {
  accent: "bg-navy border-transparent text-white",
  info: "bg-blue-50 border-blue-200 text-blue-900",
  warn: "bg-orange-50 border-orange-200 text-orange-700",
  default: "bg-surface border-surface-border text-navy",
};
export function StatCard({
  label, value, sub, variant = "default",
}: { label: string; value: string; sub?: string; variant?: keyof typeof STAT }) {
  const muted = variant === "accent" ? "text-white/60" : variant === "default" ? "text-gray-500" : "opacity-70";
  return (
    <div className={`rounded-2xl border p-4 ${STAT[variant]}`}>
      <div className={`mb-1 text-xs ${muted}`}>{label}</div>
      <div className={`font-semibold tabular-nums ${variant === "accent" ? "text-2xl" : "text-xl"}`}>{value}</div>
      {sub && <div className={`mt-0.5 text-xs ${muted}`}>{sub}</div>}
    </div>
  );
}

// ── Tabs (segmented) ───────────────────────────────────────────
export function CotizadorTabs<T extends string>({
  value, onChange, tabs,
}: { value: T; onChange: (t: T) => void; tabs: [T, string][] }) {
  return (
    <div className="inline-flex gap-1 rounded-lg bg-gray-100 p-1">
      {tabs.map(([k, label]) => (
        <button key={k} onClick={() => onChange(k)}
          className={`rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors ${value === k ? "bg-navy text-white" : "text-gray-500 hover:text-navy"}`}>
          {label}
        </button>
      ))}
    </div>
  );
}

// ── Header (eyebrow + título + descripción + chip de deal) ──────
export function CotizadorHeader({
  eyebrow = "Newsoft · Plataformas Administradas", titulo, descripcion, icono, dealNombre,
}: {
  eyebrow?: string; titulo: string; descripcion?: string; icono?: React.ReactNode; dealNombre?: string | null;
}) {
  return (
    <div className="flex items-start gap-3">
      {icono && <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange text-white">{icono}</div>}
      <div className="flex-1">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-orange">{eyebrow}</p>
        <h1 className="text-2xl font-bold text-navy">{titulo}</h1>
        {descripcion && <p className="mt-0.5 text-sm text-gray-500">{descripcion}</p>}
      </div>
      {dealNombre && (
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-orange/10 px-2.5 py-1 text-[11px] font-semibold text-orange">
          <Link2 size={12} /> {dealNombre}
        </span>
      )}
    </div>
  );
}

// ── Toolbar (guardar / cargar / borrar) ────────────────────────
export function CotizadorToolbar({ casos, acciones, onNuevo }: {
  casos: UseCotizadorCasos;
  /** Botones extra a la derecha (ej. Exportar PDF). */
  acciones?: React.ReactNode;
  onNuevo?: () => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-surface-border bg-white px-4 py-3 shadow-sm">
        <input
          value={casos.nombre} onChange={(e) => casos.setNombre(e.target.value)} placeholder="Nombre de la cotización…"
          className="min-w-[200px] flex-1 rounded-lg border border-surface-border bg-white px-3 py-1.5 text-[13px] text-navy outline-none focus:border-navy"
        />
        <CotizadorButton variant="primary" onClick={casos.guardar} disabled={casos.guardando}>
          <Save size={13} /> {casos.guardando ? "Guardando…" : "Guardar"}
        </CotizadorButton>
        {casos.casos.length > 0 && (
          <label className="flex items-center gap-1.5 text-gray-400">
            <FolderOpen size={14} />
            <select value="" onChange={(e) => e.target.value && casos.cargar(e.target.value)}
              className="rounded-lg border border-surface-border bg-white px-2 py-1.5 text-[12px] text-navy outline-none focus:border-navy">
              <option value="">Cargar… ({casos.casos.length})</option>
              {casos.casos.map((c) => <option key={c.id} value={c.id}>{c.nombre}{c.deal_nombre ? ` · ${c.deal_nombre}` : ""}</option>)}
            </select>
          </label>
        )}
        {onNuevo && <CotizadorButton variant="ghost" onClick={onNuevo}><Plus size={13} /> Nuevo</CotizadorButton>}
        {acciones}
      </div>
      {casos.casos.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {casos.casos.map((c) => (
            <span key={c.id} className="flex items-center gap-1.5 rounded-full border border-surface-border bg-white px-2.5 py-1 text-[11px] text-gray-600">
              <button onClick={() => casos.cargar(c.id)} className="font-medium text-navy hover:text-orange">{c.nombre}</button>
              <button onClick={() => casos.borrar(c.id, c.nombre)} title="Eliminar" className="text-gray-300 hover:text-red-500"><Trash2 size={11} /></button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Shell (arma header + toolbar + toast + cuerpo) ─────────────
export function CotizadorShell({
  header, casos, acciones, onNuevo, children,
}: {
  header: { titulo: string; descripcion?: string; eyebrow?: string; icono?: React.ReactNode };
  casos: UseCotizadorCasos;
  acciones?: React.ReactNode;
  onNuevo?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="w-full space-y-5">
      {casos.toast && <Toast {...casos.toast} onClose={() => casos.setToast(null)} />}
      <CotizadorHeader {...header} dealNombre={casos.dealNombre} />
      <CotizadorToolbar casos={casos} acciones={acciones} onNuevo={onNuevo} />
      {children}
    </div>
  );
}
