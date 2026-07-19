import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/server-session";
import { canManageClients } from "@/lib/session";
import { scopeClienteWhere } from "@/lib/access-control";
import { CONTACTO_DIRECTORIO_INCLUDE, toDirectorioItem } from "@/lib/contactos-directorio";
import ContactosClient from "@/components/contactos/ContactosClient";

export const metadata: Metadata = { title: "Contactos" };
export const dynamic = "force-dynamic";

// Directorio de contactos (Módulo Contactos v1): todos los contactos de todos los clientes y
// prospectos, buscables, con su organización y participación en deals. Scoping por rol: el
// VENDEDOR solo ve contactos de SUS clientes/deals (vía scopeClienteWhere); ADMIN/GERENTE, todos.
export default async function ContactosPage() {
  const session = await getServerSession();

  const [contactos, organizaciones] = await Promise.all([
    prisma.contacto.findMany({
      where: { activo: true, cliente: scopeClienteWhere(session, { activo: true }) },
      include: CONTACTO_DIRECTORIO_INCLUDE,
      orderBy: { nombre: "asc" },
    }),
    // Organizaciones elegibles al crear un contacto (mismo scope que ve el usuario).
    prisma.cliente.findMany({
      where: scopeClienteWhere(session, { activo: true }),
      select: { id: true, nombre: true, estatus: true },
      orderBy: { nombre: "asc" },
    }),
  ]);

  return (
    <ContactosClient
      initialContactos={contactos.map(toDirectorioItem)}
      organizaciones={organizaciones}
      canWrite={canManageClients(session)}
    />
  );
}
