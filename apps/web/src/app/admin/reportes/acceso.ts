import "server-only";

import { notFound, redirect } from "next/navigation";

import { esAdmin } from "@/lib/auth/rol";
import { createClient } from "@/lib/supabase/server";

// Cliente de Supabase para una página de administración. Sin sesión lleva
// a ingresar (y de vuelta a `ruta`); a quien no es admin no se le
// confirma que la página existe (404). El proxy también exige sesión,
// pero esta verificación es la que cuenta, y cada función de la base
// vuelve a exigir el rol.
export async function clienteAdmin(ruta: string) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) {
    redirect(`/ingresar?siguiente=${encodeURIComponent(ruta)}`);
  }
  if (!(await esAdmin(supabase))) notFound();
  return supabase;
}
