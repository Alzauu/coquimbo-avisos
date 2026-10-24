import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import {
  ENLACE,
  PAGINA,
  TEXTO_ERROR,
  TEXTO_SUAVE,
  TITULO_PAGINA,
} from "@/components/ui/estilos";
import { tituloPagina } from "@/lib/marca";
import { ordenDeCategoria } from "@/lib/reportes/categorias";
import { createClient } from "@/lib/supabase/server";

import { FormularioReporte } from "./formulario-reporte";

export const metadata: Metadata = {
  title: tituloPagina("Reportar un problema"),
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
    <main className={PAGINA}>
      <div className="flex flex-col gap-2">
        <Link href="/" className={`${ENLACE} self-start text-sm`}>
          Volver al mapa
        </Link>
        <h1 className={TITULO_PAGINA}>Reportar un problema</h1>
        <p className={TEXTO_SUAVE}>
          Tu reporte se revisará antes de aparecer en el mapa público. Por ahora
          solo recibimos reportes de La Serena.
        </p>
      </div>

      {categorias && categorias.length > 0 ? (
        <FormularioReporte categorias={categorias} />
      ) : (
        <p role="alert" className={TEXTO_ERROR}>
          No pudimos cargar el formulario. Inténtalo de nuevo más tarde.
        </p>
      )}
    </main>
  );
}
