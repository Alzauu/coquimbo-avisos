"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

// Server Action (Next.js la protege contra CSRF). Cierra la sesión solo
// en este dispositivo.
export async function cerrarSesion() {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/");
}
