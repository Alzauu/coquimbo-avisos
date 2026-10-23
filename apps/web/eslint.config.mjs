import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // La clave service_role se salta la RLS: solo el Route Handler de fotos
  // puede importar el módulo que la usa, y nadie más la lee del entorno.
  // El propio módulo importa "server-only", así que además el build falla
  // si llega a un componente del navegador.
  {
    files: ["**/*.{ts,tsx,mts,js,mjs}"],
    ignores: ["src/app/fotos/[[]id]/route.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              // Con alias (@/lib/supabase/...) o relativo (./, ../).
              regex: "(^|/)service-role(\\.ts)?$",
              message:
                "Solo src/app/fotos/[id]/route.ts puede usar la clave service_role.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/lib/supabase/service-role.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "MemberExpression[object.object.name='process'][object.property.name='env'][property.name='SUPABASE_SERVICE_ROLE_KEY']",
          message:
            "La clave service_role solo se lee en src/lib/supabase/service-role.ts.",
        },
      ],
    },
  },
  // Debe ir al final: desactiva reglas de estilo que chocan con Prettier.
  prettier,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Worker de MapLibre copiado desde node_modules.
    "public/vendor/**",
  ]),
]);

export default eslintConfig;
