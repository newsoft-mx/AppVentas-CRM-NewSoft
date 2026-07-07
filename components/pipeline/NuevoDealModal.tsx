"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
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
  const [form, setForm] = useState({
    nombre: "",
    cliente_id: "",
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
    if (!form.nombre.trim() || !form.cliente_id || !form.stage_id) {
      setError("Nombre, cliente y etapa son obligatorios.");
      return;
    }
    if (!form.contacto_nombre.trim()) {
      setError("El contacto es obligatorio: un deal debe tener al menos un contacto.");
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      const { contacto_nombre, contacto_rol, contacto_email, contacto_telefono, contacto_whatsapp, ...deal } = form;
      const res = await fetch("/api/crm/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...deal,
          contacto: {
            nombre: contacto_nombre,
            rol: contacto_rol,
            email: contacto_email,
            telefono: contacto_telefono,
            whatsapp: contacto_whatsapp,
          },
        }),
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
        <Campo label="Cliente *">
          <select className={inputCls} value={form.cliente_id} onChange={(e) => set("cliente_id", e.target.value)}>
            <option value="">Selecciona…</option>
            {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </Campo>
        <Campo label="Vendedor (dueño)">
          <select className={inputCls} value={form.vendedor_id} onChange={(e) => set("vendedor_id", e.target.value)}>
            <option value="">Sin asignar</option>
            {vendedores.map((v) => <option key={v.id} value={v.id}>{v.nombre}</option>)}
          </select>
        </Campo>
        <Campo label="Etapa *">
          <select className={inputCls} value={form.stage_id} onChange={(e) => set("stage_id", e.target.value)}>
            {stages.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </Campo>
        <Campo label="Tipo / línea de producto">
          <select className={inputCls} value={form.tipo_cotizacion_id} onChange={(e) => set("tipo_cotizacion_id", e.target.value)}>
            <option value="">—</option>
            {tipos.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
          </select>
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
