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
    <div className="flex min-h-screen flex-col bg-surface md:flex-row">
      {/* Sidebar de navegación */}
      <Sidebar role={session.rol} />

      {/* Contenido principal */}
      <main className="min-w-0 flex-1">
        <div className="px-4 py-5 sm:px-6 md:p-6">{children}</div>
      </main>
    </div>
  );
}
