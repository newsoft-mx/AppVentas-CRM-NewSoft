"use client";

// Lista de leads eliminados (MARCADOS), solo ADMIN. La contracara del borrado: acá se ven
// y se restauran los deals trabajados que se borraron. Los destruidos físicamente no
// aparecen — eran basura sin trabajo, y no vuelven (intencional).
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, RotateCcw, Trash2 } from "lucide-react";
import Toast, { ToastData } from "@/components/ui/Toast";
import { formatFechaHora } from "@/lib/utils";

interface DealEliminado {
  id: string;
  nombre: string;
  cliente: string;
  eliminada_at: string | null;
  eliminada_por: string | null;
  motivo: string | null;
  actividades: number;
}

export default function EliminadosClient({ deals }: { deals: DealEliminado[] }) {
  const router = useRouter();
  const [items, setItems] = useState(deals);
  const [restaurando, setRestaurando] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastData | null>(null);

  async function restaurar(d: DealEliminado) {
    setRestaurando(d.id);
    try {
      const res = await fetch(`/api/crm/deals/${d.id}/restaurar`, { method: "POST" });
      if (!res.ok) throw new Error();
      // Sale de esta lista y vuelve al pipeline; refrescar para que el server lo reponga allá.
      setItems((cur) => cur.filter((x) => x.id !== d.id));
      setToast({ type: "success", message: `"${d.nombre}" volvió al pipeline.` });
      router.refresh();
    } catch {
      setToast({ type: "error", message: "No se pudo restaurar el lead." });
    } finally {
      setRestaurando(null);
    }
  }

  return (
    <div className="flex h-full flex-col">
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      <header className="border-b border-surface-border bg-white px-6 py-4">
        <Link href="/pipeline" className="mb-1 flex w-fit items-center gap-1 text-xs text-gray-400 hover:text-navy">
          <ArrowLeft size={13} /> Volver al pipeline
        </Link>
        <h1 className="text-xl font-bold tracking-tight text-navy">Leads eliminados</h1>
        <p className="text-xs text-gray-400">
          {items.length} {items.length === 1 ? "lead" : "leads"} · se pueden restaurar. Los que
          no tenían actividad se borraron de forma definitiva y no aparecen acá.
        </p>
      </header>

      <div className="flex-1 overflow-auto bg-surface px-6 py-5">
        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center text-gray-400">
            <Trash2 size={28} className="text-gray-300" />
            <p className="text-sm">No hay leads eliminados para restaurar.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((d) => (
              <div
                key={d.id}
                className="flex items-start justify-between gap-4 rounded-xl border border-surface-border
                           bg-white px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-navy">{d.nombre}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
                    <span className="rounded bg-surface px-1.5 py-0.5">{d.cliente}</span>
                    <span>{d.actividades} {d.actividades === 1 ? "actividad" : "actividades"}</span>
                  </div>
                  {/* Quién, cuándo y por qué: la razón de ser del borrado marcado. */}
                  <div className="mt-1.5 text-[11px] text-gray-400">
                    Eliminado
                    {d.eliminada_por && <> por <span className="text-gray-500">{d.eliminada_por}</span></>}
                    {d.eliminada_at && <> · {formatFechaHora(d.eliminada_at)}</>}
                    {d.motivo && <> · <span className="italic">«{d.motivo}»</span></>}
                  </div>
                </div>
                <button
                  onClick={() => restaurar(d)}
                  disabled={restaurando === d.id}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg border border-surface-border
                             px-3 py-1.5 text-xs font-semibold text-navy transition-colors
                             hover:border-emerald-500 hover:text-emerald-600 disabled:opacity-50"
                >
                  <RotateCcw size={13} /> {restaurando === d.id ? "Restaurando…" : "Restaurar"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
