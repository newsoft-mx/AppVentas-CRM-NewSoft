"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Calculator, ExternalLink, Plus } from "lucide-react";
import { formatFechaHora } from "@/lib/utils";

interface CasoVinculado {
  id: string;
  nombre: string;
  updated_at: string;
}

// Fase 2 del Simulador: lista los casos de negocio vinculados a ESTE deal y permite
// abrirlos en el simulador (deep-link ?caso=) o crear uno nuevo ya vinculado (?deal=).
// Solo lectura acá: el guardado/borrado vive en el propio simulador (SSOT).
export default function CasosNegocioDeal({ dealId }: { dealId: string }) {
  const [casos, setCasos] = useState<CasoVinculado[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let vivo = true;
    fetch(`/api/simulador/casos?deal_id=${dealId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => vivo && setCasos(data))
      .catch(() => vivo && setError(true));
    return () => {
      vivo = false;
    };
  }, [dealId]);

  return (
    <div className="flex flex-col gap-2">
      {casos === null && !error && <p className="text-[11px] text-gray-400">Cargando…</p>}
      {error && <p className="text-[11px] text-red-500">No se pudieron cargar los casos.</p>}
      {casos?.length === 0 && (
        <p className="text-[11px] text-gray-400">Sin casos de negocio vinculados.</p>
      )}
      {casos?.map((c) => (
        <Link
          key={c.id}
          href={`/simulador?caso=${c.id}`}
          className="group flex items-center gap-2 rounded-lg border border-surface-border px-2.5 py-2
                     hover:border-navy hover:bg-surface"
        >
          <Calculator size={14} className="shrink-0 text-navy" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12px] font-medium text-navy">{c.nombre}</span>
            <span className="block text-[10px] text-gray-400">{formatFechaHora(c.updated_at)}</span>
          </span>
          <ExternalLink size={13} className="shrink-0 text-gray-300 group-hover:text-navy" />
        </Link>
      ))}
      <Link
        href={`/simulador?deal=${dealId}`}
        className="flex items-center gap-1.5 pt-0.5 text-[11px] font-semibold text-orange hover:underline"
      >
        <Plus size={13} /> Nuevo caso para este deal
      </Link>
    </div>
  );
}
