"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import SearchableSelect from "@/components/ui/SearchableSelect";
import { TEMPERATURA_META, ROL_CONTACTO_LABEL, type DealResumen, type StageResumen, type Temperatura, type RolContacto } from "@/types/crm";

interface Props {
  stages: StageResumen[];
  vendedores: { id: string; nombre: string }[];
  clientes: { id: string; nombre: string }[];
  tipos: { id: string; nombre: string }[];
  onClose: () => void;
  onCreated: (deal: DealResumen) => void;
}

const TEMPS: Temperatura[] = ["MUY_FRIO", "FRIO", "TIBIO", "CALIENTE", "MUY_CALIENTE"];

export default function NuevoDealModal({ stages, vendedores, clientes, tipos, onClose, onCreated }: Props) {
  // Modo de cliente: existente o nuevo prospecto (REQ-02)
  const [modoCliente, setModoCliente] = useState<"existente" | "prospecto">("existente");
  const [form, setForm] = useState({
    nombre: "",
    cliente_id: "",
    prospecto_nombre: "",
    vendedor_id: "",
    stage_id: stages[0]?.id ?? "",
    tipo_cotizacion_id: "",
    temperatura: "TIBIO" as Temperatura,
    valor: "",
    setup: "",
    mensualidad: "",
    canal: "",
    origen: "",
    fecha_cierre_estimada: "",
    contacto_nombre: "",
    contacto_rol: "DECISOR" as RolContacto,
    contacto_email: "",
    contacto_telefono: "",
    contacto_whatsapp: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function guardar() {
    const clienteOk = modoCliente === "existente" ? form.cliente_id : form.prospecto_nombre.trim();
    if (!form.nombre.trim() || !clienteOk || !form.stage_id) {
      setError("Nombre del proyecto, cliente/prospecto y etapa son obligatorios.");
      return;
    }
    if (!form.contacto_nombre.trim()) {
      setError("El contacto es obligatorio: un deal debe tener al menos un contacto.");
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      const {
        contacto_nombre, contacto_rol, contacto_email, contacto_telefono, contacto_whatsapp,
        prospecto_nombre, cliente_id, ...rest
      } = form;
      const payload: Record<string, unknown> = {
        ...rest,
        contacto: {
          nombre: contacto_nombre,
          rol: contacto_rol,
          email: contacto_email,
          telefono: contacto_telefono,
          whatsapp: contacto_whatsapp,
        },
      };
      if (modoCliente === "existente") {
        payload.cliente_id = cliente_id;
      } else {
        payload.cliente_nuevo = { nombre: prospecto_nombre.trim() };
      }
      const res = await fetch("/api/crm/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Error");
      onCreated(data as DealResumen);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear el deal.");
      setGuardando(false);
    }
  }

  return (
    <Modal title="Nuevo Deal" onClose={onClose} size="lg">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Campo label="Nombre del proyecto *" full>
          <input className={inputCls} value={form.nombre} onChange={(e) => set("nombre", e.target.value)} placeholder="Ej. Portal de Proveedores" />
        </Campo>

        {/* Cliente: existente o nuevo prospecto */}
        <div className="sm:col-span-2">
          <div className="mb-1.5 flex items-center gap-2">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Cliente *</label>
            <div className="flex overflow-hidden rounded-md border border-surface-border text-[11px] font-semibold">
              <button type="button" onClick={() => setModoCliente("existente")} className={`px-2.5 py-1 ${modoCliente === "existente" ? "bg-navy text-white" : "text-gray-500"}`}>Existente</button>
              <button type="button" onClick={() => setModoCliente("prospecto")} className={`px-2.5 py-1 ${modoCliente === "prospecto" ? "bg-orange text-white" : "text-gray-500"}`}>Nuevo prospecto</button>
            </div>
          </div>
          {modoCliente === "existente" ? (
            <SearchableSelect
              options={clientes.map((c) => ({ id: c.id, label: c.nombre }))}
              value={form.cliente_id}
              onChange={(v) => set("cliente_id", v)}
              placeholder="Selecciona un cliente…"
              searchPlaceholder="Buscar cliente…"
            />
          ) : (
            <input className={inputCls} value={form.prospecto_nombre} onChange={(e) => set("prospecto_nombre", e.target.value)} placeholder="Empresa / nombre del prospecto" />
          )}
        </div>

        <Campo label="Vendedor (dueño)">
          <SearchableSelect
            options={vendedores.map((v) => ({ id: v.id, label: v.nombre }))}
            value={form.vendedor_id}
            onChange={(v) => set("vendedor_id", v)}
            placeholder="Sin asignar"
            searchPlaceholder="Buscar vendedor…"
          />
        </Campo>
        <Campo label="Etapa *">
          <SearchableSelect
            options={stages.map((s) => ({ id: s.id, label: s.nombre }))}
            value={form.stage_id}
            onChange={(v) => set("stage_id", v)}
            placeholder="Selecciona etapa…"
          />
        </Campo>
        <Campo label="Línea de producto">
          <SearchableSelect
            options={tipos.map((t) => ({ id: t.id, label: t.nombre }))}
            value={form.tipo_cotizacion_id}
            onChange={(v) => set("tipo_cotizacion_id", v)}
            placeholder="— Selecciona línea —"
            searchPlaceholder="Buscar línea…"
          />
        </Campo>
        <Campo label="Temperatura">
          <select className={inputCls} value={form.temperatura} onChange={(e) => set("temperatura", e.target.value as Temperatura)}>
            {TEMPS.map((t) => <option key={t} value={t}>{TEMPERATURA_META[t].label}</option>)}
          </select>
        </Campo>
        <Campo label="Valor total (MXN)">
          <input type="number" min={0} className={inputCls} value={form.valor} onChange={(e) => set("valor", e.target.value)} placeholder="0" />
        </Campo>
        <Campo label="Setup">
          <input type="number" min={0} className={inputCls} value={form.setup} onChange={(e) => set("setup", e.target.value)} placeholder="Opcional" />
        </Campo>
        <Campo label="Mensualidad">
          <input type="number" min={0} className={inputCls} value={form.mensualidad} onChange={(e) => set("mensualidad", e.target.value)} placeholder="Opcional" />
        </Campo>
        <Campo label="Canal">
          <input className={inputCls} value={form.canal} onChange={(e) => set("canal", e.target.value)} placeholder="Ej. WhatsApp API" />
        </Campo>
        <Campo label="Origen">
          <input className={inputCls} value={form.origen} onChange={(e) => set("origen", e.target.value)} placeholder="Ej. Referido" />
        </Campo>
        <Campo label="Cierre estimado">
          <input type="date" className={inputCls} value={form.fecha_cierre_estimada} onChange={(e) => set("fecha_cierre_estimada", e.target.value)} />
        </Campo>
      </div>

      {/* Contacto principal (obligatorio) */}
      <div className="mt-5 border-t border-surface-border pt-4">
        <div className="mb-3 text-[11px] font-bold uppercase tracking-wide text-gray-400">Contacto principal *</div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo label="Nombre del contacto *">
            <input className={inputCls} value={form.contacto_nombre} onChange={(e) => set("contacto_nombre", e.target.value)} placeholder="Ej. Irvin Álvarez" />
          </Campo>
          <Campo label="Rol">
            <select className={inputCls} value={form.contacto_rol} onChange={(e) => set("contacto_rol", e.target.value as RolContacto)}>
              {(["DECISOR", "INFLUENCIADOR", "USUARIO", "OTRO"] as RolContacto[]).map((r) => (
                <option key={r} value={r}>{ROL_CONTACTO_LABEL[r]}</option>
              ))}
            </select>
          </Campo>
          <Campo label="Email">
            <input type="email" className={inputCls} value={form.contacto_email} onChange={(e) => set("contacto_email", e.target.value)} placeholder="Opcional" />
          </Campo>
          <Campo label="Teléfono">
            <input className={inputCls} value={form.contacto_telefono} onChange={(e) => set("contacto_telefono", e.target.value)} placeholder="Opcional" />
          </Campo>
          <Campo label="WhatsApp">
            <input className={inputCls} value={form.contacto_whatsapp} onChange={(e) => set("contacto_whatsapp", e.target.value)} placeholder="Opcional" />
          </Campo>
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-lg border border-surface-border px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-surface">
          Cancelar
        </button>
        <button onClick={guardar} disabled={guardando} className="rounded-lg bg-orange px-4 py-2 text-sm font-semibold text-white hover:bg-orange/90 disabled:opacity-50">
          {guardando ? "Creando…" : "Crear deal"}
        </button>
      </div>
    </Modal>
  );
}

const inputCls =
  "w-full rounded-lg border border-surface-border bg-white px-3 py-2 text-sm text-navy outline-none focus:border-orange";

function Campo({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-400">{label}</label>
      {children}
    </div>
  );
}
