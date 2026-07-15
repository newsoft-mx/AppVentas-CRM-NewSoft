"use client";

import { useEffect, useState } from "react";
import { Save } from "lucide-react";

// Config de la integración web → CRM (buzón fijo que recibe los leads del formulario del
// sitio). El endpoint público es POST /api/public/leads (protegido por API key en Vercel).
export default function TabLeadsWeb({ vendedores }: { vendedores: { id: string; nombre: string }[] }) {
  const [buzon, setBuzon] = useState<string>("");
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "err"; texto: string } | null>(null);

  useEffect(() => {
    fetch("/api/configuracion/crm-config")
      .then((r) => (r.ok ? r.json() : null))
      .then((cfg) => cfg && setBuzon(cfg.vendedor_leads_web_id ?? ""));
  }, []);

  async function guardar() {
    setGuardando(true);
    setMsg(null);
    const res = await fetch("/api/configuracion/crm-config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vendedor_leads_web_id: buzon || null }),
    });
    setGuardando(false);
    setMsg(res.ok ? { tipo: "ok", texto: "Buzón guardado." } : { tipo: "err", texto: "No se pudo guardar." });
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-navy">Leads web</h2>
        <p className="mt-1 text-sm text-gray-500">
          El formulario del sitio crea prospectos en el pipeline vía el endpoint público. Acá se define quién
          los recibe.
        </p>
      </div>

      <div>
        <label className="label">Buzón — vendedor que recibe los leads web</label>
        <select className="input max-w-md" value={buzon} onChange={(e) => setBuzon(e.target.value)}>
          <option value="">Sin asignar (bandeja)</option>
          {vendedores.map((v) => (
            <option key={v.id} value={v.id}>{v.nombre}</option>
          ))}
        </select>
        <p className="mt-1 text-xs text-gray-400">
          Los leads entran en la primera etapa, canal <b>Web</b> / origen <b>Formulario web</b>. Si queda
          &ldquo;sin asignar&rdquo;, un admin los reparte desde el pipeline.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={guardar} disabled={guardando} className="btn-primary">
          <Save size={15} /> {guardando ? "Guardando…" : "Guardar"}
        </button>
        {msg && (
          <span className={`text-sm ${msg.tipo === "ok" ? "text-emerald-600" : "text-red-600"}`}>{msg.texto}</span>
        )}
      </div>

      <div className="rounded-lg border border-surface-border bg-surface p-4 text-xs text-gray-500">
        <p className="font-semibold text-navy">Para quien integra el sitio</p>
        <p className="mt-1">
          <code>POST /api/public/leads</code> con header <code>X-API-Key</code> (la clave se configura en las env
          vars de Vercel: <code>LEADS_API_KEY</code>). Body:{" "}
          <code>{`{ nombre, email, telefono, empresa, website, mensaje }`}</code>.
          Campo oculto anti-bot: <code>_hp</code> (debe ir vacío). El contrato completo está en
          <code> docs/operaciones/INTAKE_LEADS_WEB.md</code>.
        </p>
      </div>
    </div>
  );
}
