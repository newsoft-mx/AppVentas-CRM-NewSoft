import type { Metadata } from "next";

export const metadata: Metadata = { title: "Simulador de casos" };

// El simulador es una herramienta autocontenida (su propio design system). Se embebe
// en un iframe para aislarlo por completo de los estilos del CRM (sin choques en ambas
// direcciones). El HTML vive en public/simulador.html y guarda/carga contra el API del
// CRM (same-origin: la cookie de sesión viaja sola).
// Fase 2: ?caso=<id> / ?deal=<id> se reenvían al iframe para abrir un caso o crear uno
// vinculado desde el detalle del deal.
export default async function SimuladorPage({
  searchParams,
}: {
  searchParams: Promise<{ caso?: string; deal?: string }>;
}) {
  const { caso, deal } = await searchParams;
  const qs = caso ? `?caso=${encodeURIComponent(caso)}` : deal ? `?deal=${encodeURIComponent(deal)}` : "";
  return (
    <iframe
      src={`/simulador.html${qs}`}
      title="Simulador de casos de negocio"
      className="h-[calc(100dvh-3rem)] w-full rounded-lg border border-surface-border bg-white"
    />
  );
}
