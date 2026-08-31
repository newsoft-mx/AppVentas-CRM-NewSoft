import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    // lib/ también escribe clases: ESTATUS_COLORS (utils) y los colores de avatar y de
    // condición comercial (ui-helpers). Sin este glob, Tailwind no las ve y no las genera:
    // la pastilla de "Cotizado" salía como texto suelto —única de la columna sin fondo— y
    // los avatares de cliente quedaban transparentes. Verificado en el navegador: `bg-blue-100`
    // y `bg-teal-600` no existían en el CSS compilado; `bg-green-100` sí, porque además la
    // usa un componente. Agregar el glob es aditivo: genera lo que falta, no cambia lo que hay.
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Paleta principal de Newsoft Sales
        navy: {
          DEFAULT: "#1B2A4A",
          50: "#EEF1F7",
          100: "#D4DCF0",
          200: "#A9B9E1",
          300: "#7E96D2",
          400: "#5373C3",
          500: "#3355AA",
          600: "#2A4489",
          // 700 era un duplicado exacto del DEFAULT (#1B2A4A). Como el fondo del sidebar y
          // los botones primarios SON navy, los 11 `hover:bg-navy-700` del repo pintaban el
          // mismo color encima: el hover existía y no se veía en ninguna parte — menú,
          // botones primarios y el kit del cotizador. Ahora es un escalón real entre el 600
          // y el 800, más claro que el DEFAULT. Regla: sobre superficie navy el hover ACLARA.
          700: "#22355F",
          800: "#131F38",
          900: "#0B1422",
        },
        orange: {
          DEFAULT: "#E8751A",
          50: "#FEF3E8",
          100: "#FDE0C4",
          200: "#FBC189",
          300: "#F9A24E",
          400: "#F08325",
          500: "#E8751A", // accent
          600: "#C4611A",
          700: "#9A4D18",
          800: "#713914",
          900: "#482410",
        },
        surface: {
          DEFAULT: "#F5F7FA",
          card: "#FFFFFF",
          border: "#D0D5DD",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
