import type { NextRequest } from "next/server";

import { leerParametrosFoto, verificarFirmaFoto } from "@/lib/fotos/firma";
import { secretoFotos } from "@/lib/fotos/servidor";
import { descargarFotoPublica } from "@/lib/supabase/service-role";

// Sirve una foto pública con una URL firmada por la app (ver
// lib/fotos/firma.ts). Cualquier falla responde lo mismo, 404, para no
// revelar si la foto existe, venció o fue ocultada.
const CACHE_MAXIMO = 5 * 60; // segundos

function noDisponible() {
  return new Response("Foto no disponible.", {
    status: 404,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/fotos/[id]">,
) {
  const { id } = await ctx.params;
  const { searchParams } = request.nextUrl;
  const parametros = leerParametrosFoto(
    id,
    searchParams.get("exp"),
    searchParams.get("firma"),
  );
  const ahora = Math.floor(Date.now() / 1000);
  if (!parametros || !verificarFirmaFoto(parametros, secretoFotos(), ahora)) {
    return noDisponible();
  }

  // Se consulta la base en cada petición: una foto o un reporte ocultos
  // dejan de servirse al instante, aunque la URL no haya vencido.
  const foto = await descargarFotoPublica(parametros.fotoId);
  if (!foto) return noDisponible();

  const restante = parametros.expira - ahora;
  return new Response(foto, {
    headers: {
      // El bucket solo acepta WebP.
      "Content-Type": "image/webp",
      // private: ningún CDN la guarda; el navegador, hasta 5 minutos.
      "Cache-Control": `private, max-age=${Math.min(restante, CACHE_MAXIMO)}`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
      "Cross-Origin-Resource-Policy": "same-origin",
    },
  });
}
