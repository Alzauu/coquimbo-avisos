import Link from "next/link";

import { esAdmin, esModerador } from "@/lib/auth/rol";
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
  // Los enlaces son solo una comodidad: /moderacion y /admin verifican el
  // rol por su cuenta.
  const [modera, administra] = sesion?.claims
    ? await Promise.all([esModerador(supabase), esAdmin(supabase)])
    : [false, false];

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-zinc-300 px-4 py-3 dark:border-zinc-700">
        <div>
          <h1 className="text-lg font-bold">Coquimbo Avisos</h1>
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            Reportes vecinales · Piloto en La Serena
          </p>
        </div>
        <nav aria-label="Principal">
          <ul className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-medium">
            {/* Sin sesión, el proxy lleva a ingresar y luego de vuelta. */}
            <li>
              <Link
                href="/reportar"
                className="inline-block rounded-md bg-zinc-900 px-3 py-2 text-white dark:bg-zinc-100 dark:text-zinc-900"
              >
                Reportar
              </Link>
            </li>
            {sesion?.claims && (
              <li>
                <Link href="/mis-reportes" className="underline">
                  Mis reportes
                </Link>
              </li>
            )}
            {modera && (
              <li>
                <Link href="/moderacion" className="underline">
                  Moderación
                </Link>
              </li>
            )}
            {administra && (
              <li>
                <Link href="/admin/reportes" className="underline">
                  Administración
                </Link>
              </li>
            )}
            <li>
              <Link href="/perfil" className="underline">
                {sesion?.claims ? "Mi perfil" : "Ingresar"}
              </Link>
            </li>
          </ul>
        </nav>
      </header>

      <main className="flex min-h-0 flex-1 flex-col">
        <ExploradorReportes categorias={categorias ?? []} />
      </main>
    </div>
  );
}
