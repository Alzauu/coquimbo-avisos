import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { cerrarSesion } from "@/app/auth/acciones";
import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

import { FormularioNombre } from "./formulario-nombre";

export const metadata: Metadata = {
  title: "Mi perfil · Coquimbo Avisos",
  robots: { index: false },
};

const NOMBRE_ROL: Record<Database["public"]["Enums"]["rol_usuario"], string> = {
  ciudadano: "Vecino/a",
  moderador: "Moderador/a",
  admin: "Administrador/a",
};

export default async function PerfilPage() {
  const supabase = await createClient();

  // El proxy ya redirige sin sesión; esta verificación es la que cuenta.
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) redirect("/ingresar?siguiente=/perfil");

  const { data: perfil, error } = await supabase
    .from("perfiles")
    .select("nombre_visible, rol")
    .eq("id", claims.sub)
    .single();

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 px-4 py-12">
      <h1 className="text-2xl font-bold">Mi perfil</h1>

      {error || !perfil ? (
        <p role="alert" className="text-red-700 dark:text-red-400">
          No pudimos cargar tu perfil. Inténtalo de nuevo más tarde.
        </p>
      ) : (
        <>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
            <dt className="font-medium">Correo</dt>
            <dd className="break-all">{claims.email}</dd>
            <dt className="font-medium">Rol</dt>
            <dd>{NOMBRE_ROL[perfil.rol]}</dd>
          </dl>

          <FormularioNombre nombreActual={perfil.nombre_visible ?? ""} />
        </>
      )}

      <form action={cerrarSesion}>
        <button
          type="submit"
          className="rounded-md border border-zinc-400 px-4 py-2 font-medium dark:border-zinc-600"
        >
          Cerrar sesión
        </button>
      </form>
    </main>
  );
}
