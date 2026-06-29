"use client";

import { MapPin, Mail, Phone, User, Briefcase, Pencil, PowerOff } from "lucide-react";
import { formatMXN, formatUSD } from "@/lib/utils";
import { getCondicionBadgeClasses, getAvatarClasses, getInitials } from "@/lib/ui-helpers";
import { ESTATUS_CLIENTE_META, type ClienteConStats } from "@/types/clientes";

interface ClienteCardProps {
  cliente: ClienteConStats;
  onEdit?: (cliente: ClienteConStats) => void;
  onDesactivar?: (cliente: ClienteConStats) => void;
}

export default function ClienteCard({ cliente, onEdit, onDesactivar }: ClienteCardProps) {
  const { stats, condicion_pago } = cliente;

  const avatarClasses = getAvatarClasses(cliente.nombre);
  const badgeClasses = getCondicionBadgeClasses(condicion_pago.nombre);
  const initials = getInitials(cliente.nombre);

  const tieneMXN = stats.total_mxn > 0;
  const tieneUSD = stats.total_usd > 0;

  return (
    <div className="bg-white rounded-xl border border-surface-border shadow-sm hover:shadow-md transition-shadow duration-200 flex flex-col overflow-hidden">

      {/* ── Cabecera: avatar + nombre ── */}
      <div className="flex items-start gap-3 p-5 pb-4">
        <div
          className={`shrink-0 w-11 h-11 rounded-xl flex items-center justify-center text-base font-bold ${avatarClasses}`}
        >
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-navy text-sm leading-tight line-clamp-2">
              {cliente.nombre}
            </h3>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${ESTATUS_CLIENTE_META[cliente.estatus].chip}`}>
              {ESTATUS_CLIENTE_META[cliente.estatus].label}
            </span>
          </div>
          <p className="text-xs text-gray-400 font-mono mt-0.5">
            {cliente.rfc || "RFC no registrado"}
          </p>
        </div>
      </div>

      {/* ── Info de contacto ── */}
      <div className="px-5 space-y-1.5 flex-1">
        <InfoRow icon={User} text={cliente.contacto} />
        <InfoRow icon={MapPin} text={cliente.ciudad} />
        <InfoRow icon={Mail} text={cliente.email || "Email no registrado"} truncate />
        {cliente.telefono && <InfoRow icon={Phone} text={cliente.telefono} />}

        {/* Badge condición de pago */}
        <div className="pt-1.5 pb-0.5">
          <span className={`badge text-xs font-medium ${badgeClasses}`}>
            {condicion_pago.nombre}
          </span>
        </div>
      </div>

      {/* ── Separador ── */}
      <div className="mx-5 my-3 border-t border-surface-border" />

      {/* ── Stats de ventas ── */}
      <div className="px-5 pb-4 space-y-1">
        <div className="flex items-center gap-1.5">
          <Briefcase size={13} className="text-gray-400 shrink-0" />
          <span className="text-xs text-gray-500">
            <span className="font-semibold text-gray-700">{stats.num_ordenes}</span>{" "}
            {stats.num_ordenes === 1 ? "orden" : "órdenes"}
          </span>
        </div>

        {stats.num_ordenes === 0 ? (
          <p className="text-xs text-gray-400 pl-5">Sin ventas registradas</p>
        ) : (
          <div className="pl-5 space-y-0.5">
            {/* Montos por moneda */}
            {tieneMXN && (
              <p className="text-xs text-gray-700 font-medium">
                {formatMXN(stats.total_mxn)}{" "}
                <span className="text-gray-400 font-normal">MXN</span>
              </p>
            )}
            {tieneUSD && (
              <div>
                <p className="text-xs text-gray-700 font-medium">
                  {formatUSD(stats.total_usd)}{" "}
                  <span className="text-gray-400 font-normal">USD</span>
                </p>
                {/* Equivalente en MXN solo si hay USD */}
                {tieneUSD && !tieneMXN && (
                  <p className="text-xs text-gray-400">
                    ≈ {formatMXN(stats.grand_total_mxn)} MXN
                  </p>
                )}
              </div>
            )}
            {/* Grand total si hay ambas monedas */}
            {tieneMXN && tieneUSD && (
              <p className="text-xs text-orange font-semibold">
                Total: {formatMXN(stats.grand_total_mxn)} MXN
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Acciones ── */}
      {(onEdit || onDesactivar) && (
        <div className="flex items-center justify-between gap-2 px-5 py-3 bg-gray-50 border-t border-surface-border">
          {onDesactivar && (
            <button
              onClick={() => onDesactivar(cliente)}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-500 transition-colors py-1"
              title="Desactivar cliente"
            >
              <PowerOff size={13} />
              Desactivar
            </button>
          )}
          {onEdit && (
            <button
              onClick={() => onEdit(cliente)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
                text-navy border border-navy/20 rounded-lg bg-white
                hover:bg-navy hover:text-white transition-colors"
            >
              <Pencil size={13} />
              Editar
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Sub-componente: fila de info ─────────────────────────────
function InfoRow({
  icon: Icon,
  text,
  truncate,
}: {
  icon: React.ElementType;
  text: string;
  truncate?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 text-xs text-gray-600 min-w-0">
      <Icon size={12} className="text-gray-400 shrink-0" />
      <span className={truncate ? "truncate" : ""}>{text}</span>
    </div>
  );
}
