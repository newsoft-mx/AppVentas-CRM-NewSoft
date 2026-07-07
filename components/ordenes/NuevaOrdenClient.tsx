"use client";

import { useRouter } from "next/navigation";
import OrdenForm from "./OrdenForm";
import type { OrdenDetalle } from "@/types/ordenes";

interface ClienteOpcion {
  id: string;
  nombre: string;
  rfc: string | null;
  condicion_pago_id: string;
}

interface CatalogItem {
  id: string;
  nombre: string;
}

interface NuevaOrdenClientProps {
  clientes: ClienteOpcion[];
  tipos: CatalogItem[];
  condiciones: CatalogItem[];
  vendedores: CatalogItem[];
  tasaIvaDefault: number;
  aplicarIvaDefault: boolean;
  vigenciaDiasDefault: number;
  precarga?: { cliente_id?: string; vendedor_id?: string; descripcion?: string; valor?: number };
}

export default function NuevaOrdenClient({
  clientes,
  tipos,
  condiciones,
  vendedores,
  tasaIvaDefault,
  aplicarIvaDefault,
  vigenciaDiasDefault,
  precarga,
}: NuevaOrdenClientProps) {
  const router = useRouter();

  const handleSuccess = (orden: OrdenDetalle) => {
    router.push(`/ventas/${orden.id}`);
  };

  const handleCancel = () => {
    router.push("/ventas");
  };

  return (
    <OrdenForm
      clientes={clientes}
      tipos={tipos}
      condiciones={condiciones}
      vendedores={vendedores}
      precarga={precarga}
      tasaIvaDefault={tasaIvaDefault}
      aplicarIvaDefault={aplicarIvaDefault}
      vigenciaDiasDefault={vigenciaDiasDefault}
      onSuccess={handleSuccess}
      onCancel={handleCancel}
    />
  );
}
