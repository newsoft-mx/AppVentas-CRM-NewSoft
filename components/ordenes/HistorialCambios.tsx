"use client";

import { useEffect, useState } from "react";
import { History, ChevronDown } from "lucide-react";
import type { CambioCampo } from "@/lib/auditoria";

// Historial de cambios de una ficha (bitácora de auditoría). Deliberadamente DISCRETO:
// colapsado por defecto y sin ocupar espacio visual — es trazabilidad para cuando se la
// necesita, no el contenido principal de la pantalla.
//
// Lo ve cualquier usuario que pueda ver la ficha: si alguien de gestión o ventas entra a una
// orden, tiene que poder ver qué se modificó. Es de solo lectura (append-only).

interface AuditoriaItem {
  id: string;
  accion: string;
  autor: string;
  cambios: CambioCampo[];
  created_at: string;
}

const fecha = (iso: string) =>
  new Date(iso).toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

export default function HistorialCambios({ entidad, entidadId }: { entidad: string; entidadId: string }) {
  const [abierto, setAbierto] = useState(false);
  const [items, setItems] = useState<AuditoriaItem[] | null>(null);
  // "No pudo cargarse" y "no hay cambios" son cosas distintas y se veían iguales: ante un
  // fallo se guardaba `[]`, y la pantalla decía "Sin cambios registrados". En una bitácora de
  // auditoría esa confusión es grave — el usuario concluye que nadie tocó el registro.
  const [fallo, setFallo] = useState(false);
  // Reintentar tiene que volver a pedir de verdad: sin esto, bajar `fallo` solo borra el
  // mensaje y la tarjeta se queda en "Cargando…" para siempre, porque el efecto no depende
  // de `fallo` y nunca se vuelve a disparar.
  const [intento, setIntento] = useState(0);

  // Se carga recién al abrir: si nadie lo mira, no cuesta nada.
  useEffect(() => {
    if (!abierto || items) return;
    let vivo = true;
    (async () => {
      try {
        const r = await fetch(`/api/auditoria?entidad=${entidad}&entidad_id=${entidadId}`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        if (vivo) { setItems(data); setFallo(false); }
      } catch {
        if (vivo) setFallo(true);
      }
    })();
    return () => { vivo = false; };
  }, [abierto, items, entidad, entidadId, intento]);

  return (
    <div className="rounded-lg border border-surface-border bg-white">
      <button
        onClick={() => setAbierto((a) => !a)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] font-medium text-gray-500 hover:text-navy"
      >
        <History size={13} />
        Historial de cambios
        {items && items.length > 0 && (
          <span className="rounded-full bg-surface px-1.5 py-0.5 text-[10px] font-semibold text-gray-500">
            {items.length}
          </span>
        )}
        <ChevronDown size={13} className={`ml-auto transition-transform ${abierto ? "rotate-180" : ""}`} />
      </button>

      {abierto && (
        <div className="border-t border-surface-border px-3 py-2">
          {items === null && !fallo && <p className="text-[11px] text-gray-500">Cargando…</p>}
          {/* Un fallo NO se muestra como "sin cambios": en una bitácora de auditoría, decir
              que no hay nada cuando en realidad no se pudo leer es peor que no decir nada. */}
          {fallo && (
            <p role="alert" className="flex flex-wrap items-center gap-2 text-[11px] text-red-600">
              No se pudo cargar el historial.
              <button
                type="button"
                onClick={() => { setFallo(false); setIntento((n) => n + 1); }}
                className="rounded border border-red-200 px-1.5 py-0.5 font-semibold hover:bg-red-50"
              >
                Reintentar
              </button>
            </p>
          )}
          {items?.length === 0 && !fallo && (
            <p className="text-[11px] text-gray-500">Sin cambios registrados.</p>
          )}
          <div className="space-y-2.5">
            {items?.map((it) => (
              <div key={it.id} className="text-[11px]">
                <div className="flex items-baseline justify-between gap-2 text-gray-400">
                  <span className="font-medium text-navy">{it.autor}</span>
                  <span className="shrink-0">{fecha(it.created_at)}</span>
                </div>
                <ul className="mt-0.5 space-y-0.5">
                  {it.cambios.map((c) => (
                    <li key={c.campo} className="text-gray-600">
                      {c.label}:{" "}
                      <span className="text-gray-400 line-through">{c.antes ?? "—"}</span>{" "}
                      <span className="text-navy">→ {c.despues ?? "—"}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
