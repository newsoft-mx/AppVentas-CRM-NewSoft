"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ScrollText, Search, ExternalLink } from "lucide-react";
import type { CambioCampo, EntidadAuditable } from "@/lib/auditoria";

// Vista global de la bitácora (solo ADMIN): qué se tocó, quién y cuándo, en todos los
// módulos auditados. Solo lectura — la bitácora es append-only, así que no hay acciones.

export interface AuditoriaItem {
  id: string;
  entidad: string;
  entidad_id: string;
  accion: string;
  etiqueta: string | null;
  autor: string;
  cambios: CambioCampo[];
  created_at: string;
}

// Etiqueta legible + a dónde lleva cada módulo (para saltar a la ficha tocada).
const MODULO: Record<string, { label: string; href?: (id: string) => string }> = {
  orden_venta: { label: "Órdenes de venta", href: (id) => `/ventas/${id}` },
  cliente: { label: "Clientes", href: (id) => `/clientes/${id}` },
  configuracion: { label: "Configuración" },
  usuario: { label: "Usuarios y roles" },
};
const ACCION_CHIP: Record<string, string> = {
  CREAR: "bg-emerald-50 text-emerald-700",
  EDITAR: "bg-blue-50 text-blue-700",
  BORRAR: "bg-red-50 text-red-700",
};

const fecha = (iso: string) =>
  new Date(iso).toLocaleString("es-MX", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export default function AuditoriaClient({ initial }: { initial: AuditoriaItem[] }) {
  const [q, setQ] = useState("");
  const [modulo, setModulo] = useState<"" | EntidadAuditable>("");

  // Autores presentes, para filtrar por persona sin pedir un catálogo aparte.
  const autores = useMemo(() => [...new Set(initial.map((i) => i.autor))].sort(), [initial]);
  const [autor, setAutor] = useState("");

  const filtrados = useMemo(() => {
    const t = q.trim().toLowerCase();
    return initial.filter((i) => {
      if (modulo && i.entidad !== modulo) return false;
      if (autor && i.autor !== autor) return false;
      if (!t) return true;
      const enCambios = i.cambios.some((c) =>
        [c.label, c.antes, c.despues].some((v) => v?.toLowerCase().includes(t))
      );
      return i.autor.toLowerCase().includes(t) || i.etiqueta?.toLowerCase().includes(t) || enCambios;
    });
  }, [initial, q, modulo, autor]);

  const selectCls =
    "rounded-lg border border-surface-border bg-white px-2.5 py-1.5 text-xs text-navy outline-none focus:border-orange";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-navy">
          <ScrollText size={22} /> Bitácora
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Registro de cambios en los módulos sensibles: quién modificó qué y cuándo. Solo lectura.
        </p>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por usuario, registro o valor…"
            className="w-full rounded-lg border border-surface-border bg-white py-2 pl-9 pr-3 text-sm text-navy outline-none focus:border-orange"
          />
        </div>
        <select value={modulo} onChange={(e) => setModulo(e.target.value as EntidadAuditable | "")} className={selectCls} aria-label="Módulo">
          <option value="">Todos los módulos</option>
          {Object.entries(MODULO).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={autor} onChange={(e) => setAutor(e.target.value)} className={selectCls} aria-label="Usuario">
          <option value="">Todos los usuarios</option>
          {autores.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {/* Registros */}
      <div className="overflow-hidden rounded-xl border border-surface-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-border bg-gray-50 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              <th className="px-3 py-2.5">Cuándo</th>
              <th className="px-3 py-2.5">Quién</th>
              <th className="px-3 py-2.5">Módulo</th>
              <th className="px-3 py-2.5">Registro</th>
              <th className="px-3 py-2.5">Qué cambió</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            {filtrados.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-400">Sin movimientos que coincidan.</td></tr>
            )}
            {filtrados.map((i) => {
              const mod = MODULO[i.entidad] ?? { label: i.entidad };
              return (
                <tr key={i.id} className="align-top hover:bg-surface">
                  <td className="whitespace-nowrap px-3 py-2.5 text-[12px] text-gray-500">{fecha(i.created_at)}</td>
                  <td className="px-3 py-2.5 text-[13px] font-medium text-navy">{i.autor}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-col gap-1">
                      <span className="text-[12px] text-gray-600">{mod.label}</span>
                      <span className={`w-fit rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${ACCION_CHIP[i.accion] ?? "bg-gray-100 text-gray-600"}`}>
                        {i.accion}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-[12px]">
                    {mod.href ? (
                      <Link href={mod.href(i.entidad_id)} className="flex items-center gap-1 text-navy hover:text-orange hover:underline">
                        {i.etiqueta ?? "—"} <ExternalLink size={11} className="shrink-0" />
                      </Link>
                    ) : (
                      <span className="text-gray-600">{i.etiqueta ?? "—"}</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <ul className="space-y-0.5 text-[12px]">
                      {i.cambios.map((c) => (
                        <li key={c.campo} className="text-gray-600">
                          {c.label}:{" "}
                          <span className="text-gray-400 line-through">{c.antes ?? "—"}</span>{" "}
                          <span className="text-navy">→ {c.despues ?? "—"}</span>
                        </li>
                      ))}
                      {i.cambios.length === 0 && <li className="text-gray-400">—</li>}
                    </ul>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400">
        {filtrados.length} de {initial.length} movimientos · se muestran los 200 más recientes
      </p>
    </div>
  );
}
