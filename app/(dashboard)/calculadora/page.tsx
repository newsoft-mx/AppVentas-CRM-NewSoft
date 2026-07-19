import type { Metadata } from "next";
import CalculadoraClient from "@/components/calculadora/CalculadoraClient";

export const metadata: Metadata = { title: "Calculadora de Plataformas" };

// Calculadora de Plataformas Administradas (Fase 1): herramienta de cotización nativa.
// El cálculo vive en lib/calculadora-plataformas (puro/testeable); acá solo se monta la UI.
// Fase 2 sumará guardar/cargar casos + vínculo a un deal (patrón de SimuladorCaso).
export default function CalculadoraPage() {
  return <CalculadoraClient />;
}
