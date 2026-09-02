/**
 * La regla de "qué es un sitio web válido" y cómo se guarda, en un solo lugar.
 *
 * Estaba solo del lado del server (`lib/validations/clientes.ts`), y el formulario tenía su
 * propia idea —un `type="url"` del navegador— que era MÁS ESTRICTA: rechazaba `empresa.com`,
 * que es exactamente lo que sugiere su propio placeholder, y que el server acepta y normaliza
 * a `https://empresa.com`. El campo rechazaba lo que el sistema soporta.
 *
 * Deliberadamente laxa: pedir el dominio con protocolo no ayuda a nadie a capturar un lead más
 * rápido, y el dato se usa para abrir una página, no para nada crítico.
 */

/** Lo que se guarda: sin protocolo se asume https. Vacío → null (el campo es opcional). */
export function normalizarWebsite(valor: string | null | undefined): string | null {
  const limpio = valor?.trim();
  if (!limpio) return null;
  return /^https?:\/\//i.test(limpio) ? limpio : `https://${limpio}`;
}

/** ¿El valor YA NORMALIZADO es aceptable? Un dominio con punto alcanza. */
export function websiteNormalizadoValido(valor: string | null): boolean {
  return !valor || /^https?:\/\/[^\s.]+\.[^\s]+$/i.test(valor);
}

/**
 * El chequeo que hace el formulario mientras el usuario escribe: normaliza y valida en un paso.
 * Devuelve el mensaje de error, o `null` si está bien.
 */
export function errorDeWebsite(valor: string | null | undefined): string | null {
  return websiteNormalizadoValido(normalizarWebsite(valor)) ? null : "Website inválido";
}
