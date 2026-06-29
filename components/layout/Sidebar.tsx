"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3,
  ShoppingCart,
  Users,
  Settings,
  ChevronRight,
  LogOut,
  Workflow,
  CalendarClock,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import type { UserRole } from "@/lib/session";

const navItems = [
  {
    href: "/ventas",
    label: "Ventas",
    icon: ShoppingCart,
  },
  {
    href: "/clientes",
    label: "Clientes",
    icon: Users,
  },
  {
    href: "/reportes",
    label: "Reportes",
    icon: BarChart3,
  },
  {
    href: "/pipeline",
    label: "Pipeline CRM",
    icon: Workflow,
  },
  {
    href: "/acciones",
    label: "Próximas Acciones",
    icon: CalendarClock,
  },
  {
    href: "/configuracion",
    label: "Configuración",
    icon: Settings,
  },
];

export default function Sidebar({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const router = useRouter();
  const [colapsado, setColapsado] = useState(false);
  // Persistir el estado colapsado (solo desktop). Init en useEffect evita mismatch de hidratación.
  useEffect(() => {
    setColapsado(localStorage.getItem("ns-sidebar-colapsado") === "1");
  }, []);
  const toggleColapsado = () => {
    setColapsado((c) => {
      const next = !c;
      localStorage.setItem("ns-sidebar-colapsado", next ? "1" : "0");
      return next;
    });
  };
  const items = role === "ADMIN" ? navItems : navItems.filter((item) => item.href !== "/configuracion");
  const roleLabel: Record<UserRole, string> = {
    ADMIN: "Administrador",
    GERENTE_COMERCIAL: "Gerente comercial",
    VENDEDOR: "Vendedor",
    ADMINISTRATIVO: "Administrativo",
  };

  const isActive = (href: string) => {
    if (href === "/ventas") return pathname === "/ventas" || pathname.startsWith("/ventas/");
    return pathname.startsWith(href);
  };

  return (
    <aside className={`sticky top-0 z-40 flex shrink-0 flex-col bg-navy text-white md:min-h-screen ${colapsado ? "md:w-16" : "md:w-[var(--sidebar-width)]"}`}>
      {/* Logo */}
      <div className="flex items-center justify-between gap-3 border-b border-navy-800 px-3 py-3 md:block md:px-5 md:py-5">
        {!colapsado && (
          <div className="rounded-xl bg-white px-3 py-2 shadow-sm">
            <Image
              src="/newsoft-logo.png"
              alt="NewSoft"
              width={150}
              height={33}
              className="h-6 w-auto md:h-7"
              unoptimized
              priority
            />
          </div>
        )}
        {!colapsado && (
          <div className="hidden min-w-0 md:block">
            <p className="text-xs text-navy-200 mt-2">Sales</p>
          </div>
        )}
        {/* Toggle colapsar (desktop) */}
        <button
          onClick={toggleColapsado}
          title={colapsado ? "Expandir" : "Colapsar"}
          className="hidden rounded-lg p-2 text-navy-200 hover:bg-navy-700 hover:text-white md:mt-2 md:flex"
        >
          {colapsado ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
        <button
          onClick={() =>
            fetch("/api/auth/logout", { method: "POST" }).then(() =>
              router.push("/login")
            )
          }
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-navy-200 transition-colors hover:bg-navy-700 hover:text-white md:hidden"
        >
          <LogOut size={14} />
          Salir
        </button>
      </div>

      {/* Navegación */}
      <nav className="flex gap-2 overflow-x-auto px-3 py-2 md:flex-1 md:flex-col md:space-y-1 md:overflow-visible md:py-4">
        {items.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                flex shrink-0 items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium md:gap-3
                transition-colors duration-150 group
                ${
                  active
                    ? "bg-orange text-white"
                    : "text-navy-200 hover:bg-navy-700 hover:text-white"
                }
              `}
            >
              <Icon size={18} className="shrink-0" />
              <span className={`whitespace-nowrap md:flex-1 ${colapsado ? "md:hidden" : ""}`}>{item.label}</span>
              {active && !colapsado && (
                <ChevronRight size={14} className="hidden shrink-0 opacity-70 md:block" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer del sidebar — logout */}
      <div className="hidden border-t border-navy-800 px-3 py-4 md:block">
        {!colapsado && (
          <p className="mb-2 px-3 text-[11px] font-medium uppercase tracking-wide text-navy-300">
            {roleLabel[role]}
          </p>
        )}
        <button
          onClick={() =>
            fetch("/api/auth/logout", { method: "POST" }).then(() =>
              router.push("/login")
            )
          }
          title="Cerrar sesión"
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs font-medium text-navy-300 hover:bg-navy-700 hover:text-white transition-colors"
        >
          <LogOut size={14} />
          {!colapsado && "Cerrar sesión"}
        </button>
      </div>
    </aside>
  );
}
