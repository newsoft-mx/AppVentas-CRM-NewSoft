"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, Info, RefreshCw, ShieldCheck } from "lucide-react";

interface Check {
  id: string;
  bloque: string;
  tipo: "violacion" | "informativo";
  count: number;
  titulo: string;
  monto_mxn?: number;
}
interface Reporte {
  sano: boolean;
  violaciones: number;
  checks: Check[];
}

const BLOQUE_LABEL: Record<string, string> = {
  C: "Contactos",
  T: "Deal ↔ Orden",
  F: "Financiero",
  S: "SSOT / datos",
  E: "Estado",
};

// Vista legible del health-check de invariantes (/api/admin/health). Hace
// observable para un humano lo que el endpoint reporta en JSON (Bloque O).
export default function SaludClient() {
  const [data, setData] = useState<Reporte | null>(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);
  const [actualizado, setActualizado] = useState("");

  async function cargar() {
    setCargando(true);
    setError("");
    try {
      const res = await fetch("/api/admin/health");
      if (!res.ok) throw new Error(res.status === 403 ? "Solo administradores." : "No se pudo cargar el diagnóstico.");
      setData(await res.json());
      setActualizado(new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  const violaciones = data?.checks.filter((c) => c.tipo === "violacion") ?? [];
  const informativos = data?.checks.filter((c) => c.tipo === "informativo") ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-navy">
            <ShieldCheck size={22} /> Salud del sistema
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Verifica en vivo los invariantes de carga del negocio. Read-only, no modifica nada.
          </p>
        </div>
        <button
          onClick={cargar}
          disabled={cargando}
          className="flex items-center gap-1.5 rounded-lg border border-surface-border px-3 py-1.5 text-sm font-medium text-navy hover:bg-surface disabled:opacity-50"
        >
          <RefreshCw size={14} className={cargando ? "animate-spin" : ""} /> Actualizar
        </button>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {data && (
        <>
          {/* Banner de estado general */}
          <div
            className={`flex items-center gap-3 rounded-xl border p-4 ${
              data.sano ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"
            }`}
          >
            {data.sano ? (
              <CheckCircle2 className="shrink-0 text-emerald-600" size={28} />
            ) : (
              <XCircle className="shrink-0 text-red-600" size={28} />
            )}
            <div>
              <p className={`font-semibold ${data.sano ? "text-emerald-800" : "text-red-800"}`}>
                {data.sano ? "Todos los invariantes se cumplen" : `${data.violaciones} invariante(s) violado(s)`}
              </p>
              <p className="text-xs text-gray-500">{actualizado && `Verificado ${actualizado}`}</p>
            </div>
          </div>

          {/* Invariantes (violación = debe dar 0) */}
          <section>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-400">Invariantes</p>
            <div className="divide-y divide-surface-border overflow-hidden rounded-xl border border-surface-border bg-white">
              {violaciones.map((c) => {
                const ok = c.count === 0;
                return (
                  <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                    {ok ? (
                      <CheckCircle2 size={18} className="shrink-0 text-emerald-500" />
                    ) : (
                      <XCircle size={18} className="shrink-0 text-red-500" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-navy">{c.titulo}</p>
                      <p className="text-[11px] text-gray-400">{BLOQUE_LABEL[c.bloque] ?? c.bloque}</p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums ${
                        ok ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                      }`}
                    >
                      {c.count}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Informativos (números para decidir política) */}
          {informativos.length > 0 && (
            <section>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-400">Informativos</p>
              <div className="divide-y divide-surface-border overflow-hidden rounded-xl border border-surface-border bg-white">
                {informativos.map((c) => (
                  <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                    <Info size={18} className="shrink-0 text-blue-400" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-navy">{c.titulo}</p>
                      <p className="text-[11px] text-gray-400">{BLOQUE_LABEL[c.bloque] ?? c.bloque}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold tabular-nums text-navy">{c.count}</span>
                      {c.monto_mxn != null && (
                        <span className="ml-1 text-xs text-gray-400">
                          (${c.monto_mxn.toLocaleString("es-MX")} MXN)
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
