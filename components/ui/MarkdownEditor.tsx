"use client";

import { useEffect, useRef, useState } from "react";
import { Bold, Italic, Heading2, List, Link2, Eye, Pencil, Maximize2, Minimize2 } from "lucide-react";
import { MAX_CONTENIDO } from "@/lib/actividad";
import Markdown from "./Markdown";

// Alto del editor: base cómoda y auto-crece hasta ~el doble; a partir de ahí, scroll
// interno (para no empujar el resto de la vista). El usuario escribe sin scroll mientras
// el texto sea corto/medio.
const MIN_H = 96; // ~6rem (base)
const MAX_H = 208; // ~13rem (≈ doble); luego scrollea
// Modo expandido (toggle manual): más altura mínima para escribir/leer textos largos y
// un tope alto (≈60% del viewport) antes de scrollear. Fallback si no hay window (SSR).
const MIN_H_EXP = 240;
const MAX_H_EXP_FALLBACK = 480;

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
  const [expandido, setExpandido] = useState(false);
  // Tope expandido ≈60% del viewport, medido en cliente (window no existe en SSR y no se
  // puede lazy-init). Patrón correcto; la regla es conservadora con setState-en-effect.
  const [maxExp, setMaxExp] = useState(MAX_H_EXP_FALLBACK);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMaxExp(Math.max(360, Math.round(window.innerHeight * 0.6)));
  }, []);

  const minH = expandido ? MIN_H_EXP : MIN_H;
  const maxH = expandido ? maxExp : MAX_H;

  // Auto-crecer con el contenido (hasta maxH; después, scroll interno).
  useEffect(() => {
    const ta = ref.current;
    if (!ta || preview) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(Math.max(ta.scrollHeight, minH), maxH)}px`;
  }, [value, preview, minH, maxH]);

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
        {/* `run` (envolver/prefijarLinea) lee ref.current, pero SOLO al hacer click (onClick),
            nunca en render. El linter no distingue el handler diferido → falso positivo. */}
        {/* eslint-disable-next-line react-hooks/refs */}
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
        <button
          type="button"
          onClick={() => setExpandido((x) => !x)}
          title={expandido ? "Contraer editor" : "Expandir editor"}
          aria-pressed={expandido}
          className={btn}
        >
          {expandido ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
      </div>

      {preview ? (
        <div className="overflow-y-auto px-3.5 py-2.5" style={{ minHeight: minH, maxHeight: maxH }}>
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
          className="w-full resize-none overflow-y-auto rounded-b-lg bg-transparent px-3.5 py-2.5
            text-sm text-navy outline-none placeholder:text-gray-400"
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
