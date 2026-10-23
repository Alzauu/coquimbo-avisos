import { defineConfig } from "vitest/config";

// Pruebas de seguridad contra el proyecto Supabase vinculado. Requieren
// supabase/seed.sql cargado.
// - .env.local: URL y clave anon (como la app).
// - .env.test.local: SUPABASE_SERVICE_ROLE_KEY, solo para crear y borrar
//   usuarios de prueba. Nunca la uses en la app ni la imprimas.
for (const archivo of [".env.local", ".env.test.local"]) {
  try {
    process.loadEnvFile(archivo);
  } catch {
    // Sin archivo: las variables pueden venir del entorno (por ejemplo, CI).
  }
}

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    include: ["tests/rls/**/*.test.ts"],
    testTimeout: 15_000,
    hookTimeout: 60_000,
  },
});
