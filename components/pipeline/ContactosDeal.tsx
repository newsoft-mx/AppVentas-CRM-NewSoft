"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Phone, Mail, MessageCircle, Star, Pencil, Trash2, UserPlus, Check, X } from "lucide-react";
import { ROL_CONTACTO_LABEL, type DealContactoItem, type RolContacto, type ContactoCliente } from "@/types/crm";

// Saneo de teléfono: tel: admite +, wa.me solo dígitos (SOL-15).
const telHref = (t: string) => `tel:${t.replace(/[^\d+]/g, "")}`;
const waHref = (t: string) => `https://wa.me/${t.replace(/\D/g, "")}`;
const ROLES: RolContacto[] = ["DECISOR", "INFLUENCIADOR", "USUARIO", "OTRO"];
const iniciales = (n: string) => n.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

interface Datos { nombre: string; cargo: string; email: string; telefono: string; whatsapp: string }
const vacio: Datos = { nombre: "", cargo: "", email: "", telefono: "", whatsapp: "" };

interface Props {
  dealId: string;
  clienteId: string | null;
  contactos: DealContactoItem[];
  canWrite: boolean;
  onError: (msg: string) => void;
  /** Preselecciona este contacto (por id de link) en el compositor de bitácora. */
  onSelect: (linkId: string) => void;
}

export default function ContactosDeal({ dealId, clienteId, contactos, canWrite, onError, onSelect }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState<string | null>(null); // contacto_id en edición
  const [form, setForm] = useState<Datos>(vacio);
  const [agregando, setAgregando] = useState(false);
  const [rolNuevo, setRolNuevo] = useState<RolContacto>("OTRO");
  const [contactoElegido, setContactoElegido] = useState(""); // "" = nuevo
  const [opciones, setOpciones] = useState<ContactoCliente[]>([]);

  async function req(url: string, method: string, body?: unknown): Promise<boolean> {
    setBusy(true);
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        onError(e.error ?? "No se pudo completar la acción");
        return false;
      }
      return true;
    } finally {
      setBusy(false);
    }
  }

  function abrirEdicion(c: DealContactoItem) {
    setEditId(c.contacto_id);
    setForm({
      nombre: c.nombre,
      cargo: c.cargo ?? "",
      email: c.email ?? "",
      telefono: c.telefono ?? "",
      whatsapp: c.whatsapp ?? "",
    });
  }

  async function guardarEdicion(contactoId: string) {
    if (!clienteId || !form.nombre.trim()) return onError("El nombre es obligatorio");
    const ok = await req(`/api/clientes/${clienteId}/contactos/${contactoId}`, "PATCH", {
      nombre: form.nombre, cargo: form.cargo, email: form.email, telefono: form.telefono, whatsapp: form.whatsapp,
    });
    if (ok) { setEditId(null); router.refresh(); }
  }

  async function cambiarRol(linkId: string, rol: RolContacto) {
    const ok = await req(`/api/crm/deals/${dealId}/contactos/${linkId}`, "PATCH", { rol });
    if (ok) router.refresh();
  }

  async function quitar(linkId: string) {
    const ok = await req(`/api/crm/deals/${dealId}/contactos/${linkId}`, "DELETE");
    if (ok) router.refresh();
  }

  async function abrirAgregar() {
    setAgregando(true);
    setContactoElegido("");
    setRolNuevo("OTRO");
    setForm(vacio);
    if (!clienteId) return;
    // Contactos del cliente que aún no están en el deal
    const res = await fetch(`/api/clientes/${clienteId}/contactos`);
    if (res.ok) {
      const data = (await res.json()) as { contactos: ContactoCliente[] };
      const yaLinkeados = new Set(contactos.map((c) => c.contacto_id));
      setOpciones(data.contactos.filter((c) => !yaLinkeados.has(c.id)));
    }
  }

  async function confirmarAgregar() {
    const body: Record<string, unknown> = { rol: rolNuevo };
    if (contactoElegido) {
      body.contacto_id = contactoElegido;
    } else {
      if (!form.nombre.trim()) return onError("El nombre es obligatorio");
      Object.assign(body, {
        nombre: form.nombre, cargo: form.cargo, email: form.email, telefono: form.telefono, whatsapp: form.whatsapp,
      });
    }
    const ok = await req(`/api/crm/deals/${dealId}/contactos`, "POST", body);
    if (ok) { setAgregando(false); router.refresh(); }
  }

  const inputCls = "w-full rounded border border-surface-border px-2 py-1 text-[11px]";

  return (
    <div>
      {contactos.length === 0 && <p className="text-xs text-gray-400">Sin contactos</p>}
      {contactos.map((c) => {
        const enEdicion = editId === c.contacto_id;
        return (
          <div key={c.id} className="mb-3 flex items-start gap-2.5 last:mb-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy text-[11px] font-bold text-white">
              {iniciales(c.nombre)}
            </div>
            <div className="min-w-0 flex-1">
              {enEdicion ? (
                <div className="flex flex-col gap-1">
                  <input className={inputCls} placeholder="Nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
                  <input className={inputCls} placeholder="Cargo" value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} />
                  <input className={inputCls} placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  <input className={inputCls} placeholder="Teléfono" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
                  <input className={inputCls} placeholder="WhatsApp" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} />
                  <div className="flex gap-1.5">
                    <button disabled={busy} onClick={() => guardarEdicion(c.contacto_id)} className="flex items-center gap-1 rounded bg-navy px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-50">
                      <Check size={11} /> Guardar
                    </button>
                    <button onClick={() => setEditId(null)} className="flex items-center gap-1 rounded border border-surface-border px-2 py-1 text-[11px]">
                      <X size={11} /> Cancelar
                    </button>
                  </div>
                  {c.es_principal && <span className="text-[9px] text-gray-400">Editar acá también actualiza la ficha del cliente (contacto principal).</span>}
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs font-semibold text-navy">{c.nombre}</span>
                    {c.es_principal && (
                      <span className="rounded bg-navy/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-navy">Principal</span>
                    )}
                    {c.rol === "DECISOR" && (
                      <span className="flex items-center gap-0.5 rounded bg-orange/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-orange">
                        <Star size={9} /> Decisor
                      </span>
                    )}
                    {c.cargo && <span className="text-[10px] text-gray-400">· {c.cargo}</span>}
                  </div>
                  {canWrite && (
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <select
                        value={c.rol}
                        onChange={(e) => cambiarRol(c.id, e.target.value as RolContacto)}
                        className="rounded border border-surface-border px-1 py-0.5 text-[10px] text-gray-600"
                      >
                        {ROLES.map((r) => <option key={r} value={r}>{ROL_CONTACTO_LABEL[r]}</option>)}
                      </select>
                      <button onClick={() => abrirEdicion(c)} className="text-gray-400 hover:text-navy" title="Editar contacto"><Pencil size={12} /></button>
                      {contactos.length > 1 && (
                        <button onClick={() => quitar(c.id)} className="text-gray-400 hover:text-red-600" title="Quitar del deal"><Trash2 size={12} /></button>
                      )}
                    </div>
                  )}
                  <div className="mt-1 flex flex-col gap-0.5">
                    {c.telefono && (
                      <a href={telHref(c.telefono)} onClick={() => onSelect(c.id)} className="flex items-center gap-1.5 text-[11px] text-blue-700 hover:underline">
                        <Phone size={11} className="shrink-0" /> {c.telefono}
                      </a>
                    )}
                    {c.email && (
                      <a href={`mailto:${c.email}`} onClick={() => onSelect(c.id)} className="flex min-w-0 items-center gap-1.5 text-[11px] text-blue-700 hover:underline">
                        <Mail size={11} className="shrink-0" /> <span className="truncate">{c.email}</span>
                      </a>
                    )}
                    {c.whatsapp && (
                      <a href={waHref(c.whatsapp)} target="_blank" rel="noopener noreferrer" onClick={() => onSelect(c.id)} className="flex items-center gap-1.5 text-[11px] text-green-700 hover:underline">
                        <MessageCircle size={11} className="shrink-0" /> {c.whatsapp}
                      </a>
                    )}
                    {!c.telefono && !c.email && !c.whatsapp && <span className="text-[10px] text-gray-400">Sin datos de contacto</span>}
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })}

      {canWrite && !agregando && (
        <button onClick={abrirAgregar} className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-navy hover:underline">
          <UserPlus size={12} /> Agregar contacto
        </button>
      )}

      {canWrite && agregando && (
        <div className="mt-2 flex flex-col gap-1 rounded border border-surface-border bg-surface p-2">
          {opciones.length > 0 && (
            <select className={inputCls} value={contactoElegido} onChange={(e) => setContactoElegido(e.target.value)}>
              <option value="">+ Nuevo contacto</option>
              {opciones.map((o) => <option key={o.id} value={o.id}>{o.nombre}{o.es_principal ? " (principal)" : ""}</option>)}
            </select>
          )}
          {!contactoElegido && (
            <>
              <input className={inputCls} placeholder="Nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
              <input className={inputCls} placeholder="Cargo" value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} />
              <input className={inputCls} placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <input className={inputCls} placeholder="Teléfono" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
              <input className={inputCls} placeholder="WhatsApp" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} />
            </>
          )}
          <select className={inputCls} value={rolNuevo} onChange={(e) => setRolNuevo(e.target.value as RolContacto)}>
            {ROLES.map((r) => <option key={r} value={r}>{ROL_CONTACTO_LABEL[r]}</option>)}
          </select>
          <div className="flex gap-1.5">
            <button disabled={busy} onClick={confirmarAgregar} className="flex items-center gap-1 rounded bg-navy px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-50">
              <Check size={11} /> Agregar
            </button>
            <button onClick={() => setAgregando(false)} className="flex items-center gap-1 rounded border border-surface-border px-2 py-1 text-[11px]">
              <X size={11} /> Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
