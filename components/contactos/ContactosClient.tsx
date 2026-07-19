"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Users, Search, Copy, Check, Mail, Phone, MessageCircle, X, ExternalLink, CalendarClock,
  Plus, Pencil, Trash2,
} from "lucide-react";
import Modal from "@/components/ui/Modal";
import SearchableSelect from "@/components/ui/SearchableSelect";
import Toast, { ToastData } from "@/components/ui/Toast";
import { ESTATUS_CLIENTE_META } from "@/types/clientes";
import { ROL_CONTACTO_LABEL, ROLES_CONTACTO, type EstatusCliente, type RolContacto } from "@/types/crm";
import { TIPO_ACTIVIDAD_META } from "@/lib/actividad-tipos";
import type {
  ContactoDirectorioItem, ContactoDetalle, ContactoFormInput, OrganizacionOpcion,
} from "@/types/contactos-directorio";

// Módulo Contactos — directorio de todos los contactos (clientes + prospectos): búsqueda,
// filtros estándar de CRM, copiar/usar canales (mailto/tel/wa), CRUD del contacto (reusa los
// endpoints /api/clientes/[id]/contactos) y un drawer con sus deals + timeline de acciones.

const fechaCorta = (iso: string) =>
  new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
const soloDigitos = (s: string) => s.replace(/[^\d]/g, "");
const waUrl = (n: string) => `https://wa.me/${soloDigitos(n)}`;

const VACIO: ContactoFormInput = { nombre: "", cargo: "", email: "", telefono: "", whatsapp: "" };

type Props = {
  initialContactos: ContactoDirectorioItem[];
  organizaciones: OrganizacionOpcion[];
  canWrite: boolean;
};
type FiltroEstatus = "TODOS" | EstatusCliente;
type FiltroDeals = "TODOS" | "CON" | "SIN";
type Orden = "NOMBRE" | "ACTIVIDAD";

export default function ContactosClient({ initialContactos, organizaciones, canWrite }: Props) {
  const [contactos, setContactos] = useState(initialContactos);
  const [q, setQ] = useState("");
  const [estatus, setEstatus] = useState<FiltroEstatus>("TODOS");
  const [orgId, setOrgId] = useState("");
  const [responsableId, setResponsableId] = useState("");
  const [rol, setRol] = useState<"" | RolContacto>("");
  const [conCorreo, setConCorreo] = useState(false);
  const [conTelefono, setConTelefono] = useState(false);
  const [conDeals, setConDeals] = useState<FiltroDeals>("TODOS");
  const [orden, setOrden] = useState<Orden>("NOMBRE");

  const [sel, setSel] = useState<Set<string>>(new Set());
  const [abierto, setAbierto] = useState<ContactoDirectorioItem | null>(null);
  const [creando, setCreando] = useState(false);
  const [toast, setToast] = useState<ToastData | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);

  // Opciones de filtro derivadas de los datos presentes (no reinventamos: son las de un CRM).
  const orgOpciones = useMemo(
    () => [...new Map(contactos.map((c) => [c.cliente.id, c.cliente])).values()]
      .sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [contactos]
  );
  const responsableOpciones = useMemo(
    () => [...new Map(contactos.flatMap((c) => c.responsables).map((r) => [r.id, r])).values()]
      .sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [contactos]
  );

  const filtrados = useMemo(() => {
    const t = q.trim().toLowerCase();
    const arr = contactos.filter((c) => {
      if (estatus !== "TODOS" && c.cliente.estatus !== estatus) return false;
      if (orgId && c.cliente.id !== orgId) return false;
      if (responsableId && !c.responsables.some((r) => r.id === responsableId)) return false;
      if (rol && !c.roles.includes(rol)) return false;
      if (conCorreo && !c.email) return false;
      if (conTelefono && !c.telefono && !c.whatsapp) return false;
      if (conDeals === "CON" && c.num_deals === 0) return false;
      if (conDeals === "SIN" && c.num_deals > 0) return false;
      if (!t) return true;
      return [c.nombre, c.cargo, c.email, c.telefono, c.whatsapp, c.cliente.nombre]
        .some((v) => v?.toLowerCase().includes(t));
    });
    return arr.sort((a, b) =>
      orden === "NOMBRE"
        ? a.nombre.localeCompare(b.nombre)
        : (b.ultima_actividad ?? "").localeCompare(a.ultima_actividad ?? "")
    );
  }, [contactos, q, estatus, orgId, responsableId, rol, conCorreo, conTelefono, conDeals, orden]);

  const correosSel = useMemo(
    () => filtrados.filter((c) => sel.has(c.id) && c.email).map((c) => c.email as string),
    [filtrados, sel]
  );

  async function copiar(texto: string, marca: string, aviso: string) {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(marca);
      setTimeout(() => setCopiado((m) => (m === marca ? null : m)), 1500);
      setToast({ type: "success", message: aviso });
    } catch {
      setToast({ type: "error", message: "No se pudo copiar" });
    }
  }
  const toggleSel = (id: string) =>
    setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const visiblesConCorreo = filtrados.filter((c) => c.email).map((c) => c.id);
  const todosSel = visiblesConCorreo.length > 0 && visiblesConCorreo.every((id) => sel.has(id));

  // ── CRUD (reusa /api/clientes/[id]/contactos) ──
  function alGuardado(item: ContactoDirectorioItem, esNuevo: boolean) {
    setContactos((cur) => (esNuevo ? [...cur, item] : cur.map((c) => (c.id === item.id ? item : c))));
    if (!esNuevo && abierto?.id === item.id) setAbierto(item);
  }
  function alBorrado(id: string) {
    setContactos((cur) => cur.filter((c) => c.id !== id));
    setAbierto(null);
  }

  const chip = (activo: boolean) =>
    `rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
      activo ? "border-navy bg-navy text-white" : "border-surface-border text-gray-500 hover:bg-surface"
    }`;
  const selectCls = "rounded-lg border border-surface-border bg-white px-2.5 py-1.5 text-xs text-navy outline-none focus:border-orange";

  return (
    <div className="space-y-4">
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-navy"><Users size={22} /> Contactos</h1>
          <p className="mt-1 text-sm text-gray-500">
            Directorio de todos los contactos de clientes y prospectos. Buscá, copiá correos o abrí uno para ver sus deals y actividad.
          </p>
        </div>
        {canWrite && (
          <button onClick={() => setCreando(true)}
            className="flex items-center gap-1.5 rounded-lg bg-navy px-3 py-2 text-sm font-semibold text-white hover:bg-navy-700">
            <Plus size={16} /> Nuevo contacto
          </button>
        )}
      </div>

      {/* Buscador + filtros */}
      <div className="space-y-2">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre, correo, organización, teléfono…"
            className="w-full rounded-lg border border-surface-border bg-white py-2 pl-9 pr-3 text-sm text-navy outline-none focus:border-orange" />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button onClick={() => setEstatus("TODOS")} className={chip(estatus === "TODOS")}>Todos</button>
          <button onClick={() => setEstatus("ACTIVO")} className={chip(estatus === "ACTIVO")}>Clientes</button>
          <button onClick={() => setEstatus("PROSPECTO")} className={chip(estatus === "PROSPECTO")}>Prospectos</button>
          <span className="mx-1 h-5 w-px bg-surface-border" />
          <select value={orgId} onChange={(e) => setOrgId(e.target.value)} className={selectCls} aria-label="Organización">
            <option value="">Toda organización</option>
            {orgOpciones.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
          </select>
          <select value={responsableId} onChange={(e) => setResponsableId(e.target.value)} className={selectCls} aria-label="Responsable">
            <option value="">Todo responsable</option>
            {responsableOpciones.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
          </select>
          <select value={rol} onChange={(e) => setRol(e.target.value as RolContacto | "")} className={selectCls} aria-label="Rol">
            <option value="">Todo rol</option>
            {ROLES_CONTACTO.map((r) => <option key={r} value={r}>{ROL_CONTACTO_LABEL[r]}</option>)}
          </select>
          <span className="mx-1 h-5 w-px bg-surface-border" />
          <button onClick={() => setConCorreo((v) => !v)} className={chip(conCorreo)}>Con correo</button>
          <button onClick={() => setConTelefono((v) => !v)} className={chip(conTelefono)}>Con teléfono</button>
          <button onClick={() => setConDeals(conDeals === "CON" ? "TODOS" : "CON")} className={chip(conDeals === "CON")}>Con deals</button>
          <button onClick={() => setConDeals(conDeals === "SIN" ? "TODOS" : "SIN")} className={chip(conDeals === "SIN")}>Sin deals</button>
          <span className="mx-1 h-5 w-px bg-surface-border" />
          <select value={orden} onChange={(e) => setOrden(e.target.value as Orden)} className={selectCls} aria-label="Orden">
            <option value="NOMBRE">Orden: A–Z</option>
            <option value="ACTIVIDAD">Orden: última actividad</option>
          </select>
        </div>
      </div>

      {/* Selección múltiple */}
      {sel.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-navy/20 bg-navy/5 px-4 py-2.5">
          <span className="text-sm font-semibold text-navy">{sel.size} seleccionado(s)</span>
          <span className="text-xs text-gray-500">{correosSel.length} con correo</span>
          <div className="ml-auto flex items-center gap-2">
            <button disabled={correosSel.length === 0}
              onClick={() => copiar(correosSel.join(", "), "sel", `${correosSel.length} correos copiados`)}
              className="flex items-center gap-1.5 rounded-lg bg-navy px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy-700 disabled:opacity-40">
              {copiado === "sel" ? <Check size={13} /> : <Copy size={13} />} Copiar correos
            </button>
            <button onClick={() => setSel(new Set())} className="text-xs font-medium text-gray-500 hover:text-navy">Limpiar</button>
          </div>
        </div>
      )}

      {/* Tabla */}
      <div className="overflow-hidden rounded-xl border border-surface-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-border bg-gray-50 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              <th className="w-10 px-3 py-2.5">
                <input type="checkbox" checked={todosSel}
                  onChange={() => setSel(todosSel ? new Set() : new Set(visiblesConCorreo))} aria-label="Seleccionar todos" />
              </th>
              <th className="px-3 py-2.5">Contacto</th>
              <th className="px-3 py-2.5">Organización</th>
              <th className="px-3 py-2.5">Correo</th>
              <th className="px-3 py-2.5">Teléfono</th>
              <th className="px-3 py-2.5">Deals</th>
              <th className="px-3 py-2.5">Última actividad</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            {filtrados.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-400">Sin contactos que coincidan.</td></tr>
            )}
            {filtrados.map((c) => (
              <tr key={c.id} className="cursor-pointer hover:bg-surface" onClick={() => setAbierto(c)}>
                <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={sel.has(c.id)} onChange={() => toggleSel(c.id)} disabled={!c.email}
                    aria-label={`Seleccionar ${c.nombre}`} />
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-1.5 font-medium text-navy">
                    {c.nombre}
                    {c.es_principal && (
                      <span className="rounded bg-navy/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-navy"
                        title="Contacto principal del cliente (espeja los datos de la ficha)">Principal</span>
                    )}
                  </div>
                  {c.cargo && <div className="text-xs text-gray-400">{c.cargo}</div>}
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-navy">{c.cliente.nombre}</span>
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${ESTATUS_CLIENTE_META[c.cliente.estatus].chip}`}>
                      {ESTATUS_CLIENTE_META[c.cliente.estatus].label}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                  {c.email ? (
                    <div className="flex items-center gap-1.5">
                      <a href={`mailto:${c.email}`} className="text-navy hover:text-orange hover:underline">{c.email}</a>
                      <button onClick={() => copiar(c.email as string, c.id, "Correo copiado")} title="Copiar correo"
                        className="text-gray-300 hover:text-navy">
                        {copiado === c.id ? <Check size={13} /> : <Copy size={13} />}
                      </button>
                    </div>
                  ) : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                  <div className="flex flex-col gap-0.5">
                    {c.telefono && (
                      <a href={`tel:${soloDigitos(c.telefono)}`} className="flex items-center gap-1 text-gray-600 hover:text-orange">
                        <Phone size={11} className="text-gray-400" /> {c.telefono}
                      </a>
                    )}
                    {c.whatsapp && (
                      <a href={waUrl(c.whatsapp)} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-gray-600 hover:text-green-600">
                        <MessageCircle size={11} className="text-green-500" /> {c.whatsapp}
                      </a>
                    )}
                    {!c.telefono && !c.whatsapp && <span className="text-gray-300">—</span>}
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  {c.num_deals > 0 ? (
                    <div>
                      <span className="font-semibold text-navy">{c.num_deals}</span>
                      <div className="text-[11px] text-gray-400">{c.roles.map((r) => ROL_CONTACTO_LABEL[r]).join(", ")}</div>
                    </div>
                  ) : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-3 py-2.5 text-gray-500">
                  {c.ultima_actividad ? fechaCorta(c.ultima_actividad) : <span className="text-gray-300">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400">{filtrados.length} de {contactos.length} contactos</p>

      {abierto && (
        <DetalleDrawer contacto={abierto} canWrite={canWrite} onClose={() => setAbierto(null)}
          onCopiar={copiar} copiado={copiado} onGuardado={alGuardado} onBorrado={alBorrado}
          setToast={setToast} organizaciones={organizaciones} />
      )}
      {creando && (
        <ContactoModal organizaciones={organizaciones} onClose={() => setCreando(false)}
          onGuardado={(item) => { alGuardado(item, true); setCreando(false); }} setToast={setToast} />
      )}
    </div>
  );
}

// ── Modal de alta (elige organización + datos) ─────────────────
function ContactoModal({
  organizaciones, onClose, onGuardado, setToast,
}: {
  organizaciones: OrganizacionOpcion[];
  onClose: () => void;
  onGuardado: (item: ContactoDirectorioItem) => void;
  setToast: (t: ToastData) => void;
}) {
  const [orgId, setOrgId] = useState("");
  const [form, setForm] = useState<ContactoFormInput>(VACIO);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function guardar() {
    if (!orgId) return setError("Elegí una organización");
    if (!form.nombre.trim()) return setError("El nombre es obligatorio");
    setBusy(true); setError("");
    try {
      const res = await fetch(`/api/clientes/${orgId}/contactos`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error ?? "No se pudo crear"); return; }
      const nuevo = data.contacto ?? {}; // el endpoint responde { contacto }
      const org = organizaciones.find((o) => o.id === orgId)!;
      onGuardado({
        id: nuevo.id, nombre: nuevo.nombre ?? form.nombre.trim(), cargo: nuevo.cargo ?? null,
        email: nuevo.email ?? null, telefono: nuevo.telefono ?? null, whatsapp: nuevo.whatsapp ?? null,
        es_principal: nuevo.es_principal ?? false,
        cliente: { id: org.id, nombre: org.nombre, estatus: org.estatus },
        num_deals: 0, roles: [], responsables: [], ultima_actividad: null,
      });
      setToast({ type: "success", message: "Contacto creado" });
    } catch { setError("Error de conexión"); } finally { setBusy(false); }
  }

  return (
    <Modal title="Nuevo contacto" onClose={onClose} size="md">
      <div className="space-y-3">
        <label className="block">
          <span className="label">Organización *</span>
          <SearchableSelect
            options={organizaciones.map((o) => ({ id: o.id, label: o.nombre, sublabel: ESTATUS_CLIENTE_META[o.estatus].label }))}
            value={orgId} onChange={setOrgId} placeholder="¿De qué cliente/prospecto?" searchPlaceholder="Buscar organización…" />
        </label>
        <ContactoFields form={form} setForm={setForm} />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="btn-secondary justify-center">Cancelar</button>
          <button onClick={guardar} disabled={busy} className="btn-primary justify-center">
            {busy ? "Creando…" : "Crear contacto"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// Campos compartidos por alta y edición (DRY).
function ContactoFields({ form, setForm }: { form: ContactoFormInput; setForm: (f: ContactoFormInput) => void }) {
  const set = (k: keyof ContactoFormInput) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });
  return (
    <div className="space-y-2">
      <input className="input" placeholder="Nombre *" value={form.nombre} onChange={set("nombre")} />
      <div className="grid grid-cols-2 gap-2">
        <input className="input" placeholder="Cargo" value={form.cargo} onChange={set("cargo")} />
        <input className="input" placeholder="Email" value={form.email} onChange={set("email")} />
        <input className="input" placeholder="Teléfono" value={form.telefono} onChange={set("telefono")} />
        <input className="input" placeholder="WhatsApp" value={form.whatsapp} onChange={set("whatsapp")} />
      </div>
    </div>
  );
}

// ── Drawer de detalle ──────────────────────────────────────────
function DetalleDrawer({
  contacto, canWrite, onClose, onCopiar, copiado, onGuardado, onBorrado, setToast,
}: {
  contacto: ContactoDirectorioItem;
  canWrite: boolean;
  onClose: () => void;
  onCopiar: (t: string, m: string, aviso: string) => void;
  copiado: string | null;
  onGuardado: (item: ContactoDirectorioItem, esNuevo: boolean) => void;
  onBorrado: (id: string) => void;
  setToast: (t: ToastData) => void;
  organizaciones: OrganizacionOpcion[];
}) {
  const [data, setData] = useState<ContactoDetalle | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState<ContactoFormInput>(VACIO);
  const [busy, setBusy] = useState(false);

  // Cargar el detalle al abrir. Fetch-on-mount: el setState es intrínseco al efecto.
  useEffect(() => {
    let vivo = true;
    fetch(`/api/contactos/${contacto.id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("No se pudo cargar el contacto"))))
      .then((d: ContactoDetalle) => vivo && setData(d))
      .catch((e) => vivo && setError(e instanceof Error ? e.message : "Error"))
      .finally(() => vivo && setCargando(false));
    return () => { vivo = false; };
  }, [contacto.id]);

  function abrirEdicion() {
    setForm({
      nombre: contacto.nombre, cargo: contacto.cargo ?? "", email: contacto.email ?? "",
      telefono: contacto.telefono ?? "", whatsapp: contacto.whatsapp ?? "",
    });
    setEditando(true);
  }
  async function guardarEdicion() {
    if (!form.nombre.trim()) { setToast({ type: "error", message: "El nombre es obligatorio" }); return; }
    setBusy(true);
    try {
      const res = await fetch(`/api/clientes/${contacto.cliente.id}/contactos/${contacto.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "No se pudo editar");
      onGuardado({
        ...contacto, nombre: form.nombre.trim(), cargo: form.cargo || null, email: form.email || null,
        telefono: form.telefono || null, whatsapp: form.whatsapp || null,
      }, false);
      setEditando(false);
      setToast({ type: "success", message: "Contacto actualizado" });
    } catch (e) { setToast({ type: "error", message: e instanceof Error ? e.message : "Error" }); }
    finally { setBusy(false); }
  }
  async function borrar() {
    if (!window.confirm(`¿Eliminar a ${contacto.nombre}? Se quita del directorio (soft-delete).`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/clientes/${contacto.cliente.id}/contactos/${contacto.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "No se pudo eliminar");
      onBorrado(contacto.id);
      setToast({ type: "success", message: "Contacto eliminado" });
    } catch (e) { setToast({ type: "error", message: e instanceof Error ? e.message : "Error" }); setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div className="flex h-full w-full max-w-md flex-col bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between border-b border-surface-border px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-lg font-bold text-navy">
              {contacto.nombre}
              {contacto.es_principal && (
                <span className="rounded bg-navy/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-navy">Principal</span>
              )}
            </div>
            {contacto.cargo && <p className="text-sm text-gray-400">{contacto.cargo}</p>}
            <div className="mt-1 flex items-center gap-1.5">
              <span className="text-sm text-gray-600">{contacto.cliente.nombre}</span>
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${ESTATUS_CLIENTE_META[contacto.cliente.estatus].chip}`}>
                {ESTATUS_CLIENTE_META[contacto.cliente.estatus].label}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {canWrite && !editando && (
              <>
                <button onClick={abrirEdicion} title="Editar" className="rounded p-1 text-gray-400 hover:bg-surface hover:text-navy"><Pencil size={16} /></button>
                <button onClick={borrar} disabled={busy} title="Eliminar" className="rounded p-1 text-gray-400 hover:bg-surface hover:text-red-600"><Trash2 size={16} /></button>
              </>
            )}
            <button onClick={onClose} className="rounded p-1 text-gray-400 hover:bg-surface hover:text-navy"><X size={18} /></button>
          </div>
        </div>

        {/* Edición inline */}
        {editando ? (
          <div className="space-y-3 border-b border-surface-border px-5 py-4">
            <ContactoFields form={form} setForm={setForm} />
            <div className="flex justify-end gap-2">
              <button onClick={() => setEditando(false)} className="btn-secondary justify-center text-sm">Cancelar</button>
              <button onClick={guardarEdicion} disabled={busy} className="btn-primary justify-center text-sm">
                {busy ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-1.5 border-b border-surface-border px-5 py-3">
            {contacto.email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail size={13} className="text-gray-400" />
                <a href={`mailto:${contacto.email}`} className="text-navy hover:text-orange hover:underline">{contacto.email}</a>
                <button onClick={() => onCopiar(contacto.email as string, `d-${contacto.id}`, "Correo copiado")}
                  className="text-gray-300 hover:text-navy" title="Copiar">
                  {copiado === `d-${contacto.id}` ? <Check size={12} /> : <Copy size={12} />}
                </button>
              </div>
            )}
            {contacto.telefono && (
              <a href={`tel:${soloDigitos(contacto.telefono)}`} className="flex items-center gap-2 text-sm text-gray-600 hover:text-orange">
                <Phone size={13} className="text-gray-400" /> {contacto.telefono}
              </a>
            )}
            {contacto.whatsapp && (
              <a href={waUrl(contacto.whatsapp)} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-gray-600 hover:text-green-600">
                <MessageCircle size={13} className="text-green-500" /> {contacto.whatsapp}
              </a>
            )}
          </div>
        )}

        {/* Cuerpo scrollable */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {cargando && <p className="text-sm text-gray-400">Cargando…</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}
          {data && (
            <>
              <section className="mb-6">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Deals ({data.deals.length})</p>
                {data.deals.length === 0 ? (
                  <p className="text-sm text-gray-400">Este contacto no participa en ningún deal.</p>
                ) : (
                  <div className="space-y-2">
                    {data.deals.map((d) => (
                      <div key={d.deal_id} className="rounded-lg border border-surface-border p-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <Link href={`/pipeline/${d.id}`} className="flex items-center gap-1 text-sm font-medium text-navy hover:text-orange hover:underline">
                            {d.nombre} <ExternalLink size={12} className="shrink-0" />
                          </Link>
                          <span className="shrink-0 text-[11px] text-gray-400">{ROL_CONTACTO_LABEL[d.rol]}</span>
                        </div>
                        <div className="mt-1 flex items-center justify-between">
                          <span className="text-[11px] text-gray-400">{d.stage ?? d.resultado}</span>
                          <Link href={`/pipeline/${d.id}`} className="flex items-center gap-1 text-[11px] font-semibold text-orange hover:underline">
                            <CalendarClock size={11} /> Registrar actividad
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Actividad ({data.actividades.length})</p>
                {data.actividades.length === 0 ? (
                  <p className="text-sm text-gray-400">Sin actividad registrada con este contacto.</p>
                ) : (
                  <div className="space-y-3">
                    {data.actividades.map((a) => {
                      const Icon = TIPO_ACTIVIDAD_META[a.tipo].icon;
                      return (
                        <div key={a.id} className="flex gap-2.5">
                          <div className="mt-0.5 shrink-0 text-gray-400"><Icon size={14} /></div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] font-semibold text-navy">
                                {a.tipo_accion ?? TIPO_ACTIVIDAD_META[a.tipo].label}
                                {a.es_tarea && !a.completada && <span className="ml-1 text-amber-600">· pendiente</span>}
                              </span>
                              <span className="shrink-0 text-[11px] text-gray-400">{fechaCorta(a.cuando)}</span>
                            </div>
                            {a.contenido && <p className="whitespace-pre-wrap break-words text-xs text-gray-600">{a.contenido}</p>}
                            <div className="mt-0.5 flex items-center gap-2 text-[10px] text-gray-400">
                              <span className="truncate">{a.deal_nombre}</span>
                              {a.resultado && <span className="rounded bg-surface px-1.5 py-0.5 font-medium">{a.resultado}</span>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
