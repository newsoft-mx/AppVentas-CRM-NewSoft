import type { CalculadoraInputs, ServicioConsumo } from "@/lib/calculadora-plataformas";

// Defaults de arranque de la Calculadora (tomados del prototipo). En un solo lugar (SSOT);
// más adelante pueden volverse configurables desde un tab. Todo es editable en la UI.

export const SERVICIOS_DEFAULT: ServicioConsumo[] = [
  { id: "ai", nombre: "Tokens de IA", tipo: "variable", unidad: "k tokens", volumen: 500, precioUnit: 0.01, activo: true },
  { id: "cfdi", nombre: "Facturas (CFDI)", tipo: "variable", unidad: "facturas", volumen: 200, precioUnit: 1.2, activo: true },
  { id: "wa-linea", nombre: "Línea WhatsApp (renta mensual)", tipo: "fijo", costoFijo: 874, activo: true, nota: "$874/mes por línea" },
  { id: "wa", nombre: "WhatsApp conversaciones", tipo: "variable", unidad: "conversaciones", volumen: 1000, precioUnit: 1.0, activo: true },
  { id: "sms", nombre: "SMS", tipo: "variable", unidad: "mensajes", volumen: 500, precioUnit: 0.85, activo: false },
  { id: "email", nombre: "Correos", tipo: "variable", unidad: "correos", volumen: 5000, precioUnit: 0.05, activo: false },
];

export const INPUTS_DEFAULT: CalculadoraInputs = {
  hrsDesarrollo: 160,
  tarifaHora: 1250,
  antiPct: 50,
  meses: 24,
  tasa: 2,
  hrsSoporte: 8,
  tarifaSoporte: 1250,
  costoVercel: 350,
  margenConsumo: 20,
  servicios: SERVICIOS_DEFAULT,
};
