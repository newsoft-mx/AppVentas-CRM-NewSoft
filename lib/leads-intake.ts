import type { TipoCatalogoDeal } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { crearDealTx, HttpError } from "@/lib/deals";

// Alta de un lead que entra por una fuente EXTERNA (web, Meta, etc.). El core de creación
// (prospecto+contacto+deal) vive en crearDealTx; acá va el glue común de intake: primera
// etapa, buzón, y el canal/origen SEGÚN LA FUENTE. Cada adaptador (route por fuente) sólo
// normaliza su payload a LeadIntakeInput y llama registrarLead con su fuente → multi-fuente
// sin duplicar ni tocar el core.

// Payload ya normalizado (lo que toda fuente debe mapear a esto).
export interface LeadIntakeInput {
  nombre: string; // nombre del contacto
  email?: string | null;
  telefono?: string | null;
  empresa?: string | null;
  website?: string | null;
  mensaje?: string | null;
}

// De dónde vino el lead → se registra como canal/origen del deal (catálogo).
export interface LeadSource {
  canal: string; // ej. "Web", "Meta"
  origen: string; // ej. "Formulario web", "Facebook Lead Ads", "Instagram Lead Ads"
}

async function getOrCreateCatalogo(tipo: TipoCatalogoDeal, nombre: string) {
  return prisma.catalogoDeal.upsert({
    where: { tipo_nombre: { tipo, nombre } },
    create: { tipo, nombre },
    update: {},
    select: { id: true },
  });
}

export async function registrarLead(lead: LeadIntakeInput, source: LeadSource) {
  // Primera etapa del pipeline (por orden) = donde entra un lead nuevo.
  const stage = await prisma.pipelineStage.findFirst({
    where: { activo: true },
    orderBy: { orden: "asc" },
    select: { id: true },
  });
  if (!stage) throw new HttpError(503, "Pipeline sin etapas configuradas");

  const [cfg, canal, origen] = await Promise.all([
    prisma.crmConfig.findUnique({ where: { id: "crm" }, select: { vendedor_leads_web_id: true } }),
    getOrCreateCatalogo("CANAL", source.canal),
    getOrCreateCatalogo("ORIGEN", source.origen),
  ]);

  // Empresa: la del payload o, si no vino, el nombre del contacto (para no dejar el prospecto sin nombre).
  const empresa = lead.empresa || lead.nombre;
  const website = lead.website
    ? (/^https?:\/\//i.test(lead.website) ? lead.website : `https://${lead.website}`).slice(0, 255)
    : null;

  return prisma.$transaction((tx) =>
    crearDealTx(tx, {
      nombre: `Lead — ${empresa}`,
      prospecto: { nombre: empresa, website },
      contacto: { nombre: lead.nombre, email: lead.email ?? null, telefono: lead.telefono ?? null },
      contactoRol: "OTRO",
      stage_id: stage.id,
      vendedor_id: cfg?.vendedor_leads_web_id ?? null,
      canal_id: canal.id,
      origen_id: origen.id,
      notas: lead.mensaje ?? null,
    })
  );
}
