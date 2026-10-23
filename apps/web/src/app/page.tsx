import Link from "next/link";

import { createClient } from "@/lib/supabase/server";

import { ExploradorReportes } from "./_explorador/explorador-reportes";

export default async function Home() {
  const supabase = await createClient();
  const [{ data: sesion }, { data: categorias, error }] = await Promise.all([
    supabase.auth.getClaims(),
    supabase
      .from("categorias")
      .select("id, codigo, nombre")
      .eq("tipo", "reporte")
      .eq("activa", true)
      .order("id"),
  ]);
  // Sin categorías el mapa sigue funcionando, sin colores ni filtro por categoría.
  if (error) console.error("categorias", error.code);

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-zinc-300 px-4 py-3 dark:border-zinc-700">
        <div>
          <h1 className="text-lg font-bold">Coquimbo Avisos</h1>
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            Reportes vecinales · Piloto en La Serena
          </p>
        </div>
        <Link
          href="/perfil"
          className="shrink-0 rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          {sesion?.claims ? "Mi perfil" : "Ingresar"}
        </Link>
      </header>

      <main className="flex min-h-0 flex-1 flex-col">
        <ExploradorReportes categorias={categorias ?? []} />
      </main>
    </div>
  );
}
