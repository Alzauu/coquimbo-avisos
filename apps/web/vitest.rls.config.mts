import { defineConfig } from "vitest/config";

// Pruebas de seguridad contra el proyecto Supabase vinculado, con la clave
// anon de apps/web/.env.local. Requieren supabase/seed.sql cargado.
try {
  process.loadEnvFile(".env.local");
} catch {
  // Sin archivo: las variables pueden venir del entorno (por ejemplo, CI).
}

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    include: ["tests/rls/**/*.test.ts"],
    testTimeout: 15_000,
  },
});
