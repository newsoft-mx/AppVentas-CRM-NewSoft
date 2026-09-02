import Sidebar from "@/components/layout/Sidebar";
import { getServerSession } from "@/lib/server-session";
import { redirect } from "next/navigation";

/**
 * Layout del dashboard — incluye sidebar de navegación.
 * Todas las rutas bajo (dashboard) heredan este layout.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession();
  if (!session) redirect("/login");

  return (
    // De `md` para arriba el shell mide exactamente la ventana y el que scrollea es <main>.
    // Eso es lo que le da a las pantallas un alto DEFINIDO contra el cual medirse: sin esto,
    // `h-full` no tiene contra qué resolver y cae a `auto`. En teléfono se mantiene
    // `min-h-screen` con scroll de documento, que es lo que ya funcionaba.
    <div className="flex min-h-screen flex-col bg-surface md:h-screen md:flex-row">
      {/* Sidebar de navegación */}
      <Sidebar role={session.rol} />

      {/* Contenido principal.
          La cadena de alto solo se conecta de `md` para arriba, y a propósito. Una pantalla que
          quiere usar la ventana (el tablero de pipeline pide `h-full`) necesita que el alto le
          llegue desde acá: sin esto, `h-full` se resuelve como `auto`, el carril nunca crece y
          el tablero queda como una caja de 430px con media pantalla en blanco debajo.
          En teléfono NO se toca: ahí el documento tiene que scrollear normalmente, y encerrar
          el contenido en un alto fijo rompe el scroll.
          Una pantalla MÁS ALTA que la ventana no se recorta: `<main>` lleva `overflow-y-auto`,
          así que scrollea ella. Verificado en las 10 pantallas — Configuración (1291px) y
          Reportes (1012px) scrollean; ninguna queda cortada. */}
      <main className="min-w-0 flex-1 md:overflow-y-auto">
        <div className="px-4 py-5 sm:px-6 md:flex md:h-full md:flex-col md:p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
