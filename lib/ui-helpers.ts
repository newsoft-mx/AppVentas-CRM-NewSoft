/**
 * Helpers para UI: colores de badges, iniciales de avatar, etc.
 */

// Paleta de colores para badges de condición de pago y avatares
const BADGE_PALETTES = [
  { bg: "bg-blue-100", text: "text-blue-700" },
  { bg: "bg-purple-100", text: "text-purple-700" },
  { bg: "bg-teal-100", text: "text-teal-700" },
  { bg: "bg-orange-100", text: "text-orange-700" },
  { bg: "bg-rose-100", text: "text-rose-700" },
  { bg: "bg-indigo-100", text: "text-indigo-700" },
  { bg: "bg-green-100", text: "text-green-700" },
  { bg: "bg-amber-100", text: "text-amber-700" },
];

/**
 * Fondos de avatar. TODOS tienen que dar >= 4.5:1 contra el blanco de las iniciales — medido,
 * no elegido a ojo: teal-600 (3.74), orange-500 (3.00), green-600 (3.30) y amber-500 (3.19)
 * reprobaban, y las iniciales sobre esos cuatro se leían como un manchón. Se bajó cada uno al
 * escalón que sí pasa; los otros cuatro ya pasaban y no se tocan.
 *
 * Si mañana se agrega un color, la regla es la misma y `contraste()` de `lib/contraste` la
 * verifica: el test de esta paleta la corre sobre los ocho.
 */
const AVATAR_PALETTES = [
  { bg: "bg-blue-600", text: "text-white" },    // 5.17
  { bg: "bg-purple-600", text: "text-white" },  // 5.38
  { bg: "bg-teal-700", text: "text-white" },    // 3.74 -> 5.47
  { bg: "bg-orange-700", text: "text-white" },  // 3.00 -> 6.09
  { bg: "bg-rose-600", text: "text-white" },    // 4.70
  { bg: "bg-indigo-600", text: "text-white" },  // 6.29
  { bg: "bg-green-700", text: "text-white" },   // 3.30 -> 5.02
  { bg: "bg-amber-700", text: "text-white" },   // 3.19 -> 5.02
];

/** Hash determinístico de un string → índice de paleta */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0; // Convert to 32bit int
  }
  return Math.abs(hash);
}

/** Clases Tailwind para badge de condición de pago */
export function getCondicionBadgeClasses(nombre: string): string {
  const idx = hashString(nombre) % BADGE_PALETTES.length;
  const { bg, text } = BADGE_PALETTES[idx];
  return `${bg} ${text}`;
}

/** Clases Tailwind para avatar de cliente */
export function getAvatarClasses(nombre: string): string {
  const idx = hashString(nombre) % AVATAR_PALETTES.length;
  const { bg, text } = AVATAR_PALETTES[idx];
  return `${bg} ${text}`;
}

/** Obtiene las iniciales de un nombre de empresa (máx 2 letras) */
export function getInitials(nombre: string): string {
  const words = nombre.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
