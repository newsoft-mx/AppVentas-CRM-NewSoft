"use client";

import { useState } from "react";
import { Building2, Tag, CreditCard, UserRound, Users } from "lucide-react";
import TabEmpresa from "./TabEmpresa";
import TabTipos from "./TabTipos";
import TabCondiciones from "./TabCondiciones";
import TabVendedores from "./TabVendedores";
import TabUsuarios from "./TabUsuarios";
import type { Empresa, TipoCotizacion, CondicionComercial, Vendedor, Usuario } from "@/types/configuracion";

interface ConfiguracionClientProps {
  initialEmpresa: Empresa | null;
  initialTipos: TipoCotizacion[];
  initialCondiciones: CondicionComercial[];
  initialVendedores: Vendedor[];
  initialUsuarios: Usuario[];
}

const TABS = [
  { id: "empresa", label: "Empresa", icon: Building2 },
  { id: "tipos", label: "Tipos de Cotización", icon: Tag },
  { id: "condiciones", label: "Condiciones Comerciales", icon: CreditCard },
  { id: "vendedores", label: "Vendedores", icon: UserRound },
  { id: "usuarios", label: "Usuarios", icon: Users },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function ConfiguracionClient({
  initialEmpresa,
  initialTipos,
  initialCondiciones,
  initialVendedores,
  initialUsuarios,
}: ConfiguracionClientProps) {
  const [activeTab, setActiveTab] = useState<TabId>("empresa");

  return (
    <div className="space-y-6">
      {/* Título de página */}
      <div>
        <h1 className="text-2xl font-bold text-navy">Configuración</h1>
        <p className="text-sm text-gray-500 mt-1">
          Gestiona los datos de tu empresa, tipos de cotización, condiciones comerciales y vendedores.
        </p>
      </div>

      {/* Card con tabs */}
      <div className="bg-white rounded-xl border border-surface-border shadow-sm overflow-hidden">
        {/* Barra de tabs */}
        <div className="flex overflow-x-auto border-b border-surface-border bg-gray-50/60 px-1 pt-1">
          {TABS.map(({ id, label, icon: Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`
                  relative -mb-px flex shrink-0 items-center gap-2 rounded-t-lg px-3 py-3 text-sm font-medium
                  transition-colors duration-150
                  ${
                    isActive
                      ? "bg-white text-navy border border-surface-border border-b-white"
                      : "text-gray-500 hover:text-gray-700 hover:bg-gray-100 border border-transparent"
                  }
                `}
              >
                <Icon size={15} />
                {label}
                {isActive && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-orange rounded-full" />
                )}
              </button>
            );
          })}
        </div>

        {/* Contenido del tab activo */}
        <div className="p-4 sm:p-6">
          {activeTab === "empresa" && (
            initialEmpresa ? (
              <TabEmpresa empresa={initialEmpresa} />
            ) : (
              <div className="py-12 text-center text-gray-400">
                <p>No hay empresa configurada. Contacta al administrador del sistema.</p>
              </div>
            )
          )}

          {activeTab === "tipos" && (
            <TabTipos initialTipos={initialTipos} />
          )}

          {activeTab === "condiciones" && (
            <TabCondiciones initialCondiciones={initialCondiciones} />
          )}

          {activeTab === "vendedores" && (
            <TabVendedores initialVendedores={initialVendedores} />
          )}

          {activeTab === "usuarios" && (
            <TabUsuarios initialUsuarios={initialUsuarios} />
          )}
        </div>
      </div>
    </div>
  );
}
