import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  // Resuelve el alias "@/" definido en tsconfig.json.
  resolve: { tsconfigPaths: true },
  test: {
    // Las pruebas de RLS usan la base remota: se corren con `pnpm test:rls`.
    exclude: [...configDefaults.exclude, "tests/rls/**"],
  },
});
