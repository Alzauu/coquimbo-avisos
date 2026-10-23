import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";

// ¿La sesión actual es de un moderador o admin? Lo responde la base
// (es_moderador lee perfiles.rol), que es también quien lo exige en cada
// función de moderación. Llamar solo con sesión: anon no puede ejecutarla.
export async function esModerador(
  supabase: SupabaseClient<Database>,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("es_moderador");
  if (error) {
    console.error("es_moderador", error.code);
    return false;
  }
  return data === true;
}

// ¿La sesión actual es de un admin? Igual que esModerador, con es_admin.
export async function esAdmin(
  supabase: SupabaseClient<Database>,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("es_admin");
  if (error) {
    console.error("es_admin", error.code);
    return false;
  }
  return data === true;
}
