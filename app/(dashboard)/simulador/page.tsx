import type { Metadata } from "next";
import SimuladorClient from "@/components/simulador/SimuladorClient";

export const metadata: Metadata = { title: "Simulador de casos" };
export const dynamic = "force-dynamic";

// Simulador de Casos de Negocio (nativo, sobre el kit de cotizador). Reemplaza al iframe del
// HTML autocontenido: mismo cálculo y mismo shape de `datos` (casos guardados compatibles).
// ?caso=<id> abre un caso guardado · ?deal=<id> arranca uno nuevo ligado a ese deal.
export default async function SimuladorPage({
  searchParams,
}: {
  searchParams: Promise<{ caso?: string; deal?: string }>;
}) {
  const { caso, deal } = await searchParams;
  return <SimuladorClient casoInicial={caso ?? null} dealId={deal ?? null} />;
}
