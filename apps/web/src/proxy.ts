import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import type { Database } from "@/lib/supabase/database.types";
import { getSupabaseEnv } from "@/lib/supabase/env";

// Rutas que exigen sesión. Las páginas también lo verifican por su cuenta:
// el proxy no debe ser la única barrera.
const RUTAS_PROTEGIDAS = ["/perfil", "/reportar", "/mis-reportes"];

function esRutaProtegida(ruta: string) {
  return RUTAS_PROTEGIDAS.some(
    (protegida) => ruta === protegida || ruta.startsWith(`${protegida}/`),
  );
}

// Refresca la sesión de Supabase en cada petición y protege rutas.
export async function proxy(request: NextRequest) {
  const { url, anonKey } = getSupabaseEnv();
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        // Evita que un CDN guarde una respuesta con cookies de sesión.
        for (const [nombre, valor] of Object.entries(headers)) {
          response.headers.set(nombre, valor);
        }
      },
    },
  });

  // getClaims valida el token (y lo refresca si venció). No agregues
  // código entre createServerClient y esta llamada.
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims && esRutaProtegida(request.nextUrl.pathname)) {
    const ingreso = request.nextUrl.clone();
    ingreso.pathname = "/ingresar";
    ingreso.search = "";
    ingreso.searchParams.set(
      "siguiente",
      request.nextUrl.pathname + request.nextUrl.search,
    );

    const redireccion = NextResponse.redirect(ingreso);
    // Conserva las cookies que Supabase haya limpiado o actualizado.
    for (const cookie of response.cookies.getAll()) {
      redireccion.cookies.set(cookie);
    }
    return redireccion;
  }

  return response;
}

export const config = {
  matcher: [
    // Todo menos archivos estáticos e imágenes.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
