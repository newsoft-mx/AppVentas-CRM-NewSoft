import type { Metadata } from "next";

export const metadata: Metadata = { title: "Simulador de casos" };

// El simulador es una herramienta autocontenida (su propio design system). Se embebe
// en un iframe para aislarlo por completo de los estilos del CRM (sin choques en ambas
// direcciones). El HTML vive en public/simulador.html y guarda/carga contra el API del
// CRM (same-origin: la cookie de sesión viaja sola).
export default function SimuladorPage() {
  return (
    <iframe
      src="/simulador.html"
      title="Simulador de casos de negocio"
      className="h-[calc(100dvh-3rem)] w-full rounded-lg border border-surface-border bg-white"
    />
  );
}
