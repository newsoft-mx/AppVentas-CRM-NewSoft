import { getServerSession } from "@/lib/server-session";
import { isAdmin } from "@/lib/session";
import SaludClient from "@/components/salud/SaludClient";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Salud del sistema" };
export const dynamic = "force-dynamic";

export default async function SaludPage() {
  const session = await getServerSession();
  if (!session || !isAdmin(session)) {
    return (
      <div className="rounded-xl border border-surface-border bg-white p-12 text-center text-gray-400">
        Esta sección es solo para administradores.
      </div>
    );
  }
  return <SaludClient />;
}
