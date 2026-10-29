import { createClient } from "@supabase/supabase-js";

import type { Database } from "./database.types";
import { getSupabaseEnv } from "./env";

// Cliente sin sesión (rol anon), en el servidor, para lo que debe verse
// igual para todos sin importar quién lo pida: por ejemplo, la imagen de
// vista previa al compartir. Con la RLS de anon solo lee lo público, aunque
// la petición traiga la cookie de un moderador.
export function createAnonClient() {
  const { url, anonKey } = getSupabaseEnv();
  return createClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
