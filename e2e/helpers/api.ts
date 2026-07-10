import { APIRequestContext, expect } from "@playwright/test";

// Helpers que hablan con la API del CRM usando el request context de Playwright
// (hereda la cookie de sesión del proyecto autenticado).

export type Funnel = {
  total: number;
  etapas: { stage_id: string; nombre: string; orden: number; count: number; conversion: number }[];
  ganados: number;
  perdidos: number;
  valor_total: number;
  tasa_cierre: number;
};

// Rango amplio alrededor de hoy: garantiza que los deals recién creados
// (created_at = ahora) caigan dentro, sin depender de la zona horaria.
export function rangoHoy() {
  const hoy = new Date();
  const d = (offset: number) => {
    const x = new Date(hoy);
    x.setDate(x.getDate() + offset);
    return x.toISOString().slice(0, 10);
  };
  return { desde: d(-1), hasta: d(1) };
}

export async function getFunnel(
  request: APIRequestContext,
  opts: { desde: string; hasta: string; vendedor?: string }
): Promise<Funnel> {
  const qs = new URLSearchParams({ desde: opts.desde, hasta: opts.hasta });
  if (opts.vendedor) qs.set("vendedor", opts.vendedor);
  const res = await request.get(`/api/reportes/funnel?${qs.toString()}`);
  expect(res.ok(), `funnel GET falló: ${res.status()}`).toBeTruthy();
  return res.json();
}

export function countEtapa(f: Funnel, orden: number): number {
  return f.etapas.find((e) => e.orden === orden)?.count ?? 0;
}

export async function crearDealAPI(
  request: APIRequestContext,
  opts: { nombre: string; cliente_id: string; stage_id: string; vendedor_id?: string | null; valor?: string }
) {
  const res = await request.post("/api/crm/deals", {
    data: {
      nombre: opts.nombre,
      cliente_id: opts.cliente_id,
      vendedor_id: opts.vendedor_id ?? null,
      stage_id: opts.stage_id,
      tipo_cotizacion_id: "",
      temperatura: "TIBIO",
      valor: opts.valor ?? "100000",
      setup: "",
      mensualidad: "",
      canal: "",
      origen: "",
      fecha_cierre_estimada: "",
      contacto: { nombre: "E2E Contacto", rol: "DECISOR", email: "", telefono: "", whatsapp: "" },
    },
  });
  expect(res.status(), `crear deal falló: ${res.status()} ${await res.text()}`).toBe(201);
  return res.json();
}

export async function moverStage(request: APIRequestContext, dealId: string, stage_id: string) {
  const res = await request.patch(`/api/crm/deals/${dealId}/stage`, { data: { stage_id } });
  expect(res.ok(), `mover stage falló: ${res.status()}`).toBeTruthy();
  return res.json();
}

export type AccionResp = {
  score: number;
  temperatura: "MUY_FRIO" | "FRIO" | "TIBIO" | "CALIENTE" | "MUY_CALIENTE";
  probabilidad: number;
  sugerir_avance: boolean;
  avanzo_etapa: boolean;
};

export async function registrarAccionAPI(
  request: APIRequestContext,
  dealId: string,
  opts: {
    tipo: "NOTA" | "LLAMADA" | "EMAIL" | "WHATSAPP";
    tipo_accion_id: string;
    resultado_id: string;
    contenido?: string;
  }
): Promise<AccionResp> {
  const res = await request.post(`/api/crm/deals/${dealId}/actividades`, {
    data: {
      tipo: opts.tipo,
      contenido: opts.contenido ?? "E2E acción",
      tipo_accion_id: opts.tipo_accion_id,
      resultado_id: opts.resultado_id,
    },
  });
  expect(res.status(), `registrar acción falló: ${res.status()} ${await res.text()}`).toBe(201);
  return res.json();
}
