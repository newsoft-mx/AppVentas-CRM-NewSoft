"use client";

import { useState } from "react";
import { UserCircle, Lock } from "lucide-react";
import Toast, { ToastData } from "@/components/ui/Toast";

interface Props {
  nombre: string;
  email: string;
  rolLabel: string;
  vendedorNombre: string | null;
}

export default function PerfilClient({ nombre: nombreInicial, email, rolLabel, vendedorNombre }: Props) {
  const [toast, setToast] = useState<ToastData | null>(null);

  // Datos
  const [nombre, setNombre] = useState(nombreInicial);
  const [guardandoNombre, setGuardandoNombre] = useState(false);
  const nombreCambiado = nombre.trim() !== nombreInicial && nombre.trim().length > 0;

  // Contraseña
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [cambiandoPass, setCambiandoPass] = useState(false);

  async function patch(body: Record<string, string>): Promise<boolean> {
    const res = await fetch("/api/perfil", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = Array.isArray(data?.details)
        ? data.details.map((d: { mensaje: string }) => d.mensaje).join(". ")
        : data?.error ?? "No se pudo guardar.";
      setToast({ type: "error", message: msg });
      return false;
    }
    return true;
  }

  async function guardarNombre() {
    if (!nombreCambiado || guardandoNombre) return;
    setGuardandoNombre(true);
    if (await patch({ nombre: nombre.trim() })) {
      setToast({ type: "success", message: "Nombre actualizado." });
    }
    setGuardandoNombre(false);
  }

  async function cambiarPassword() {
    if (cambiandoPass) return;
    if (nueva.trim().length < 8) {
      setToast({ type: "error", message: "La nueva contraseña debe tener al menos 8 caracteres." });
      return;
    }
    if (nueva.trim() !== confirmar.trim()) {
      setToast({ type: "error", message: "La confirmación no coincide." });
      return;
    }
    setCambiandoPass(true);
    if (await patch({ password_actual: actual, password_nueva: nueva.trim() })) {
      setToast({ type: "success", message: "Contraseña actualizada." });
      setActual("");
      setNueva("");
      setConfirmar("");
    }
    setCambiandoPass(false);
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      <header className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-surface text-navy">
          <UserCircle size={24} />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-navy">Mi perfil</h1>
          <p className="text-xs text-gray-400">{rolLabel}{vendedorNombre ? ` · ${vendedorNombre}` : ""}</p>
        </div>
      </header>

      {/* Datos */}
      <section className="mb-5 rounded-xl border border-surface-border bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-navy">Datos</h2>
        <div className="space-y-4">
          <div>
            <label className="label" htmlFor="perfil-nombre">Nombre</label>
            <input
              id="perfil-nombre"
              className="input"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input bg-surface text-gray-500" value={email} readOnly disabled />
            <p className="mt-1 text-xs text-gray-400">El email (tu usuario de acceso) lo gestiona un administrador.</p>
          </div>
          <div>
            <label className="label">Rol</label>
            <input className="input bg-surface text-gray-500" value={rolLabel} readOnly disabled />
          </div>
          <div className="flex justify-end">
            <button onClick={guardarNombre} disabled={!nombreCambiado || guardandoNombre} className="btn-primary justify-center disabled:opacity-50">
              {guardandoNombre ? "Guardando…" : "Guardar nombre"}
            </button>
          </div>
        </div>
      </section>

      {/* Contraseña */}
      <section className="rounded-xl border border-surface-border bg-white p-5">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-navy">
          <Lock size={15} /> Cambiar contraseña
        </h2>
        <div className="space-y-4">
          <div>
            <label className="label" htmlFor="perfil-actual">Contraseña actual</label>
            <input
              id="perfil-actual"
              type="password"
              autoComplete="current-password"
              className="input"
              value={actual}
              onChange={(e) => setActual(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="perfil-nueva">Nueva contraseña</label>
            <input
              id="perfil-nueva"
              type="password"
              autoComplete="new-password"
              className="input"
              value={nueva}
              onChange={(e) => setNueva(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="perfil-confirmar">Confirmar nueva contraseña</label>
            <input
              id="perfil-confirmar"
              type="password"
              autoComplete="new-password"
              className="input"
              value={confirmar}
              onChange={(e) => setConfirmar(e.target.value)}
            />
          </div>
          <div className="flex justify-end">
            <button
              onClick={cambiarPassword}
              disabled={cambiandoPass || !actual || !nueva || !confirmar}
              className="btn-primary justify-center disabled:opacity-50"
            >
              {cambiandoPass ? "Cambiando…" : "Cambiar contraseña"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
