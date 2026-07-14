import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getServerSession } from "@/lib/server-session";
import { prisma } from "@/lib/prisma";
import { ROLE_LABEL } from "@/lib/session";
import PerfilClient from "@/components/perfil/PerfilClient";

export const metadata: Metadata = { title: "Mi perfil" };
export const dynamic = "force-dynamic";

export default async function PerfilPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { nombre: true, email: true, rol: true, vendedor: { select: { nombre: true } } },
  });
  if (!user) redirect("/login");

  return (
    <PerfilClient
      nombre={user.nombre}
      email={user.email}
      rolLabel={ROLE_LABEL[user.rol]}
      vendedorNombre={user.vendedor?.nombre ?? null}
    />
  );
}
