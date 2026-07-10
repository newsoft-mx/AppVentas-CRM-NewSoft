"use client";

import { useRef, useState } from "react";
import { Bold, Italic, Heading2, List, Link2, Eye, Pencil } from "lucide-react";
import { MAX_CONTENIDO } from "@/lib/actividad";
import Markdown from "./Markdown";

// Editor de texto básico con Markdown (SOL-16): toolbar que envuelve la
// selección + pestaña de vista previa. Controlado (value/onChange). Reutilizable
// en el composer y en la edición de la bitácora.
export default function MarkdownEditor({
  value,
  onChange,
  placeholder,
  rows = 3,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  autoFocus?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState(false);

  // Envuelve la selección con marcadores (negrita/cursiva/enlace)
  function envolver(antes: string, despues: string = antes) {
    const ta = ref.current;
    if (!ta) return;
    const { selectionStart: s, selectionEnd: e } = ta;
    const sel = value.slice(s, e);
    onChange(value.slice(0, s) + antes + sel + despues + value.slice(e));
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(s + antes.length, e + antes.length);
    });
  }

  // Antepone un prefijo al inicio de la línea (encabezado/lista)
  function prefijarLinea(prefijo: string) {
    const ta = ref.current;
    if (!ta) return;
    const { selectionStart: s } = ta;
    const inicioLinea = value.lastIndexOf("\n", s - 1) + 1;
    onChange(value.slice(0, inicioLinea) + prefijo + value.slice(inicioLinea));
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(s + prefijo.length, s + prefijo.length);
    });
  }

  const excede = value.length > MAX_CONTENIDO;
  const btn = "rounded p-1 text-gray-500 hover:bg-surface hover:text-navy disabled:opacity-40";

  // Acciones de la toolbar (DRY: mismo botón, distinta transformación)
  const acciones = [
    { Icon: Bold, title: "Negrita", run: () => envolver("**") },
    { Icon: Italic, title: "Cursiva", run: () => envolver("*") },
    { Icon: Heading2, title: "Encabezado", run: () => prefijarLinea("## ") },
    { Icon: List, title: "Lista", run: () => prefijarLinea("- ") },
    { Icon: Link2, title: "Enlace", run: () => envolver("[", "](https://)") },
  ];

  return (
    <div className="rounded-lg border border-surface-border bg-surface focus-within:border-orange">
      <div className="flex items-center gap-0.5 border-b border-surface-border px-1.5 py-1">
        {acciones.map(({ Icon, title, run }) => (
          <button key={title} type="button" onClick={run} title={title} className={btn} disabled={preview}>
            <Icon size={14} />
          </button>
        ))}
        <button
          type="button"
          onClick={() => setPreview((p) => !p)}
          title={preview ? "Escribir" : "Vista previa"}
          className={`ml-auto flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-semibold ${
            preview ? "bg-navy text-white" : "text-gray-500 hover:bg-surface hover:text-navy"
          }`}
        >
          {preview ? <Pencil size={12} /> : <Eye size={12} />}
          {preview ? "Escribir" : "Vista previa"}
        </button>
      </div>

      {preview ? (
        <div className="min-h-[4.5rem] px-3.5 py-2.5">
          {value.trim() ? (
            <Markdown>{value}</Markdown>
          ) : (
            <span className="text-sm text-gray-400">Nada que previsualizar…</span>
          )}
        </div>
      ) : (
        <textarea
          ref={ref}
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className="w-full resize-none rounded-b-lg bg-transparent px-3.5 py-2.5 text-sm text-navy outline-none
            placeholder:text-gray-400"
        />
      )}

      {excede && (
        <p className="px-3.5 pb-1.5 text-[11px] font-medium text-red-500">
          {value.length.toLocaleString("es-MX")} / {MAX_CONTENIDO.toLocaleString("es-MX")} — demasiado largo
        </p>
      )}
    </div>
  );
}
