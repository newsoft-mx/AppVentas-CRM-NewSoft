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
  TrendingUp,
  ShieldCheck,
  UserCircle,
  Calculator,
} from "lucide-react";
import { ROLE_LABEL, type UserRole } from "@/lib/session";

// Navegación por módulos temáticos; los reportes viven anidados en su módulo.
const navGroups: {
  title: string | null;
  items: { href: string; label: string; icon: typeof ShoppingCart; adminOnly?: boolean }[];
}[] = [
  {
    title: "Ventas",
    items: [
      { href: "/ventas", label: "Órdenes", icon: ShoppingCart },
      { href: "/reportes", label: "Reportes", icon: BarChart3 },
    ],
  },
  {
    title: "Pipeline CRM",
    items: [
      { href: "/pipeline", label: "Pipeline", icon: Workflow },
      { href: "/acciones", label: "Próximas Acciones", icon: CalendarClock },
      { href: "/pipeline/reportes", label: "Reportes de Funnel", icon: TrendingUp },
      { href: "/simulador", label: "Simulador de casos", icon: Calculator },
    ],
  },
  {
    title: null,
    items: [
      { href: "/clientes", label: "Clientes", icon: Users },
      { href: "/configuracion", label: "Configuración", icon: Settings, adminOnly: true },
      { href: "/salud", label: "Salud del sistema", icon: ShieldCheck, adminOnly: true },
    ],
  },
];

export default function Sidebar({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const router = useRouter();
  const [colapsado, setColapsado] = useState(false);
  // Persistir el estado colapsado (solo desktop). Se lee de localStorage tras montar: en
  // render rompería la hidratación (localStorage no existe en SSR) y no se puede lazy-init.
  // Patrón correcto; la regla es conservadora con setState-en-effect.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setColapsado(localStorage.getItem("ns-sidebar-colapsado") === "1");
  }, []);
  const toggleColapsado = () => {
    setColapsado((c) => {
      const next = !c;
      localStorage.setItem("ns-sidebar-colapsado", next ? "1" : "0");
      return next;
    });
  };
  // Filtra items por rol (Configuración solo ADMIN) y descarta grupos vacíos.
  const grupos = navGroups
    .map((g) => ({ ...g, items: g.items.filter((it) => !it.adminOnly || role === "ADMIN") }))
    .filter((g) => g.items.length > 0);
  const isActive = (href: string) => {
    if (href === "/ventas") return pathname === "/ventas" || pathname.startsWith("/ventas/");
    // "Pipeline" (/pipeline) no debe activarse en /pipeline/reportes (submódulo aparte)
    if (href === "/pipeline") {
      return pathname === "/pipeline" || (pathname.startsWith("/pipeline/") && !pathname.startsWith("/pipeline/reportes"));
    }
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
            width={876}
            height={191}
            className="h-6 w-auto md:h-7"
            unoptimized
            priority
          />
        </div>
        {/* Icono: solo desktop colapsado, centrado. Logo transparente (sin fondo)
            → el hexágono se ve directo sobre el navy, sin recuadro. */}
        {colapsado && (
          <div className="hidden justify-center md:flex">
            <Image
              src="/newsoft-favicon.png"
              alt="NewSoft"
              width={192}
              height={192}
              className="h-8 w-8 shrink-0 object-contain"
              unoptimized
              priority
            />
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

      {/* Navegación por módulos (desktop: secciones con encabezado; mobile: fila plana) */}
      <nav className="flex gap-2 overflow-x-auto px-3 py-2 md:flex-1 md:flex-col md:gap-1 md:overflow-y-auto md:py-4">
        {grupos.flatMap((group, gi) => [
          // Encabezado del módulo (solo desktop expandido); grupo sin título → divisor
          group.title ? (
            <p
              key={`t-${gi}`}
              className={`hidden shrink-0 px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-navy-400 md:block ${
                colapsado ? "md:hidden" : ""
              }`}
            >
              {group.title}
            </p>
          ) : gi > 0 ? (
            <div key={`d-${gi}`} className="hidden border-t border-navy-800 md:my-2 md:block" />
          ) : null,
          ...group.items.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  flex shrink-0 items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium md:gap-3
                  transition-colors duration-150 group
                  ${active ? "bg-orange text-white" : "text-navy-200 hover:bg-navy-700 hover:text-white"}
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
          }),
        ])}
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
            {ROLE_LABEL[role]}
          </p>
        )}
        <Link
          href="/perfil"
          title="Mi perfil"
          className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors hover:bg-navy-700 hover:text-white ${
            isActive("/perfil") ? "bg-navy-700 text-white" : "text-navy-300"
          } ${colapsado ? "md:justify-center" : ""}`}
        >
          <UserCircle size={16} className="shrink-0" />
          <span
            className={`overflow-hidden whitespace-nowrap transition-all duration-200 ease-in-out ${
              colapsado ? "w-0 opacity-0" : "opacity-100"
            }`}
          >
            Mi perfil
          </span>
        </Link>
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
