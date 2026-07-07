import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canWrite, requireAuth } from "@/lib/session";
import type { DealResumen, Temperatura } from "@/types/crm";

export const dynamic = "force-dynamic";

const TEMPERATURAS = ["MUY_FRIO", "FRIO", "TIBIO", "CALIENTE", "MUY_CALIENTE"];

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// ── POST /api/crm/deals ─────────────────────────────────────────
// Crea un nuevo deal (prospecto) en el pipeline.
export async function POST(req: NextRequest) {
  const session = await requireAuth(req);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!canWrite(session)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const nombre = typeof body.nombre === "string" ? body.nombre.trim() : "";
  let cliente_id = typeof body.cliente_id === "string" ? body.cliente_id : "";
  const stage_id = typeof body.stage_id === "string" ? body.stage_id : "";
  const temperatura = TEMPERATURAS.includes(body.temperatura as string)
    ? (body.temperatura as Temperatura)
    : "TIBIO";

  // Contacto obligatorio: un deal nace con al menos un contacto.
  const ROLES = ["DECISOR", "INFLUENCIADOR", "USUARIO", "OTRO"];
  const c = (body.contacto ?? {}) as Record<string, unknown>;
  const contactoNombre = typeof c.nombre === "string" ? c.nombre.trim() : "";
  const contactoRol = ROLES.includes(c.rol as string) ? (c.rol as string) : "OTRO";
  const contactoEmail = typeof c.email === "string" && c.email.trim() ? c.email.trim() : null;
  const contactoTel = typeof c.telefono === "string" && c.telefono.trim() ? c.telefono.trim() : null;

  // Alta rápida de prospecto: si no hay cliente_id, se crea un Cliente con estatus=PROSPECTO
  // a partir de los datos mínimos (empresa + contacto). Los datos fiscales se piden al convertir.
  const cn = (body.cliente_nuevo ?? null) as Record<string, unknown> | null;
  const prospectoNombre = cn && typeof cn.nombre === "string" ? cn.nombre.trim() : "";

  if (!nombre) return NextResponse.json({ error: "El nombre es obligatorio", campo: "nombre" }, { status: 422 });
  if (nombre.length > 200 || prospectoNombre.length > 200 || contactoNombre.length > 150) {
    return NextResponse.json({ error: "Texto demasiado largo", campo: "nombre" }, { status: 422 });
  }
  if (!cliente_id && !prospectoNombre) {
    return NextResponse.json(
      { error: "Indica un cliente existente o un prospecto nuevo", campo: "cliente_id" },
      { status: 422 }
    );
  }
  if (!stage_id) return NextResponse.json({ error: "La etapa es obligatoria", campo: "stage_id" }, { status: 422 });
  if (!contactoNombre) return NextResponse.json({ error: "El nombre del contacto es obligatorio", campo: "contacto.nombre" }, { status: 422 });

  try {
    // Crear el prospecto si corresponde (datos mínimos; condición = primera activa)
    if (!cliente_id && prospectoNombre) {
      const cond = await prisma.condicionComercial.findFirst({
        where: { activo: true },
        orderBy: { dias_credito: "asc" },
        select: { id: true },
      });
      if (!cond) {
        return NextResponse.json({ error: "No hay condiciones de pago configuradas" }, { status: 422 });
      }
      const prospecto = await prisma.cliente.create({
        data: {
          nombre: prospectoNombre,
          contacto: contactoNombre,
          ciudad: "",
          email: contactoEmail,
          telefono: contactoTel,
          condicion_pago_id: cond.id,
          estatus: "PROSPECTO",
        },
        select: { id: true },
      });
      cliente_id = prospecto.id;
    }

    // Validar FKs (cliente activo, stage activo)
    const [cliente, stage] = await Promise.all([
      prisma.cliente.findFirst({ where: { id: cliente_id, activo: true }, select: { id: true } }),
      prisma.pipelineStage.findFirst({ where: { id: stage_id, activo: true }, select: { id: true, probabilidad_base: true } }),
    ]);
    if (!cliente) return NextResponse.json({ error: "Cliente inválido", campo: "cliente_id" }, { status: 422 });
    if (!stage) return NextResponse.json({ error: "Etapa inválida", campo: "stage_id" }, { status: 422 });

    // Probabilidad automática: deriva de la etapa (no se captura a mano)
    const probabilidad = stage.probabilidad_base;
    const fechaCierre = typeof body.fecha_cierre_estimada === "string" && body.fecha_cierre_estimada
      ? new Date(body.fecha_cierre_estimada) : null;

    const deal = await prisma.deal.create({
      data: {
        nombre,
        cliente_id,
        stage_id,
        vendedor_id: typeof body.vendedor_id === "string" && body.vendedor_id ? body.vendedor_id : null,
        tipo_cotizacion_id: typeof body.tipo_cotizacion_id === "string" && body.tipo_cotizacion_id ? body.tipo_cotizacion_id : null,
        temperatura,
        probabilidad: probabilidad != null ? Math.min(100, Math.max(0, Math.round(probabilidad))) : null,
        moneda: body.moneda === "USD" ? "USD" : "MXN",
        valor: num(body.valor) ?? 0,
        setup: num(body.setup),
        mensualidad: num(body.mensualidad),
        meses: num(body.meses) != null ? Math.round(num(body.meses)!) : null,
        canal: typeof body.canal === "string" && body.canal.trim() ? body.canal.trim() : null,
        origen: typeof body.origen === "string" && body.origen.trim() ? body.origen.trim() : null,
        fecha_cierre_estimada: fechaCierre,
        // Contacto principal (obligatorio) creado junto con el deal
        contactos: {
          create: [{
            nombre: contactoNombre,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            rol: contactoRol as any,
            email: typeof c.email === "string" && c.email.trim() ? c.email.trim() : null,
            telefono: typeof c.telefono === "string" && c.telefono.trim() ? c.telefono.trim() : null,
            whatsapp: typeof c.whatsapp === "string" && c.whatsapp.trim() ? c.whatsapp.trim() : null,
          }],
        },
      },
      include: {
        cliente: { select: { id: true, nombre: true } },
        vendedor: { select: { id: true, nombre: true } },
        tipo_cotizacion: { select: { id: true, nombre: true } },
      },
    });

    const resumen: DealResumen = {
      id: deal.id,
      nombre: deal.nombre,
      valor: Number(deal.valor),
      moneda: deal.moneda,
      temperatura: deal.temperatura as Temperatura,
      probabilidad: deal.probabilidad,
      resultado: deal.resultado,
      stage_id: deal.stage_id,
      dias_en_etapa: 0,
      actividades_count: 0,
      proximo_seguimiento: null,
      atencion: "SIN_PROXIMA",
      cliente: deal.cliente ? { id: deal.cliente.id, nombre: deal.cliente.nombre } : null,
      vendedor: deal.vendedor ? { id: deal.vendedor.id, nombre: deal.vendedor.nombre } : null,
      tipo: deal.tipo_cotizacion ? { id: deal.tipo_cotizacion.id, nombre: deal.tipo_cotizacion.nombre } : null,
    };

    return NextResponse.json(resumen, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Error al crear el deal" }, { status: 500 });
  }
}
