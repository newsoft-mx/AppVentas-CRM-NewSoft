import { prisma } from "@/lib/prisma";
import NuevaOrdenClient from "@/components/ordenes/NuevaOrdenClient";
import Link from "next/link";
import type { Metadata } from "next";
import { getServerSession } from "@/lib/server-session";
import { canWrite } from "@/lib/session";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Nueva orden" };
export const dynamic = "force-dynamic";

export default async function NuevaOrdenPage() {
  const session = await getServerSession();
  if (!canWrite(session)) redirect("/ventas");
  if (session?.rol === "VENDEDOR" && !session.vendedorId) redirect("/ventas");

  const [clientes, tipos, condiciones, vendedores, empresa] = await Promise.all([
    prisma.cliente.findMany({
      where: { activo: true },
      select: { id: true, nombre: true, rfc: true, condicion_pago_id: true },
      orderBy: { nombre: "asc" },
    }),
    prisma.tipoCotizacion.findMany({
      where: { activo: true },
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
    prisma.condicionComercial.findMany({
      where: { activo: true },
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
    prisma.vendedor.findMany({
      where: { activo: true },
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
    prisma.empresa.findFirst({
      select: {
        tasa_iva: true,
        aplicar_iva: true,
        vigencia_cotizacion_dias: true,
      },
    }),
  ]);

  const tasaIvaDefault = empresa?.tasa_iva.toNumber() ?? 16;
  const aplicarIvaDefault = empresa?.aplicar_iva ?? true;
  const vigenciaDiasDefault = empresa?.vigencia_cotizacion_dias ?? 30;

  return (
    <div className="max-w-3xl mx-auto">
      {/* ── Encabezado ── */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <Link href="/ventas" className="hover:text-navy transition-colors">
            Ventas
          </Link>
          <span>/</span>
          <span className="text-gray-700">Nueva orden</span>
        </div>
        <h1 className="text-2xl font-bold text-navy">Nueva orden de venta</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          El folio se asignará automáticamente al guardar.
        </p>
      </div>

      {/* ── Formulario ── */}
      <div className="rounded-xl border border-surface-border bg-white p-4 shadow-sm sm:p-6">
        <NuevaOrdenClient
          clientes={clientes}
          tipos={tipos}
          condiciones={condiciones}
          vendedores={
            session?.rol === "VENDEDOR"
              ? vendedores.filter((vendedor) => vendedor.id === session.vendedorId)
              : vendedores
          }
          tasaIvaDefault={tasaIvaDefault}
          aplicarIvaDefault={aplicarIvaDefault}
          vigenciaDiasDefault={vigenciaDiasDefault}
        />
      </div>
    </div>
  );
}
