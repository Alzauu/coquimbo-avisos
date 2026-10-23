import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ordenDeCategoria } from "@/lib/reportes/categorias";
import { createClient } from "@/lib/supabase/server";

import { FormularioReporte } from "./formulario-reporte";

export const metadata: Metadata = {
  title: "Reportar un problema · Coquimbo Avisos",
  robots: { index: false },
};

export default async function ReportarPage() {
  const supabase = await createClient();

  // El proxy ya redirige sin sesión; esta verificación es la que cuenta.
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/ingresar?siguiente=/reportar");

  const { data: categorias, error } = await supabase
    .from("categorias")
    .select("id, codigo, nombre")
    .eq("tipo", "reporte")
    .eq("activa", true)
    .order("id");
  if (error) console.error("categorias", error.code);
  // En el orden del catálogo (Calles primero, Otros al final).
  categorias?.sort(
    (a, b) => ordenDeCategoria(a.codigo) - ordenDeCategoria(b.codigo),
  );

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <div className="flex flex-col gap-2">
        <Link href="/" className="self-start text-sm underline">
          Volver al mapa
        </Link>
        <h1 className="text-2xl font-bold">Reportar un problema</h1>
        <p className="text-zinc-700 dark:text-zinc-300">
          Tu reporte se revisará antes de aparecer en el mapa público. Por ahora
          solo recibimos reportes de La Serena.
        </p>
      </div>

      {categorias && categorias.length > 0 ? (
        <FormularioReporte categorias={categorias} />
      ) : (
        <p role="alert" className="text-red-700 dark:text-red-400">
          No pudimos cargar el formulario. Inténtalo de nuevo más tarde.
        </p>
      )}
    </main>
  );
}
