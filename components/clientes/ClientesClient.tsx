"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import { Plus, Users, Search, AlertTriangle, Download, Upload } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import Modal from "@/components/ui/Modal";
import Toast, { ToastData } from "@/components/ui/Toast";
import ClienteCard from "./ClienteCard";
import ClienteForm from "./ClienteForm";
import type { ClienteConStats, CondicionResumen } from "@/types/clientes";

interface ClientesClientProps {
  initialClientes: ClienteConStats[];
  condiciones: CondicionResumen[];
  canWrite?: boolean;
}

interface ImportResult {
  created: number;
  total: number;
  errors: Array<{ fila: number; mensaje: string }>;
}

export default function ClientesClient({
  initialClientes,
  condiciones,
  canWrite = true,
}: ClientesClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [clientes, setClientes] = useState<ClienteConStats[]>(initialClientes);
  const [search, setSearch] = useState("");
  // Filtro inicial respetando el deep-link ?estatus= (ej. "Convertir a Cliente" desde un deal)
  const estatusParam = searchParams.get("estatus");
  const [estatusFiltro, setEstatusFiltro] = useState<"todos" | "PROSPECTO" | "ACTIVO">(
    estatusParam === "PROSPECTO" || estatusParam === "ACTIVO" ? estatusParam : "todos"
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCliente, setEditingCliente] = useState<ClienteConStats | null>(null);
  const [confirmDesactivar, setConfirmDesactivar] = useState<ClienteConStats | null>(null);
  const [isDesactivando, setIsDesactivando] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [toast, setToast] = useState<ToastData | null>(null);

  const closeToast = useCallback(() => setToast(null), []);

  const handleImportFile = async (file: File) => {
    try {
      const res = await fetch("/api/import/clientes", {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: await file.arrayBuffer(),
      });
      const data = await res.json();

      if (!res.ok) {
        setToast({ type: "error", message: data.error || "Error al importar clientes" });
        return;
      }

      const errores = Array.isArray(data.errors) ? data.errors.length : 0;
      setImportResult({
        created: data.created ?? 0,
        total: data.total ?? 0,
        errors: Array.isArray(data.errors) ? data.errors : [],
      });
      setToast({
        type: errores > 0 ? "error" : "success",
        message: `Clientes creados: ${data.created}. Errores: ${errores}.`,
      });
      const updated = await fetch("/api/clientes", { cache: "no-store" });
      if (updated.ok) setClientes(await updated.json());
      router.refresh();
    } catch {
      setToast({ type: "error", message: "Error al leer el archivo" });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Filtrado por búsqueda + estatus
  const clientesFiltrados = useMemo(() => {
    const q = search.toLowerCase().trim();
    return clientes.filter((c) => {
      if (estatusFiltro !== "todos" && c.estatus !== estatusFiltro) return false;
      if (!q) return true;
      return (
        c.nombre.toLowerCase().includes(q) ||
        (c.rfc?.toLowerCase().includes(q) ?? false) ||
        c.contacto.toLowerCase().includes(q) ||
        c.ciudad.toLowerCase().includes(q)
      );
    });
  }, [clientes, search, estatusFiltro]);

  const cuentaProspectos = useMemo(
    () => clientes.filter((c) => c.estatus === "PROSPECTO").length,
    [clientes]
  );

  // ── Abrir modal de creación ──────────────────────────────────
  const handleOpenCreate = () => {
    setEditingCliente(null);
    setIsModalOpen(true);
  };

  // ── Abrir modal de edición ───────────────────────────────────
  const handleOpenEdit = (cliente: ClienteConStats) => {
    setEditingCliente(cliente);
    setIsModalOpen(true);
  };

  // ── Cerrar modal ─────────────────────────────────────────────
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingCliente(null);
  };

  // ── Callback de éxito en el formulario ───────────────────────
  const handleFormSuccess = (clienteGuardado: ClienteConStats) => {
    if (editingCliente) {
      // Actualización: reemplaza el cliente existente
      setClientes((prev) =>
        prev.map((c) => (c.id === clienteGuardado.id ? clienteGuardado : c))
      );
      setToast({ type: "success", message: `"${clienteGuardado.nombre}" actualizado` });
    } else {
      // Creación: agrega al principio y re-ordena por nombre
      setClientes((prev) =>
        [...prev, clienteGuardado].sort((a, b) => a.nombre.localeCompare(b.nombre))
      );
      setToast({ type: "success", message: `"${clienteGuardado.nombre}" creado correctamente` });
    }
    handleCloseModal();
  };

  // ── Desactivar cliente ───────────────────────────────────────
  const handleDesactivarConfirm = async () => {
    if (!confirmDesactivar) return;
    setIsDesactivando(true);

    try {
      const res = await fetch(
        `/api/clientes/${confirmDesactivar.id}/desactivar`,
        { method: "PATCH" }
      );

      if (!res.ok) {
        const data = await res.json();
        setToast({ type: "error", message: data.error || "Error al desactivar" });
        return;
      }

      // Remover de la lista (soft delete — ya no aparece en activos)
      setClientes((prev) => prev.filter((c) => c.id !== confirmDesactivar.id));
      setToast({
        type: "success",
        message: `"${confirmDesactivar.nombre}" desactivado`,
      });
    } catch {
      setToast({ type: "error", message: "Error de conexión" });
    } finally {
      setIsDesactivando(false);
      setConfirmDesactivar(null);
    }
  };

  return (
    <>
      {toast && <Toast {...toast} onClose={closeToast} />}

      {/* ── Encabezado de página ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-navy">Clientes</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {clientes.length}{" "}
            {clientes.length === 1 ? "cliente activo" : "clientes activos"}
          </p>
        </div>
        {canWrite && (
          <div className="grid w-full grid-cols-1 gap-2 sm:w-auto sm:grid-cols-3">
            <a href="/api/import/clientes/layout" className="btn-secondary justify-center">
              <Download size={16} />
              Layout Excel
            </a>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="btn-secondary justify-center"
            >
              <Upload size={16} />
              Subir Excel/CSV
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xls,.xlsx,.csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleImportFile(file);
              }}
            />
            <button onClick={handleOpenCreate} className="btn-primary justify-center">
              <Plus size={16} />
              Nuevo cliente
            </button>
          </div>
        )}
      </div>

      {/* ── Barra de búsqueda + filtro de estatus ── */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-sm flex-1 sm:max-w-md">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            className="input w-full pl-9 text-sm"
            placeholder="Buscar por nombre, RFC, contacto o ciudad..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1.5">
          {(["todos", "ACTIVO", "PROSPECTO"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setEstatusFiltro(k)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                estatusFiltro === k ? "border-navy bg-navy text-white" : "border-surface-border text-gray-500 hover:bg-surface"
              }`}
            >
              {k === "todos" ? "Todos" : k === "ACTIVO" ? "Clientes" : "Prospectos"}
              {k === "PROSPECTO" && cuentaProspectos > 0 && ` (${cuentaProspectos})`}
            </button>
          ))}
        </div>
      </div>

      {/* ── Grid de cards ── */}
      {clientesFiltrados.length === 0 ? (
        <EmptyState
          hasSearch={!!search}
          onClear={() => setSearch("")}
          onNew={handleOpenCreate}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {clientesFiltrados.map((cliente) => (
            <ClienteCard
              key={cliente.id}
              cliente={cliente}
              onEdit={canWrite ? handleOpenEdit : undefined}
              onDesactivar={canWrite ? setConfirmDesactivar : undefined}
            />
          ))}
        </div>
      )}

      {/* ── Modal: crear / editar / convertir cliente ── */}
      {isModalOpen && (
        <Modal
          title={
            editingCliente?.estatus === "PROSPECTO"
              ? "Convertir a Cliente"
              : editingCliente
              ? "Editar cliente"
              : "Nuevo cliente"
          }
          onClose={handleCloseModal}
          size="lg"
        >
          {editingCliente?.estatus === "PROSPECTO" && (
            <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Completa los datos fiscales faltantes. Al guardar, el prospecto pasa a Cliente activo.
            </p>
          )}
          <ClienteForm
            cliente={editingCliente ?? undefined}
            condiciones={condiciones}
            onSuccess={handleFormSuccess}
            onCancel={handleCloseModal}
            convertir={editingCliente?.estatus === "PROSPECTO"}
          />
        </Modal>
      )}

      {importResult && (
        <Modal
          title="Resultado de importación"
          onClose={() => setImportResult(null)}
          size="lg"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
              <div className="rounded-lg border border-surface-border bg-gray-50 p-3">
                <p className="text-xs text-gray-400">Filas procesadas</p>
                <p className="text-lg font-semibold text-navy">{importResult.total}</p>
              </div>
              <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                <p className="text-xs text-green-700">Creados</p>
                <p className="text-lg font-semibold text-green-700">{importResult.created}</p>
              </div>
              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="text-xs text-red-700">Errores</p>
                <p className="text-lg font-semibold text-red-700">{importResult.errors.length}</p>
              </div>
            </div>

            {importResult.errors.length > 0 ? (
              <div className="max-h-72 overflow-auto rounded-lg border border-red-200">
                <table className="w-full text-sm">
                  <thead className="bg-red-50 text-left text-xs uppercase tracking-wide text-red-700">
                    <tr>
                      <th className="px-3 py-2">Fila</th>
                      <th className="px-3 py-2">Motivo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-red-100">
                    {importResult.errors.map((error, index) => (
                      <tr key={`${error.fila}-${index}`}>
                        <td className="px-3 py-2 font-mono text-xs">{error.fila}</td>
                        <td className="px-3 py-2 text-gray-700">{error.mensaje}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                Todas las filas se cargaron correctamente.
              </p>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                className="btn-primary w-full justify-center sm:w-auto"
                onClick={() => setImportResult(null)}
              >
                Entendido
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Modal: confirmar desactivar ── */}
      {confirmDesactivar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => !isDesactivando && setConfirmDesactivar(null)}
          />
          <div className="relative z-10 w-full max-w-sm animate-fade-in rounded-xl bg-white p-4 shadow-2xl sm:p-6">
            <div className="flex items-start gap-4">
              <div className="shrink-0 w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                <AlertTriangle size={20} className="text-amber-600" />
              </div>
              <div>
                <h3 className="font-semibold text-navy text-base">
                  Desactivar cliente
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  ¿Desactivar a{" "}
                  <strong className="text-gray-900">
                    {confirmDesactivar.nombre}
                  </strong>
                  ?
                </p>
                {confirmDesactivar.stats.num_ordenes > 0 && (
                  <p className="text-xs text-amber-600 mt-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    Este cliente tiene{" "}
                    <strong>{confirmDesactivar.stats.num_ordenes}</strong>{" "}
                    {confirmDesactivar.stats.num_ordenes === 1 ? "orden" : "órdenes"} registradas.
                    El historial se conserva.
                  </p>
                )}
                <p className="text-xs text-gray-400 mt-2">
                  No aparecerá en el formulario de nuevas órdenes.
                </p>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                onClick={() => setConfirmDesactivar(null)}
                disabled={isDesactivando}
                className="btn-secondary"
              >
                Cancelar
              </button>
              <button
                onClick={handleDesactivarConfirm}
                disabled={isDesactivando}
                className="btn-danger"
              >
                {isDesactivando ? "Desactivando..." : "Desactivar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Estado vacío ─────────────────────────────────────────────
function EmptyState({
  hasSearch,
  onClear,
  onNew,
}: {
  hasSearch: boolean;
  onClear: () => void;
  onNew: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
        <Users size={28} className="text-gray-400" />
      </div>
      {hasSearch ? (
        <>
          <p className="text-base font-medium text-gray-700">Sin resultados</p>
          <p className="text-sm text-gray-400 mt-1 mb-4">
            No hay clientes que coincidan con tu búsqueda.
          </p>
          <button onClick={onClear} className="btn-secondary text-sm">
            Limpiar búsqueda
          </button>
        </>
      ) : (
        <>
          <p className="text-base font-medium text-gray-700">No hay clientes aún</p>
          <p className="text-sm text-gray-400 mt-1 mb-4">
            Agrega tu primer cliente para comenzar.
          </p>
          <button onClick={onNew} className="btn-primary text-sm">
            <Plus size={15} />
            Nuevo cliente
          </button>
        </>
      )}
    </div>
  );
}
