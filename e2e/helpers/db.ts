import { PrismaClient } from "@prisma/client";

// Cliente Prisma para los tests: apunta a la MISMA base que el server local
// (localhost:5433 Docker). Se usa para leer ids del catálogo, preparar
// precondiciones (umbral de avance) y limpiar los datos que crean los tests.
export const db = new PrismaClient();

export const TEST_PREFIX = "E2E";

export type Catalogo = Awaited<ReturnType<typeof catalogo>>;

export async function catalogo() {
  const [stages, tipos, resultados, clienteActivo, vendedor] = await Promise.all([
    db.pipelineStage.findMany({
      where: { activo: true },
      orderBy: { orden: "asc" },
      select: { id: true, nombre: true, orden: true },
    }),
    db.tipoAccion.findMany({ select: { id: true, nombre: true } }),
    db.resultadoAccion.findMany({ select: { id: true, nombre: true } }),
    db.cliente.findFirst({ where: { estatus: "ACTIVO" }, select: { id: true, nombre: true } }),
    db.vendedor.findFirst({ where: { activo: true }, select: { id: true, nombre: true } }),
  ]);
  return { stages, tipos, resultados, clienteActivo, vendedor };
}

export function stageDeOrden(cat: Catalogo, orden: number) {
  const s = cat.stages.find((x) => x.orden === orden);
  if (!s) throw new Error(`No hay etapa con orden ${orden}`);
  return s;
}

export function tipoPorNombre(cat: Catalogo, nombre: string) {
  const t = cat.tipos.find((x) => x.nombre === nombre);
  if (!t) throw new Error(`No hay tipo de acción "${nombre}"`);
  return t;
}

export function resultadoPorNombre(cat: Catalogo, nombre: string) {
  const r = cat.resultados.find((x) => x.nombre === nombre);
  if (!r) throw new Error(`No hay resultado "${nombre}"`);
  return r;
}

// Fija/limpia el umbral de avance por score de una etapa (precondición para
// probar el avance sugerido dirigido por el termómetro).
export async function setUmbralAvance(orden: number, valor: number | null) {
  await db.pipelineStage.updateMany({ where: { orden }, data: { umbral_avance_score: valor } });
}

// Borra todo lo que crean los tests (deals y prospectos con prefijo E2E). Los
// hijos del deal (contactos, actividades, stage_events) caen por onDelete: Cascade.
export async function limpiarDatosDeTest() {
  await db.deal.deleteMany({ where: { nombre: { startsWith: TEST_PREFIX } } });
  await db.cliente.deleteMany({ where: { nombre: { startsWith: TEST_PREFIX } } });
}
