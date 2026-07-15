import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canWrite, requireAuth } from "@/lib/session";
import { scopeDealWhere } from "@/lib/access-control";
import { logger } from "@/lib/logger";
import { TAMANOS_EMPRESA, type TamanoEmpresa } from "@/types/crm";

export const dynamic = "force-dynamic";

// ── PATCH /api/crm/deals/:id ────────────────────────────────────
// Edición completa de la ficha del deal (SOL-01): acepta cualquier subconjunto
// de los campos capturados en el alta. Sigue soportando { notas } solo.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await requireAuth(req);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!canWrite(session)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const b = (body ?? {}) as Record<string, unknown>;
  const data: Record<string, unknown> = {};
  const errores: string[] = [];

  // Numérico ≥0: opcional admite null; no-opcional rechaza vacío
  const num = (k: string, opcional: boolean) => {
    if (b[k] === undefined) return;
    const raw = b[k];
    if (raw === "" || raw === null) {
      if (opcional) data[k] = null;
      else errores.push(`${k} inválido`);
      return;
    }
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0) data[k] = n;
    else errores.push(`${k} inválido`);
  };

  if (b.nombre !== undefined) {
    const n = typeof b.nombre === "string" ? b.nombre.trim() : "";
    if (!n) errores.push("El nombre no puede estar vacío");
    else data.nombre = n;
  }
  if (b.cliente_id !== undefined) {
    if (typeof b.cliente_id === "string" && b.cliente_id) data.cliente_id = b.cliente_id;
    else errores.push("cliente_id inválido");
  }
  if (b.stage_id !== undefined) {
    if (typeof b.stage_id === "string" && b.stage_id) data.stage_id = b.stage_id;
    else errores.push("stage_id inválido");
  }
  if (b.vendedor_id !== undefined)
    data.vendedor_id = typeof b.vendedor_id === "string" && b.vendedor_id ? b.vendedor_id : null;
  if (b.tipo_cotizacion_id !== undefined)
    data.tipo_cotizacion_id = typeof b.tipo_cotizacion_id === "string" && b.tipo_cotizacion_id ? b.tipo_cotizacion_id : null;
  // La temperatura NO se edita acá: se deriva del score. El override manual va por
  // PATCH /deals/:id/temperatura (escribe ajuste_manual).
  num("valor", false);
  num("setup", true);
  num("mensualidad", true);
  if (b.meses !== undefined) {
    const raw = b.meses;
    if (raw === "" || raw === null) data.meses = null;
    else {
      const n = Number(raw);
      if (Number.isFinite(n) && n >= 0) data.meses = Math.round(n);
      else errores.push("meses inválido");
    }
  }
  if (b.moneda !== undefined) data.moneda = b.moneda === "USD" ? "USD" : "MXN";
  // Canal/Origen → FK al catálogo (CatalogoDeal). Vacío → null.
  if (b.canal_id !== undefined) data.canal_id = typeof b.canal_id === "string" && b.canal_id ? b.canal_id : null;
  if (b.origen_id !== undefined) data.origen_id = typeof b.origen_id === "string" && b.origen_id ? b.origen_id : null;

  // Datos de EMPRESA (website/tamaño): viven en el Cliente vinculado, no en el Deal.
  // Se editan desde el modal del deal por comodidad y se aplican a ese cliente.
  const clienteData: Record<string, unknown> = {};
  if (b.website !== undefined) {
    const w = typeof b.website === "string" ? b.website.trim() : "";
    clienteData.website = w ? (/^https?:\/\//i.test(w) ? w : `https://${w}`).slice(0, 255) : null;
  }
  if (b.tamano_empresa !== undefined) {
    const t = typeof b.tamano_empresa === "string" ? b.tamano_empresa : "";
    clienteData.tamano_empresa = TAMANOS_EMPRESA.includes(t as TamanoEmpresa) ? (t as TamanoEmpresa) : null;
  }
  if (b.notas !== undefined) {
    const n = typeof b.notas === "string" ? b.notas.trim() : "";
    if (n.length > 2000) errores.push("La descripción es demasiado larga (máx. 2000)");
    else data.notas = n || null;
  }
  if (b.fecha_cierre_estimada !== undefined) {
    const raw = b.fecha_cierre_estimada;
    if (!raw) data.fecha_cierre_estimada = null;
    else {
      const d = new Date(`${raw as string}T00:00:00`);
      if (Number.isNaN(d.getTime())) errores.push("fecha_cierre_estimada inválida");
      else data.fecha_cierre_estimada = d;
    }
  }
  // Fecha de ingreso al pipeline (dato de negocio, editable). Obligatoria (NOT NULL);
  // created_at NO se toca acá (auditoría inmutable).
  if (b.fecha_ingreso !== undefined) {
    const raw = b.fecha_ingreso;
    if (!raw) errores.push("La fecha de ingreso es obligatoria");
    else {
      const d = new Date(`${raw as string}T00:00:00`);
      if (Number.isNaN(d.getTime())) errores.push("fecha_ingreso inválida");
      else data.fecha_ingreso = d;
    }
  }

  if (errores.length) return NextResponse.json({ error: errores.join("; ") }, { status: 422 });
  const hayDeal = Object.keys(data).length > 0;
  const hayCliente = Object.keys(clienteData).length > 0;
  if (!hayDeal && !hayCliente) return NextResponse.json({ error: "Nada para actualizar" }, { status: 422 });

  try {
    // Scoping por vendedor (evita IDOR): un VENDEDOR solo edita sus propios deals.
    const deal = await prisma.deal.findFirst({
      where: scopeDealWhere(session, { id }),
      select: { id: true, stage_id: true, cliente_id: true },
    });
    if (!deal) return NextResponse.json({ error: "Deal no encontrado" }, { status: 404 });

    // Bloque E: si esta edición mueve el deal de etapa, hay que registrar el
    // DealStageEvent igual que /stage. El funnel reconstruye la etapa alcanzada
    // desde ese historial; un cambio de stage_id sin evento lo hace divergir del
    // pipeline real. Se hace en UNA transacción con el update y se reinicia
    // fecha_entrada_stage (tiempo en etapa). Los datos de empresa (website/tamaño)
    // se aplican al cliente vinculado (nuevo si cambió, o el actual) en la misma tx.
    const cambiaStage = typeof data.stage_id === "string" && data.stage_id !== deal.stage_id;
    if (cambiaStage) data.fecha_entrada_stage = new Date();
    const targetClienteId = (data.cliente_id as string) || deal.cliente_id;

    const ops: Prisma.PrismaPromise<unknown>[] = [];
    if (hayDeal) ops.push(prisma.deal.update({ where: { id }, data: data as Prisma.DealUpdateInput }));
    if (cambiaStage) {
      ops.push(prisma.dealStageEvent.create({
        data: { deal_id: id, from_stage_id: deal.stage_id, to_stage_id: data.stage_id as string },
      }));
    }
    if (hayCliente && targetClienteId) {
      ops.push(prisma.cliente.update({
        where: { id: targetClienteId },
        data: clienteData as Prisma.ClienteUpdateInput,
      }));
    }
    await prisma.$transaction(ops);
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error("Error al actualizar el deal", "PATCH /api/crm/deals/:id", err);
    return NextResponse.json({ error: "Error al actualizar el deal" }, { status: 500 });
  }
}
