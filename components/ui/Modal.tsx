"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { X } from "lucide-react";

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg";
  /**
   * Fuerza (o desactiva) la pregunta antes de cerrar. Por defecto el modal se da cuenta solo:
   * ver `sucio` más abajo. Sirve para el caso raro en que el padre sabe algo que el DOM no.
   */
  confirmarDescarte?: boolean;
  /**
   * Las acciones, pegadas abajo y fuera del área que scrollea.
   *
   * Sin esto los botones viven al final del contenido, o sea DEBAJO DEL PLIEGUE en cuanto el
   * formulario es largo: medido en el de Deal, hay que scrollear 910px en un teléfono y 389px
   * en una laptop de 800px de alto para llegar a "Crear deal".
   *
   * Es opcional a propósito: los modales que ya existen siguen funcionando sin tocarlos.
   */
  footer?: React.ReactNode;
}

const sizeClasses = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-3xl",
};

export default function Modal({
  title,
  onClose,
  children,
  size = "md",
  confirmarDescarte,
  footer,
}: ModalProps) {
  /**
   * ¿El usuario tocó algo acá adentro?
   *
   * Un clic al costado cerraba el modal y tiraba lo escrito sin preguntar. En el formulario de
   * orden eso son casi 40 campos y todas sus partidas; en el de deal, más de 30. No hay
   * deshacer: lo tipeado no está en ningún lado.
   *
   * En vez de pedirle a cada formulario que declare si está "sucio" —trece llamadores, doce
   * oportunidades de olvidarse— el modal escucha `input`/`change` en su propio contenido. Los
   * eventos nativos burbujean, así que alcanza un listener para cualquier control que haya
   * adentro, sin tocar ni una línea de los formularios.
   *
   * El sesgo es a preguntar de más: preguntar sin necesidad cuesta un clic, no preguntar
   * cuesta el formulario entero.
   */
  const [sucio, setSucio] = useState(false);
  const [preguntando, setPreguntando] = useState(false);
  const contenidoRef = useRef<HTMLDivElement>(null);
  const tituloId = useId();

  const debeConfirmar = confirmarDescarte ?? sucio;

  // El único camino de salida del modal: si hay algo que perder, pregunta primero.
  const intentarCerrar = useCallback(() => {
    if (debeConfirmar) setPreguntando(true);
    else onClose();
  }, [debeConfirmar, onClose]);

  useEffect(() => {
    const el = contenidoRef.current;
    if (!el) return;
    const marcar = () => setSucio(true);
    el.addEventListener("input", marcar);
    el.addEventListener("change", marcar);
    return () => {
      el.removeEventListener("input", marcar);
      el.removeEventListener("change", marcar);
    };
  }, []);

  // Cerrar con Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Con la pregunta abierta, Escape vuelve al formulario en vez de descartar: la salida
      // destructiva nunca debería ser la más fácil de apretar sin querer.
      if (preguntando) setPreguntando(false);
      else intentarCerrar();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [intentarCerrar, preguntando]);

  // Prevenir scroll del body
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={intentarCerrar}
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        className={`relative z-10 flex max-h-[92vh] w-full ${sizeClasses[size]} animate-fade-in flex-col rounded-t-xl bg-white shadow-2xl sm:max-h-[90vh] sm:rounded-xl`}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-surface-border px-4 py-4 sm:px-6">
          <h2 id={tituloId} className="min-w-0 truncate text-base font-semibold text-navy">
            {title}
          </h2>
          <button
            onClick={intentarCerrar}
            aria-label="Cerrar"
            className="p-1 text-gray-500 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Contenido — `min-h-0` es lo que deja que un hijo flex realmente scrollee en vez
            de estirar al padre y empujar el pie fuera de la pantalla. */}
        <div ref={contenidoRef} className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {children}
        </div>

        {footer && (
          <div className="shrink-0 border-t border-surface-border bg-white px-4 py-3 sm:px-6">
            {footer}
          </div>
        )}

        {/* La pregunta se dibuja ENCIMA del formulario, no lo reemplaza: se sigue viendo lo
            que está por perderse, que es la única forma de decidir con información. */}
        {preguntando && (
          <div className="absolute inset-0 z-20 flex items-center justify-center rounded-t-xl bg-white/80 backdrop-blur-sm p-4 sm:rounded-xl">
            <div
              role="alertdialog"
              aria-labelledby={`${tituloId}-descartar`}
              className="w-full max-w-xs rounded-xl border border-surface-border bg-white p-4 text-center shadow-xl"
            >
              <p id={`${tituloId}-descartar`} className="text-sm font-semibold text-navy">
                ¿Descartar los cambios?
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Lo que escribiste todavía no se guardó y se va a perder.
              </p>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  autoFocus
                  onClick={() => setPreguntando(false)}
                  className="btn-secondary flex-1 justify-center text-sm"
                >
                  Seguir editando
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="btn-danger flex-1 justify-center"
                >
                  Descartar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
