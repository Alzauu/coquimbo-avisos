import { defineConfig } from "vitest/config";

export default defineConfig({
  // Resuelve el alias "@/" definido en tsconfig.json.
  resolve: { tsconfigPaths: true },
});
