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
  ChevronsLeft,
  LogOut,
  Workflow,
  CalendarClock,
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
    <aside className={`sticky top-0 z-40 flex shrink-0 flex-col bg-navy text-white transition-[width] duration-300 ease-in-out md:h-screen ${colapsado ? "md:w-16" : "md:w-[var(--sidebar-width)]"}`}>
      {/* Logo */}
      <div className="flex items-center justify-between gap-3 border-b border-navy-800 px-3 py-3 md:block md:px-4 md:py-5">
        {/* Logo completo (wordmark): mobile siempre; desktop solo expandido */}
        <div className={`rounded-xl bg-white px-3 py-2 shadow-sm ${colapsado ? "md:hidden" : ""}`}>
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
        {/* Icono (favicon): solo desktop colapsado, centrado */}
        {colapsado && (
          <div className="hidden justify-center md:flex">
            <div className="rounded-lg bg-white p-1.5 shadow-sm">
              <Image
                src="/newsoft-favicon.png"
                alt="NewSoft"
                width={28}
                height={28}
                className="h-7 w-7"
                unoptimized
                priority
              />
            </div>
          </div>
        )}
        {/* Mobile: logout (colapsar es solo desktop y vive en el footer) */}
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
      <nav className="flex gap-2 overflow-x-auto px-3 py-2 md:flex-1 md:flex-col md:space-y-1 md:overflow-y-auto md:py-4">
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
              <span
                className={`overflow-hidden whitespace-nowrap transition-all duration-200 ease-in-out md:flex-1 ${
                  colapsado ? "md:w-0 md:flex-none md:opacity-0" : "md:opacity-100"
                }`}
              >
                {item.label}
              </span>
              {active && !colapsado && (
                <ChevronRight size={14} className="hidden shrink-0 opacity-70 md:block" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer del sidebar — colapsar + sesión */}
      <div className="hidden border-t border-navy-800 px-3 py-3 md:block">
        {/* Colapsar / expandir (desktop) */}
        <button
          onClick={toggleColapsado}
          title={colapsado ? "Expandir menú" : "Colapsar menú"}
          aria-label={colapsado ? "Expandir menú" : "Colapsar menú"}
          className={`mb-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-navy-300 transition-colors hover:bg-navy-700 hover:text-white ${
            colapsado ? "md:justify-center" : ""
          }`}
        >
          <ChevronsLeft
            size={16}
            className={`shrink-0 transition-transform duration-300 ease-in-out ${colapsado ? "rotate-180" : ""}`}
          />
          <span
            className={`overflow-hidden whitespace-nowrap transition-all duration-200 ease-in-out ${
              colapsado ? "w-0 opacity-0" : "opacity-100"
            }`}
          >
            Colapsar
          </span>
        </button>

        {!colapsado && (
          <p className="mb-1 mt-2 px-3 text-[11px] font-medium uppercase tracking-wide text-navy-300">
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
          aria-label="Cerrar sesión"
          className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-navy-300 transition-colors hover:bg-navy-700 hover:text-white ${
            colapsado ? "md:justify-center" : ""
          }`}
        >
          <LogOut size={14} className="shrink-0" />
          <span
            className={`overflow-hidden whitespace-nowrap transition-all duration-200 ease-in-out ${
              colapsado ? "w-0 opacity-0" : "opacity-100"
            }`}
          >
            Cerrar sesión
          </span>
        </button>
      </div>
    </aside>
  );
}
