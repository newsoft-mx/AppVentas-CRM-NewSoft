export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdmin, requireAuth } from "@/lib/session";
import { logger } from "@/lib/logger";

// GET /api/admin/health — chequeo de salud de invariantes (read-only, admin).
// Verifica en producción los invariantes de carga que la auditoría marcó como
// "sostenidos solo por convención" (modo E: inobservables). No escribe nada.
//
// Cada check devuelve { count, sano }. Los de tipo "violacion" deben dar count=0;
// los "informativo" son números para decidir política (ej. fuga de cliente inactivo).
export async function GET(req: NextRequest) {
  const session = await requireAuth(req);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  try {
    // Catálogo de tipos/resultados activos+inactivos (para detectar refs huérfanas)
    const [tipos, resultados] = await Promise.all([
      prisma.tipoAccion.findMany({ select: { id: true } }),
      prisma.resultadoAccion.findMany({ select: { id: true } }),
    ]);
    const tiposIds = tipos.map((t) => t.id);
    const resIds = resultados.map((r) => r.id);

    const [
      dealsSinContacto,
      ganadosSinOrden,
      ventasSinFecha,
      clienteInactivo,
      ordenDup,
      refHuerfanaTipo,
      refHuerfanaResultado,
      usdSinTc,
    ] = await Promise.all([
      // Bloque C — "un deal siempre tiene ≥1 contacto"
      prisma.deal.count({ where: { contactos: { none: {} } } }),
      // Bloque T — "un deal GANADO tiene una orden vinculada"
      prisma.deal.count({ where: { resultado: "GANADO", orden_id: null } }),
      // Bloque F — "una orden VENTA siempre tiene fecha_venta"
      prisma.ordenVenta.count({ where: { estatus: "VENTA", fecha_venta: null } }),
      // Bloque F (informativo) — fuga: ventas de clientes desactivados que siguen sumando
      prisma.ordenVenta.aggregate({
        where: { estatus: "VENTA", cliente: { activo: false } },
        _count: true,
        _sum: { total_mxn: true },
      }),
      // El check "estado_accion y completada están sincronizados" se va con la columna:
      // desde SOL-21/23 el estado es UNO y derivado (lib/tareas → estadoTarea), así que
      // ya no hay dos campos que puedan desincronizarse. Peor: nada volvía a escribir
      // estado_accion, así que el check reportaba como violación la deriva natural de una
      // columna muerta — ruido permanente en el panel.
      // Bloque E — "PipelineStage.orden es único entre activas"
      prisma.pipelineStage.groupBy({
        by: ["orden"],
        where: { activo: true },
        _count: { orden: true },
        having: { orden: { _count: { gt: 1 } } },
      }),
      // Bloque S — actividades que referencian un tipo/resultado inexistente (catálogo borrado en duro)
      prisma.dealActividad.count({ where: { tipo_accion_id: { not: null, notIn: tiposIds } } }),
      prisma.dealActividad.count({ where: { resultado_id: { not: null, notIn: resIds } } }),
      // Bloque F — "moneda USD ⇒ tipo_cambio presente"
      prisma.ordenVenta.count({ where: { moneda: "USD", tipo_cambio: null } }),
    ]);

    const checks = [
      { id: "deals_sin_contacto", bloque: "C", tipo: "violacion", count: dealsSinContacto,
        titulo: "Deals sin ningún contacto" },
      { id: "ganados_sin_orden", bloque: "T", tipo: "violacion", count: ganadosSinOrden,
        titulo: "Deals GANADO sin orden vinculada (orden_id null)" },
      { id: "ventas_sin_fecha", bloque: "F", tipo: "violacion", count: ventasSinFecha,
        titulo: "Órdenes VENTA sin fecha_venta" },
      { id: "etapas_orden_duplicado", bloque: "E", tipo: "violacion", count: ordenDup.length,
        titulo: "Etapas activas con el mismo 'orden'" },
      { id: "actividad_ref_huerfana", bloque: "S", tipo: "violacion",
        count: refHuerfanaTipo + refHuerfanaResultado,
        titulo: "Actividades que referencian un tipo/resultado inexistente" },
      { id: "ventas_usd_sin_tc", bloque: "F", tipo: "violacion", count: usdSinTc,
        titulo: "Órdenes USD sin tipo de cambio" },
      { id: "ventas_cliente_inactivo", bloque: "F", tipo: "informativo", count: clienteInactivo._count,
        titulo: "Ventas de clientes desactivados (siguen sumando en financieros)",
        monto_mxn: Number(clienteInactivo._sum.total_mxn ?? 0) },
    ];

    const violaciones = checks.filter((c) => c.tipo === "violacion" && c.count > 0);
    return NextResponse.json({
      sano: violaciones.length === 0,
      violaciones: violaciones.length,
      checks,
    });
  } catch (err) {
    logger.error("Error en health-check de invariantes", "GET /api/admin/health", err);
    return NextResponse.json({ error: "Error al ejecutar el health-check" }, { status: 500 });
  }
}
