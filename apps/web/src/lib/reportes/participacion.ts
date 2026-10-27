import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";

import type { Participacion } from "./votos";

// Voto propio y autoría de quien tiene sesión. Sirve con el cliente del
// servidor (detalle) y con el del navegador (tarjeta del mapa). Devuelve
// null si alguna consulta falla, para que cada pantalla decida qué hacer.
export async function consultarParticipacion(
  supabase: SupabaseClient<Database>,
  reporteId: string,
): Promise<Participacion | null> {
  const [autoria, voto] = await Promise.all([
    supabase.rpc("es_mi_reporte", { reporte: reporteId }),
    // La RLS solo deja leer el voto propio.
    supabase
      .from("reporte_votos")
      .select("valor")
      .eq("reporte_id", reporteId)
      .maybeSingle(),
  ]);
  if (autoria.error) console.error("es_mi_reporte", autoria.error.code);
  if (voto.error) console.error("reporte_votos", voto.error.code);
  if (autoria.error || voto.error) return null;

  if (autoria.data === true) return { tipo: "autor" };
  const valor = voto.data?.valor;
  return { tipo: "votante", voto: valor === 1 || valor === -1 ? valor : null };
}
