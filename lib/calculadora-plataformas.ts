// Motor de la Calculadora de Plataformas Administradas (Fase 1).
//
// Cálculo PURO (sin UI, sin estado): inputs → resultado. Vive acá para ser SSOT, testeable y
// poder correr en el backend cuando se persista una cotización (regla "moneda en el backend").
// El componente solo captura inputs y pinta el resultado.

/** Un servicio de consumo: fijo (renta mensual) o variable (volumen × precio unitario). */
export interface ServicioConsumo {
  id: string;
  nombre: string;
  tipo: "fijo" | "variable";
  activo: boolean;
  // Variable:
  unidad?: string;
  volumen?: number;
  precioUnit?: number;
  // Fijo:
  costoFijo?: number;
  nota?: string;
}

/** Todo lo que el usuario configura. */
export interface CalculadoraInputs {
  hrsDesarrollo: number;
  tarifaHora: number;
  antiPct: number; // % anticipo (upfront)
  meses: number; // plazo de financiamiento
  tasa: number; // tasa mensual (%) sobre saldo promedio
  hrsSoporte: number;
  tarifaSoporte: number;
  costoVercel: number; // infra fija mensual (costo = precio, sin margen)
  margenConsumo: number; // % de margen sobre el costo de consumo
  servicios: ServicioConsumo[];
}

/** Una línea de consumo ya calculada. */
export interface ConsumoLinea {
  id: string;
  nombre: string;
  tipo: "fijo" | "variable";
  unidad?: string;
  volumen?: number;
  precioUnit?: number;
  costoFijo?: number;
  costo: number;
  cobro: number;
  margenMXN: number;
}

/** Resultado completo del cálculo. */
export interface CalculadoraResultado {
  valorDev: number;
  anticipo: number;
  financiado: number;
  hayFin: boolean;
  amort: number;
  interes: number;
  totalIntereses: number;
  sop: number;
  infraVercel: number;
  cuotaMensual: number; // dev financiado + interés + soporte + infra
  consumoDetalle: ConsumoLinea[];
  totalConsumoCosto: number;
  totalConsumoCobro: number;
  margenConsumoMXN: number;
  totalMensualCliente: number; // cuota fija + consumo estimado
  totalContrato: number; // anticipo + cuota fija × meses (el consumo es variable, no se proyecta)
}

/** Costo base de un servicio: renta fija, o volumen × precio unitario. */
export function costoServicio(s: ServicioConsumo): number {
  return s.tipo === "fijo" ? s.costoFijo ?? 0 : (s.volumen ?? 0) * (s.precioUnit ?? 0);
}

export function calcularPlataforma(i: CalculadoraInputs): CalculadoraResultado {
  const valorDev = i.hrsDesarrollo * i.tarifaHora;
  const anticipo = valorDev * (i.antiPct / 100);
  const financiado = valorDev - anticipo;
  const hayFin = financiado > 0;
  const amort = hayFin ? financiado / i.meses : 0;
  // Interés sobre el saldo promedio (financiado / 2), como el prototipo.
  const interes = hayFin && i.tasa > 0 ? (financiado / 2) * (i.tasa / 100) : 0;
  const totalIntereses = interes * i.meses;

  const sop = i.hrsSoporte * i.tarifaSoporte;
  const infraVercel = i.costoVercel; // infra fija: costo = precio (sin margen)

  const cuotaMensual = amort + interes + sop + infraVercel;

  const consumoDetalle: ConsumoLinea[] = i.servicios
    .filter((s) => s.activo)
    .map((s) => {
      const costo = costoServicio(s);
      const cobro = costo * (1 + i.margenConsumo / 100);
      return {
        id: s.id, nombre: s.nombre, tipo: s.tipo, unidad: s.unidad, volumen: s.volumen,
        precioUnit: s.precioUnit, costoFijo: s.costoFijo, costo, cobro, margenMXN: cobro - costo,
      };
    });
  const totalConsumoCosto = consumoDetalle.reduce((a, s) => a + s.costo, 0);
  const totalConsumoCobro = consumoDetalle.reduce((a, s) => a + s.cobro, 0);

  return {
    valorDev, anticipo, financiado, hayFin, amort, interes, totalIntereses,
    sop, infraVercel, cuotaMensual,
    consumoDetalle, totalConsumoCosto, totalConsumoCobro,
    margenConsumoMXN: totalConsumoCobro - totalConsumoCosto,
    totalMensualCliente: cuotaMensual + totalConsumoCobro,
    totalContrato: anticipo + cuotaMensual * i.meses,
  };
}
