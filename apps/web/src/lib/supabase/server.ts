import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import type { Database } from "./database.types";
import { getSupabaseEnv } from "./env";

// Cliente para Server Components, Server Actions y Route Handlers.
// Crea uno nuevo por petición: nunca lo compartas entre peticiones.
export async function createClient() {
  const { url, anonKey } = getSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Los Server Components no pueden escribir cookies. Se puede
          // ignorar mientras no haya sesión; con el login, el refresco de
          // sesión irá en proxy.ts.
        }
      },
    },
  });
}
