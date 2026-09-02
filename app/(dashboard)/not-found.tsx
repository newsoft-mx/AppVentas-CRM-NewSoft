import Link from "next/link";
import EstadoPanel from "@/components/ui/EstadoPanel";

/**
 * El 404 de las pantallas del dashboard.
 *
 * Cubre los cuatro `notFound()` que hay hoy: un deal o una orden que no existe, una orden de
 * otro vendedor, y `/pipeline/eliminados` para quien no es admin.
 *
 * El texto es DELIBERADAMENTE neutro. Dos de esos casos usan el 404 como control de acceso
 * —la orden ajena y la pantalla de eliminados— y decir "no tenés permiso" delataría que el
 * registro existe. "No encontramos esto" es verdad en los cuatro casos y no cuenta de más.
 */
export default function NoEncontradoDashboard() {
  return (
    <EstadoPanel
      variante="vacio"
      titulo="No encontramos lo que buscabas"
      detalle="Puede que se haya borrado, o que el enlace esté mal. Probá desde el menú."
      acciones={
        <Link href="/ventas" className="btn-primary text-sm">
          Ir a Órdenes
        </Link>
      }
    />
  );
}
