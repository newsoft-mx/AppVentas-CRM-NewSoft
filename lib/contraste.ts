/**
 * Color de texto legible sobre un fondo arbitrario.
 *
 * Varias pantallas pintan texto sobre un color que NO está en el código: el color de la etapa
 * y el del tipo de cotización los elige un administrador en Configuración. Esas vistas
 * hardcodean `text-white`, así que la legibilidad depende de qué color eligió esa persona:
 * blanco sobre el naranja de marca da 3.0:1 (el mínimo legible es 4.5) y sobre un amarillo
 * claro se vuelve directamente invisible. No es un problema que se pueda arreglar eligiendo
 * mejor una clase de Tailwind: el fondo se conoce recién en runtime.
 *
 * Acá el texto se DERIVA del fondo, así que ningún color que alguien elija mañana puede dejar
 * una cifra ilegible.
 */

/** Luminancia relativa (WCAG 2.1) de un color #RGB o #RRGGBB. */
export function luminancia(hex: string): number {
  const limpio = hex.trim().replace("#", "");
  const full = limpio.length === 3 ? limpio.split("").map((c) => c + c).join("") : limpio;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return 1; // color no interpretable → se asume claro
  const canales = [0, 2, 4].map((i) => {
    const v = parseInt(full.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * canales[0] + 0.7152 * canales[1] + 0.0722 * canales[2];
}

/** Contraste WCAG entre dos colores hex. 1 = idénticos, 21 = negro contra blanco. */
export function contraste(a: string, b: string): number {
  const [claro, oscuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (claro + 0.05) / (oscuro + 0.05);
}

/** Blanco o navy, el que mejor se lea sobre `fondo`. Empate → navy (texto oscuro cansa menos). */
export const TEXTO_CLARO = "#FFFFFF";
export const TEXTO_OSCURO = "#1B2A4A";

export function textoSobre(fondo: string): string {
  return contraste(TEXTO_CLARO, fondo) > contraste(TEXTO_OSCURO, fondo) ? TEXTO_CLARO : TEXTO_OSCURO;
}

/**
 * La escala de gris para texto, y por qué no alcanza con memorizar un número.
 *
 * `text-gray-500` (#6B7280) da 4.83:1 sobre blanco — pasa AA con lo justo. Pero el margen es
 * TAN chico que cualquier fondo que no sea blanco puro lo tumba: medido, ese mismo gris sobre
 * `bg-gray-100` (#F3F4F6) cae a 4.39:1, y sobre `bg-red-50` a 4.42:1. Las dos veces se ve
 * igual de gris y las dos veces reprueba.
 *
 * La regla, entonces, no es "usá gray-500" sino:
 *   · texto secundario sobre BLANCO      → `text-gray-500`
 *   · texto secundario sobre FONDO TEÑIDO → `text-gray-600` (#4B5563, ~6:1 sobre gray-100)
 *
 * `text-gray-400` no se usa para texto en ningún caso: 2.85:1 sobre blanco, ni cerca.
 */
export const GRIS_SOBRE_BLANCO = "text-gray-500";
export const GRIS_SOBRE_TENIDO = "text-gray-600";
