export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { COOKIES_MEMORIA } from "@/lib/filtros-memoria";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete("ns-auth");
  // La memoria de filtros también se va. Esto es una PC compartida en un CRM: sin borrarlas,
  // el siguiente usuario entra al Pipeline filtrado por un vendedor ajeno — y si es VENDEDOR,
  // con el scoping por rol ve la pantalla vacía sin ninguna causa visible.
  for (const c of COOKIES_MEMORIA) res.cookies.delete(c);
  return res;
}
