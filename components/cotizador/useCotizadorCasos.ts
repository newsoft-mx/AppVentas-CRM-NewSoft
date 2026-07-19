"use client";

import { useEffect, useState } from "react";
import type { ToastData } from "@/components/ui/Toast";

// Persistencia compartida de TODOS los cotizadores (SSOT del guardar/cargar/borrar + vínculo a
// deal). Cada cotizador guarda el mismo shape (nombre, datos Json, deal_id) contra su endpoint;
// solo cambia `base` y cómo serializa/aplica su estado (getDatos/aplicarDatos). Antes esto vivía
// duplicado en cada herramienta (y en el HTML del simulador).

export interface CotizadorCasoMeta {
  id: string;
  nombre: string;
  deal_id: string | null;
  deal_nombre: string | null;
  updated_at: string;
}

export interface UseCotizadorCasos {
  nombre: string;
  setNombre: (v: string) => void;
  casos: CotizadorCasoMeta[];
  dealVinc: string | null;
  dealNombre: string | null;
  guardando: boolean;
  guardar: () => Promise<void>;
  cargar: (id: string, aviso?: boolean) => Promise<void>;
  borrar: (id: string, nombre: string) => Promise<void>;
  toast: ToastData | null;
  setToast: (t: ToastData | null) => void;
}

export function useCotizadorCasos<D>({
  base, casoInicial, dealId, entidad = "cotización", getDatos, aplicarDatos,
}: {
  /** Endpoint base, ej. "/api/calculadora/casos". */
  base: string;
  casoInicial: string | null;
  dealId: string | null;
  /** Etiqueta para los mensajes ("cotización", "caso"). */
  entidad?: string;
  /** Serializa el estado del cotizador a `datos` (Json). */
  getDatos: () => D;
  /** Aplica un `datos` cargado al estado del cotizador. */
  aplicarDatos: (datos: D) => void;
}): UseCotizadorCasos {
  const [nombre, setNombre] = useState("");
  const [casos, setCasos] = useState<CotizadorCasoMeta[]>([]);
  const [dealVinc, setDealVinc] = useState<string | null>(dealId);
  const [dealNombre, setDealNombre] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [toast, setToast] = useState<ToastData | null>(null);

  async function refrescar() {
    const r = await fetch(base);
    if (r.ok) setCasos(await r.json());
  }

  async function cargar(id: string, aviso = true) {
    const r = await fetch(`${base}/${id}`);
    if (!r.ok) { setToast({ type: "error", message: `No se pudo cargar la ${entidad}` }); return; }
    const c = await r.json();
    aplicarDatos(c.datos as D);
    setNombre(c.nombre);
    setDealVinc(c.deal_id ?? null);
    if (aviso) setToast({ type: "success", message: `Cargada "${c.nombre}"` });
  }

  async function guardar() {
    const n = nombre.trim();
    if (!n) { setToast({ type: "error", message: `Ponle un nombre a la ${entidad}` }); return; }
    setGuardando(true);
    try {
      const r = await fetch(base, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: n, datos: getDatos(), deal_id: dealVinc }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "No se pudo guardar");
      await refrescar();
      setToast({ type: "success", message: `Guardada "${n}"` });
    } catch (e) { setToast({ type: "error", message: e instanceof Error ? e.message : "Error" }); }
    finally { setGuardando(false); }
  }

  async function borrar(id: string, nom: string) {
    if (!window.confirm(`¿Eliminar "${nom}"?`)) return;
    const r = await fetch(`${base}/${id}`, { method: "DELETE" });
    if (r.ok) { await refrescar(); setToast({ type: "success", message: `${entidad[0].toUpperCase()}${entidad.slice(1)} eliminada` }); }
    else setToast({ type: "error", message: "No se pudo eliminar" });
  }

  // Lista al montar + (si vino ?caso=) abrir una. Fetch-on-mount.
  useEffect(() => {
    let vivo = true;
    (async () => {
      const r = await fetch(base);
      if (r.ok && vivo) setCasos(await r.json());
      if (casoInicial) await cargar(casoInicial, false);
    })();
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [casoInicial]);

  // Nombre del deal vinculado (chip). setState dentro del async (diferido) por la regla.
  useEffect(() => {
    let vivo = true;
    (async () => {
      if (!dealVinc) { if (vivo) setDealNombre(null); return; }
      const r = await fetch(`${base}?deal_id=${dealVinc}`);
      const cs: CotizadorCasoMeta[] = r.ok ? await r.json() : [];
      if (vivo) setDealNombre(cs.find((c) => c.deal_nombre)?.deal_nombre ?? "deal vinculado");
    })();
    return () => { vivo = false; };
  }, [dealVinc, base]);

  return { nombre, setNombre, casos, dealVinc, dealNombre, guardando, guardar, cargar, borrar, toast, setToast };
}
