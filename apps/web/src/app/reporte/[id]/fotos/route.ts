import { z } from "zod";

import type { FotosReporte } from "@/lib/fotos/respuesta";
import { urlFotoPublica } from "@/lib/fotos/servidor";
import { createClient } from "@/lib/supabase/server";

// URLs firmadas de las fotos de un reporte publicado, para la tarjeta del
// mapa. Se piden solo al abrir la tarjeta. Las URLs vencen en 10 minutos:
// no se guardan en caché.
const SIN_CACHE = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};

function noEncontrado() {
  return Response.json(
    { error: "Reporte no disponible." },
    { status: 404, headers: SIN_CACHE },
  );
}

export async function GET(
  _request: Request,
  ctx: RouteContext<"/reporte/[id]/fotos">,
) {
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return noEncontrado();

  const supabase = await createClient();
  // Solo reportes publicados (RLS, igual para todos los roles). Distingue
  // "no publicado" (404) de "publicado sin fotos" (lista vacía).
  const { data: reporte, error: errorReporte } = await supabase
    .from("v_reportes_publicos")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (errorReporte) console.error("v_reportes_publicos", errorReporte.code);
  if (!reporte) return noEncontrado();

  // Solo fotos visibles (RLS); sin ruta.
  const { data: filas, error } = await supabase
    .from("reporte_fotos")
    .select("id, orden")
    .eq("reporte_id", id)
    .order("orden");
  if (error) {
    console.error("reporte_fotos", error.code);
    return Response.json(
      { error: "No se pudieron cargar las fotos." },
      { status: 500, headers: SIN_CACHE },
    );
  }

  const cuerpo: FotosReporte = {
    fotos: filas.map((foto) => ({
      id: foto.id,
      orden: foto.orden,
      mediana: urlFotoPublica(foto.id, "mediana"),
      completa: urlFotoPublica(foto.id),
    })),
  };
  return Response.json(cuerpo, { headers: SIN_CACHE });
}
