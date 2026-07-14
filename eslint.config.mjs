import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = [
  {
    linterOptions: {
      reportUnusedDisableDirectives: "off",
    },
  },
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "coverage/**",
      "public/**",
    ],
  },
  ...nextVitals,
  {
    rules: {
      "@next/next/no-page-custom-font": "off",
      // Reglas nuevas de React Compiler (Next 16) que marcan como ERROR patrones que
      // este código usa a propósito y que NO son bugs, así que se bajan a warning para
      // no romper `lint` sin perder la señal:
      //  - set-state-in-effect: setState en un effect de montaje (hidratación segura —
      //    leer window/Date.now/localStorage solo en cliente). Usado en ~8 componentes.
      //  - refs: acceso a ref.current dentro de event handlers (no en render). Falso
      //    positivo (p.ej. la toolbar de MarkdownEditor).
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
    },
  },
];

export default eslintConfig;
