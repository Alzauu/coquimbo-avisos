"use server";

import {
  ERROR_VOTO_GENERICO,
  esquemaVoto,
  mensajeDeErrorVoto,
  type TotalesVotos,
  type Voto,
} from "@/lib/reportes/votos";
import { createClient } from "@/lib/supabase/server";

// Server Action para votar (Next.js la protege contra CSRF). Usa la sesión
// de quien vota: votar_reporte revisa que el reporte sea público y ajeno,
// y aplica el límite de frecuencia.

export type ResultadoVoto =
  | { estado: "guardado"; voto: Voto | null; totales: TotalesVotos }
  | { estado: "error"; mensaje: string };

export async function votarReporte(
  reporteId: string,
  voto: Voto | null,
): Promise<ResultadoVoto> {
  const datos = esquemaVoto.safeParse({ reporteId, voto });
  if (!datos.success) {
    return { estado: "error", mensaje: ERROR_VOTO_GENERICO };
  }

  const supabase = await createClient();
  const { data: sesion } = await supabase.auth.getClaims();
  if (!sesion?.claims) {
    return {
      estado: "error",
      mensaje: mensajeDeErrorVoto({ hint: "sin_sesion" }),
    };
  }

  const { data, error } = await supabase.rpc("votar_reporte", {
    reporte: datos.data.reporteId,
    // La base acepta NULL (quitar el voto); los tipos generados no marcan
    // como opcionales los argumentos de una función.
    voto: datos.data.voto as number,
  });
  if (error) {
    if (!error.hint) console.error("votar_reporte", error.code);
    return { estado: "error", mensaje: mensajeDeErrorVoto(error) };
  }

  const totales = data?.[0];
  if (!totales) return { estado: "error", mensaje: ERROR_VOTO_GENERICO };
  return { estado: "guardado", voto: datos.data.voto, totales };
}
