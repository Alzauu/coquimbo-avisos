import "server-only";

import { createClient } from "@supabase/supabase-js";

import type { Database } from "./database.types";
import { getSupabaseEnv } from "./env";

// ÚNICO módulo que usa la clave service_role, que se salta la RLS.
// - "server-only" hace fallar el build si un componente del navegador lo
//   importa.
// - ESLint (eslint.config.mjs) solo permite importarlo desde el Route
//   Handler de fotos (src/app/fotos/[id]/route.ts).
// - No exporta el cliente: solo la operación que necesita la app.

const BUCKET_FOTOS = "reportes-fotos";

function clienteServiceRole() {
  const { url } = getSupabaseEnv();
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!clave) {
    throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY en apps/web/.env.local.");
  }
  return createClient<Database>(url, clave, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Archivo de una foto, solo si la foto y su reporte siguen siendo
// públicos (ruta_foto_publica lo decide en la base). null si no.
export async function descargarFotoPublica(
  fotoId: number,
): Promise<Blob | null> {
  const supabase = clienteServiceRole();

  const { data: ruta, error } = await supabase.rpc("ruta_foto_publica", {
    foto: fotoId,
  });
  if (error) {
    console.error("ruta_foto_publica", error.code);
    return null;
  }
  if (!ruta) return null;

  const descarga = await supabase.storage.from(BUCKET_FOTOS).download(ruta);
  if (descarga.error) {
    console.error("descargarFotoPublica", descarga.error.message);
    return null;
  }
  return descarga.data;
}
