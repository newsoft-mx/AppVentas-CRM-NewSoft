import type { TipoCatalogoDeal } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { crearDealTx, HttpError } from "@/lib/deals";
import type { TamanoEmpresa } from "@/types/crm";

// Alta de un lead que entra por una fuente EXTERNA (web, Meta, etc.). El core de creación
// (prospecto+contacto+deal) vive en crearDealTx; acá va el glue común de intake: primera
// etapa, buzón, resolución de nombres→IDs de catálogo, y el canal/origen SEGÚN LA FUENTE.
// Cada adaptador (route por fuente) sólo normaliza su payload a LeadIntakeInput y llama
// registrarLead con su fuente → multi-fuente sin duplicar ni tocar el core.

// Payload ya normalizado (lo que toda fuente debe mapear a esto). Refleja TODOS los campos
// con los que se da de alta un deal; salvo `nombre`, todos son opcionales.
export interface LeadIntakeInput {
  nombre: string; // nombre del contacto (único obligatorio)
  email?: string | null;
  telefono?: string | null;
  whatsapp?: string | null;
  cargo?: string | null;
  // Empresa / prospecto
  empresa?: string | null;
  website?: string | null;
  tamano_empresa?: TamanoEmpresa | null;
  // Comerciales del deal
  titulo?: string | null; // nombre del deal; si falta → "Lead — {empresa}"
  tipo?: string | null; // nombre del tipo de cotización (se resuelve contra el catálogo activo)
  moneda?: "MXN" | "USD" | null;
  valor?: number | null;
  setup?: number | null;
  mensualidad?: number | null;
  meses?: number | null;
  fecha_cierre_estimada?: Date | null;
  // Atribución
  campana?: string | null; // origen específico (campaña); si falta usa el de la fuente
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

// Tipo de cotización = catálogo CURADO (tiene precios/contrato asociados) → NO se crea al
// vuelo. Se matchea por nombre (case-insensitive) contra los activos; si no matchea, se
// ignora y se avisa (el lead entra igual, sin tipo).
type TipoResuelto = { id: string | null; aviso?: string };
async function resolverTipo(nombre: string): Promise<TipoResuelto> {
  const tipos = await prisma.tipoCotizacion.findMany({ where: { activo: true }, select: { id: true, nombre: true } });
  const match = tipos.find((t) => t.nombre.toLowerCase() === nombre.trim().toLowerCase());
  if (match) return { id: match.id };
  const nombres = tipos.map((t) => t.nombre).join(", ");
  return { id: null, aviso: `tipo "${nombre}" no existe; se ignoró. Válidos: ${nombres || "(ninguno configurado)"}` };
}

// Resultado del intake: el deal creado + avisos de campos blandos que se ignoraron (no son
// errores; el lead se creó igual). El adaptador los devuelve al integrador para que ajuste.
export interface LeadIntakeResult {
  deal: Awaited<ReturnType<typeof crearDealTx>>;
  avisos: string[];
}

export async function registrarLead(lead: LeadIntakeInput, source: LeadSource): Promise<LeadIntakeResult> {
  const avisos: string[] = [];

  // Primera etapa del pipeline (por orden) = donde entra un lead nuevo.
  const stage = await prisma.pipelineStage.findFirst({
    where: { activo: true },
    orderBy: { orden: "asc" },
    select: { id: true },
  });
  if (!stage) throw new HttpError(503, "Pipeline sin etapas configuradas");

  // Origen: la campaña específica (si vino) toma precedencia sobre el default de la fuente.
  const origenNombre = lead.campana?.trim() || source.origen;

  const [cfg, canal, origen, tipo] = await Promise.all([
    prisma.crmConfig.findUnique({ where: { id: "crm" }, select: { vendedor_leads_web_id: true } }),
    getOrCreateCatalogo("CANAL", source.canal),
    getOrCreateCatalogo("ORIGEN", origenNombre),
    lead.tipo ? resolverTipo(lead.tipo) : Promise.resolve<TipoResuelto>({ id: null }),
  ]);
  if (tipo.aviso) avisos.push(tipo.aviso);

  // Empresa: la del payload o, si no vino, el nombre del contacto (para no dejar el prospecto sin nombre).
  const empresa = lead.empresa || lead.nombre;
  const website = lead.website
    ? (/^https?:\/\//i.test(lead.website) ? lead.website : `https://${lead.website}`).slice(0, 255)
    : null;

  const deal = await prisma.$transaction((tx) =>
    crearDealTx(tx, {
      nombre: lead.titulo?.trim() || `Lead — ${empresa}`,
      prospecto: { nombre: empresa, website, tamano_empresa: lead.tamano_empresa ?? null },
      contacto: {
        nombre: lead.nombre,
        email: lead.email ?? null,
        telefono: lead.telefono ?? null,
        whatsapp: lead.whatsapp ?? null,
        cargo: lead.cargo ?? null,
      },
      contactoRol: "OTRO",
      stage_id: stage.id,
      vendedor_id: cfg?.vendedor_leads_web_id ?? null,
      tipo_cotizacion_id: tipo.id,
      moneda: lead.moneda ?? "MXN",
      valor: lead.valor ?? 0,
      setup: lead.setup ?? null,
      mensualidad: lead.mensualidad ?? null,
      meses: lead.meses ?? null,
      canal_id: canal.id,
      origen_id: origen.id,
      fecha_cierre_estimada: lead.fecha_cierre_estimada ?? null,
      notas: lead.mensaje ?? null,
    })
  );

  return { deal, avisos };
}
