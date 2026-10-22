// Solo claves públicas: este módulo también se usa en el navegador.
// Next.js reemplaza process.env.NEXT_PUBLIC_* en el build, por eso se leen
// de forma literal y no con process.env[nombre].
export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
        "Copia .env.example a apps/web/.env.local y completa los valores.",
    );
  }

  return { url, anonKey };
}
