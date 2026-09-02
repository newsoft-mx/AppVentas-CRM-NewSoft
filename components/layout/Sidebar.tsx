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
  Contact,
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
  Target,
  ScrollText,
  Menu,
  X,
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
    ],
  },
  {
    title: "Cotización",
    items: [
      { href: "/simulador", label: "Simulador de casos", icon: Target },
      { href: "/calculadora", label: "Calculadora de Plataformas", icon: Calculator },
    ],
  },
  {
    title: null,
    items: [
      { href: "/clientes", label: "Clientes", icon: Users },
      { href: "/contactos", label: "Contactos", icon: Contact },
      { href: "/configuracion", label: "Configuración", icon: Settings, adminOnly: true },
      { href: "/auditoria", label: "Bitácora", icon: ScrollText, adminOnly: true },
      { href: "/salud", label: "Salud del sistema", icon: ShieldCheck, adminOnly: true },
    ],
  },
];

type Grupo = (typeof navGroups)[number];

/**
 * Las entradas del menú. Se dibujan en dos lados —la barra de escritorio y el cajón del
 * teléfono— y por eso viven acá: son los mismos trece destinos y los mismos cinco grupos,
 * no dos listas que haya que acordarse de mantener iguales.
 */
function EntradasDeMenu({
  grupos,
  isActive,
  colapsado,
  onNavegar,
}: {
  grupos: Grupo[];
  isActive: (href: string) => boolean;
  colapsado: boolean;
  /** En el cajón, tocar una entrada además lo cierra. En la barra no hay nada que cerrar. */
  onNavegar?: () => void;
}) {
  return (
    <>
      {grupos.flatMap((group, gi) => [
        group.title ? (
          <p
            key={`t-${gi}`}
            className={`shrink-0 px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-navy-200 ${
              colapsado ? "md:hidden" : ""
            }`}
          >
            {group.title}
          </p>
        ) : gi > 0 ? (
          <div key={`d-${gi}`} className="my-2 border-t border-navy-800" />
        ) : null,
        ...group.items.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavegar}
              className={`
                flex shrink-0 items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium md:gap-3
                transition-colors duration-150 group
                ${active ? "bg-orange text-navy" : "text-navy-200 hover:bg-navy-700 hover:text-white"}
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
                <ChevronRight size={14} className="ml-auto hidden shrink-0 opacity-70 md:block" />
              )}
            </Link>
          );
        }),
      ])}
    </>
  );
}

/** Rol, "Mi perfil" y "Cerrar sesión". También se dibuja en los dos lados. */
function BloqueDeSesion({
  role,
  colapsado,
  isActive,
  onSalir,
  onNavegar,
}: {
  role: UserRole;
  colapsado: boolean;
  isActive: (href: string) => boolean;
  onSalir: () => void;
  onNavegar?: () => void;
}) {
  return (
    <>
      {!colapsado && (
        <p className="mb-1 mt-2 px-3 text-[11px] font-medium uppercase tracking-wide text-navy-300">
          {ROLE_LABEL[role]}
        </p>
      )}
      <Link
        href="/perfil"
        title="Mi perfil"
        onClick={onNavegar}
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
        onClick={onSalir}
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
    </>
  );
}

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

  const salir = () =>
    fetch("/api/auth/logout", { method: "POST" }).then(() => router.push("/login"));

  /**
   * El menú del teléfono.
   *
   * Antes la misma `<aside>` se convertía en una fila horizontal con scroll: de las trece
   * entradas se veían TRES (medido a 390px: 390px visibles de 1846px), y las otras diez
   * quedaban detrás de un swipe sin ninguna señal de que hubiera más. Peor: "Mi perfil" vivía
   * en el pie, que es `hidden md:block`, así que en teléfono no existía — y es la única
   * pantalla donde uno cambia su propia contraseña.
   *
   * Ahora es un cajón. No se agrega ni se saca nada del menú: se vuelve alcanzable lo que ya
   * estaba, con los mismos trece destinos y los mismos cinco grupos.
   */
  const [cajonAbierto, setCajonAbierto] = useState(false);
  const cerrarCajon = () => setCajonAbierto(false);

  // Con el cajón abierto, Escape lo cierra y el fondo no scrollea por detrás.
  useEffect(() => {
    if (!cajonAbierto) return;
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCajonAbierto(false);
    };
    document.addEventListener("keydown", alTeclear);
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", alTeclear);
      document.body.style.overflow = overflowPrevio;
    };
  }, [cajonAbierto]);

  // Al cambiar de pantalla el cajón se cierra solo: quedarse abierto encima del destino
  // recién elegido es la forma más rápida de que se sienta roto. Se ajusta DURANTE el render
  // —el patrón del repo para estado derivado de un valor que cambia— y no en un efecto, que
  // dejaría un frame con el cajón tapando la pantalla nueva. Cubre también ir y volver con
  // los botones del navegador, que no pasan por el `onClick` de ningún enlace.
  const [rutaPrev, setRutaPrev] = useState(pathname);
  if (pathname !== rutaPrev) {
    setRutaPrev(pathname);
    setCajonAbierto(false);
  }

  const logo = (
    <div className="rounded-xl bg-white px-3 py-2 shadow-sm">
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
  );

  return (
    <>
      {/* ══ TELÉFONO: barra superior + cajón ══════════════════════════════ */}
      <div className="sticky top-0 z-40 flex items-center justify-between gap-3 bg-navy px-3 py-3 text-white md:hidden">
        {logo}
        <button
          type="button"
          onClick={() => setCajonAbierto((a) => !a)}
          aria-label="Menú"
          aria-expanded={cajonAbierto}
          aria-controls="menu-lateral"
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-navy-200 transition-colors hover:bg-navy-700 hover:text-white"
        >
          <Menu size={18} />
          Menú
        </button>
      </div>

      {cajonAbierto && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* El fondo cierra el cajón. No hay nada que perder acá: es navegación, no un
              formulario, así que no hace falta preguntar. */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={cerrarCajon}
            aria-hidden="true"
          />
          <div
            id="menu-lateral"
            role="dialog"
            aria-modal="true"
            aria-label="Menú de navegación"
            className="animate-fade-in absolute inset-y-0 left-0 flex w-[min(19rem,85vw)] flex-col bg-navy text-white shadow-2xl"
          >
            <div className="flex items-center justify-between gap-3 border-b border-navy-800 px-3 py-3">
              {logo}
              <button
                type="button"
                onClick={cerrarCajon}
                aria-label="Cerrar menú"
                className="rounded-lg p-2 text-navy-200 transition-colors hover:bg-navy-700 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
              <EntradasDeMenu
                grupos={grupos}
                isActive={isActive}
                colapsado={false}
                onNavegar={cerrarCajon}
              />
            </nav>

            <div className="border-t border-navy-800 px-3 py-3">
              <BloqueDeSesion
                role={role}
                colapsado={false}
                isActive={isActive}
                onSalir={salir}
                onNavegar={cerrarCajon}
              />
            </div>
          </div>
        </div>
      )}

      {/* ══ ESCRITORIO: la barra de siempre ═══════════════════════════════ */}
      <aside
        className={`sticky top-0 z-40 hidden shrink-0 flex-col bg-navy text-white transition-[width] duration-300 ease-in-out md:flex md:h-screen ${
          colapsado ? "md:w-16" : "md:w-[var(--sidebar-width)]"
        }`}
      >
        <div className="border-b border-navy-800 px-4 py-5">
          <div className={colapsado ? "hidden" : ""}>{logo}</div>
          {colapsado && (
            <div className="flex justify-center">
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
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
          <EntradasDeMenu grupos={grupos} isActive={isActive} colapsado={colapsado} />
        </nav>

        <div className="border-t border-navy-800 px-3 py-3">
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

          <BloqueDeSesion
            role={role}
            colapsado={colapsado}
            isActive={isActive}
            onSalir={salir}
          />
        </div>
      </aside>
    </>
  );
}
