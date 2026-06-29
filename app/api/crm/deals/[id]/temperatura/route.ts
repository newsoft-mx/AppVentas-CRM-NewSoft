import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canWrite, requireAuth } from "@/lib/session";

export const dynamic = "force-dynamic";

const TEMPS = ["MUY_FRIO", "FRIO", "TIBIO", "CALIENTE", "MUY_CALIENTE"] as const;
type Temp = (typeof TEMPS)[number];

// ── PATCH /api/crm/deals/:id/temperatura ────────────────────────
// Override manual del termómetro del deal (REQ-06): el vendedor ajusta a mano.
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

  const temperatura = (body as { temperatura?: unknown })?.temperatura;
  if (!TEMPS.includes(temperatura as Temp)) {
    return NextResponse.json({ error: "temperatura inválida" }, { status: 422 });
  }

  try {
    await prisma.deal.update({ where: { id }, data: { temperatura: temperatura as Temp } });
    return NextResponse.json({ ok: true, temperatura });
  } catch {
    return NextResponse.json({ error: "Error al actualizar la temperatura" }, { status: 500 });
  }
}
