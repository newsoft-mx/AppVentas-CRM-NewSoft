import { prisma } from "@/lib/prisma";
import { serializeEmpresa, serializeTipo, serializeCondicion, serializeVendedor, serializeUsuario } from "@/lib/serializers";
import ConfiguracionClient from "@/components/configuracion/ConfiguracionClient";
import type { Metadata } from "next";
import { getServerSession } from "@/lib/server-session";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Configuración" };

// Revalidar cada vez que se accede (datos pueden cambiar)
export const dynamic = "force-dynamic";

export default async function ConfiguracionPage() {
  const session = await getServerSession();
  if (session?.rol !== "ADMIN") redirect("/ventas");

  // Fetch en paralelo desde el servidor — sin waterfall
  const [empresa, tipos, condiciones, vendedores, usuarios, stages] = await Promise.all([
    prisma.empresa.findFirst(),
    prisma.tipoCotizacion.findMany({
      orderBy: [{ activo: "desc" }, { nombre: "asc" }],
    }),
    prisma.condicionComercial.findMany({
      orderBy: [{ activo: "desc" }, { nombre: "asc" }],
    }),
    prisma.vendedor.findMany({
      orderBy: [{ activo: "desc" }, { nombre: "asc" }],
    }),
    prisma.user.findMany({
      select: {
        id: true,
        nombre: true,
        email: true,
        activo: true,
        created_at: true,
        updated_at: true,
      },
      orderBy: [{ activo: "desc" }, { nombre: "asc" }],
    }),
    prisma.pipelineStage.findMany({
      select: { id: true, nombre: true, orden: true, color: true, activo: true, probabilidad_base: true },
      orderBy: [{ activo: "desc" }, { orden: "asc" }],
    }),
  ]);

  return (
    <ConfiguracionClient
      initialEmpresa={empresa ? serializeEmpresa(empresa) : null}
      initialTipos={tipos.map(serializeTipo)}
      initialCondiciones={condiciones.map(serializeCondicion)}
      initialVendedores={vendedores.map(serializeVendedor)}
      initialUsuarios={usuarios.map(serializeUsuario)}
      initialStages={stages}
    />
  );
}
