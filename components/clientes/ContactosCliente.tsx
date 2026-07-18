"use client";

import { useEffect, useState, useCallback } from "react";
import { Star, Pencil, Trash2, UserPlus, Check, X, Phone, Mail } from "lucide-react";
import type { ContactoCliente } from "@/types/crm";

interface Datos { nombre: string; cargo: string; email: string; telefono: string; whatsapp: string }
const vacio: Datos = { nombre: "", cargo: "", email: "", telefono: "", whatsapp: "" };
const deContacto = (c: ContactoCliente): Datos => ({
  nombre: c.nombre, cargo: c.cargo ?? "", email: c.email ?? "", telefono: c.telefono ?? "", whatsapp: c.whatsapp ?? "",
});

interface Props {
  clienteId: string;
  canWrite: boolean;
  /** Se llama tras cambiar el principal (Cliente.contacto/email/telefono cambian). */
  onPrincipalChange?: () => void;
}

// Gestor de contactos del cliente (Bloque C): listar, agregar, editar, eliminar,
// marcar principal. El principal espeja Cliente.contacto/email/telefono.
export default function ContactosCliente({ clienteId, canWrite, onPrincipalChange }: Props) {
  const [contactos, setContactos] = useState<ContactoCliente[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [agregando, setAgregando] = useState(false);
  const [form, setForm] = useState<Datos>(vacio);

  const cargar = useCallback(async () => {
    setCargando(true);
    const res = await fetch(`/api/clientes/${clienteId}/contactos`);
    if (res.ok) setContactos((await res.json()).contactos);
    setCargando(false);
  }, [clienteId]);

  // Cargar los contactos al montar. Fetchear datos es la razón de ser de un efecto; el
  // setState (loading + resultado) es intrínseco a eso. La regla es conservadora acá.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { cargar(); }, [cargar]);

  async function req(url: string, method: string, body?: unknown): Promise<boolean> {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        setError((await res.json().catch(() => ({}))).error ?? "No se pudo completar la acción");
        return false;
      }
      return true;
    } finally {
      setBusy(false);
    }
  }

  async function guardar(contactoId: string | null) {
    if (!form.nombre.trim()) return setError("El nombre es obligatorio");
    const url = contactoId ? `/api/clientes/${clienteId}/contactos/${contactoId}` : `/api/clientes/${clienteId}/contactos`;
    const ok = await req(url, contactoId ? "PATCH" : "POST", form);
    if (ok) { setEditId(null); setAgregando(false); setForm(vacio); await cargar(); }
  }

  async function eliminar(contactoId: string) {
    const ok = await req(`/api/clientes/${clienteId}/contactos/${contactoId}`, "DELETE");
    if (ok) { await cargar(); onPrincipalChange?.(); }
  }

  async function hacerPrincipal(contactoId: string) {
    const ok = await req(`/api/clientes/${clienteId}/contactos/${contactoId}`, "PATCH", { es_principal: true });
    if (ok) { await cargar(); onPrincipalChange?.(); }
  }

  const inputCls = "w-full rounded border border-surface-border px-2 py-1 text-xs";
  const formFields = (
    <div className="flex flex-col gap-1.5">
      <input className={inputCls} placeholder="Nombre *" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
      <div className="grid grid-cols-2 gap-1.5">
        <input className={inputCls} placeholder="Cargo" value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} />
        <input className={inputCls} placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input className={inputCls} placeholder="Teléfono" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
        <input className={inputCls} placeholder="WhatsApp" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} />
      </div>
    </div>
  );

  return (
    <div className="rounded-lg border border-surface-border bg-gray-50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-navy">Contactos del cliente</span>
        {canWrite && !agregando && editId === null && (
          <button type="button" onClick={() => { setAgregando(true); setForm(vacio); }} className="flex items-center gap-1 text-[11px] font-semibold text-navy hover:underline">
            <UserPlus size={12} /> Agregar
          </button>
        )}
      </div>

      {error && <p className="mb-2 text-[11px] text-red-600">{error}</p>}
      {cargando && <p className="text-[11px] text-gray-400">Cargando…</p>}

      <div className="flex flex-col gap-2">
        {contactos.map((c) =>
          editId === c.id ? (
            <div key={c.id} className="rounded border border-surface-border bg-white p-2">
              {formFields}
              <div className="mt-1.5 flex gap-1.5">
                <button type="button" disabled={busy} onClick={() => guardar(c.id)} className="flex items-center gap-1 rounded bg-navy px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-50"><Check size={11} /> Guardar</button>
                <button type="button" onClick={() => setEditId(null)} className="flex items-center gap-1 rounded border border-surface-border px-2 py-1 text-[11px]"><X size={11} /> Cancelar</button>
              </div>
            </div>
          ) : (
            <div key={c.id} className="flex items-start justify-between gap-2 rounded border border-surface-border bg-white p-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-semibold text-navy">{c.nombre}</span>
                  {c.es_principal && <span className="flex items-center gap-0.5 rounded bg-navy/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-navy"><Star size={9} /> Principal</span>}
                  {c.cargo && <span className="text-[10px] text-gray-400">· {c.cargo}</span>}
                </div>
                <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-gray-500">
                  {c.email && <span className="flex items-center gap-1"><Mail size={10} /> {c.email}</span>}
                  {c.telefono && <span className="flex items-center gap-1"><Phone size={10} /> {c.telefono}</span>}
                </div>
              </div>
              {canWrite && (
                <div className="flex shrink-0 items-center gap-1.5">
                  {!c.es_principal && (
                    <button type="button" onClick={() => hacerPrincipal(c.id)} className="text-gray-400 hover:text-navy" title="Marcar como principal"><Star size={13} /></button>
                  )}
                  <button type="button" onClick={() => { setEditId(c.id); setForm(deContacto(c)); }} className="text-gray-400 hover:text-navy" title="Editar"><Pencil size={13} /></button>
                  {contactos.length > 1 && (
                    <button type="button" onClick={() => eliminar(c.id)} className="text-gray-400 hover:text-red-600" title="Eliminar"><Trash2 size={13} /></button>
                  )}
                </div>
              )}
            </div>
          )
        )}
      </div>

      {agregando && (
        <div className="mt-2 rounded border border-surface-border bg-white p-2">
          {formFields}
          <div className="mt-1.5 flex gap-1.5">
            <button type="button" disabled={busy} onClick={() => guardar(null)} className="flex items-center gap-1 rounded bg-navy px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-50"><Check size={11} /> Agregar</button>
            <button type="button" onClick={() => setAgregando(false)} className="flex items-center gap-1 rounded border border-surface-border px-2 py-1 text-[11px]"><X size={11} /> Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}
