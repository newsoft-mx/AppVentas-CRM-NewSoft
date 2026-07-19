import type { Metadata } from "next";
import CalculadoraClient from "@/components/calculadora/CalculadoraClient";

export const metadata: Metadata = { title: "Calculadora de Plataformas" };
export const dynamic = "force-dynamic";

// Calculadora de Plataformas Administradas: herramienta de cotización nativa. El cálculo vive
// en lib/calculadora-plataformas (puro/testeable); acá se monta la UI y se pasan los deep-links.
// ?caso=<id> abre una cotización guardada · ?deal=<id> arranca una nueva ligada a ese deal.
export default async function CalculadoraPage({
  searchParams,
}: {
  searchParams: Promise<{ caso?: string; deal?: string }>;
}) {
  const { caso, deal } = await searchParams;
  return <CalculadoraClient casoInicial={caso ?? null} dealId={deal ?? null} />;
}
