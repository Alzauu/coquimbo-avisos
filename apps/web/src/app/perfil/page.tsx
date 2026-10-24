import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { cerrarSesion } from "@/app/auth/acciones";
import {
  BOTON_SECUNDARIO,
  ENLACE,
  PAGINA,
  TARJETA,
  TEXTO_ERROR,
  TITULO_PAGINA,
  TITULO_SECCION,
} from "@/components/ui/estilos";
import { tituloPagina } from "@/lib/marca";
import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

import { FormularioNombre } from "./formulario-nombre";

export const metadata: Metadata = {
  title: tituloPagina("Mi perfil"),
  robots: { index: false },
};

// Solo se muestra un rol con permisos extra: a un vecino no le dice nada.
const NOMBRE_ROL: Partial<
  Record<Database["public"]["Enums"]["rol_usuario"], string>
> = {
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
    <main className={PAGINA}>
      <div className="flex flex-col gap-2">
        <Link href="/" className={`${ENLACE} self-start text-sm`}>
          Volver al mapa
        </Link>
        <h1 className={TITULO_PAGINA}>Mi perfil</h1>
      </div>

      {error || !perfil ? (
        <p role="alert" className={TEXTO_ERROR}>
          No pudimos cargar tu perfil. Inténtalo de nuevo más tarde.
        </p>
      ) : (
        <>
          <dl
            className={`grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 p-4 ${TARJETA}`}
          >
            <dt className="font-semibold">Correo</dt>
            <dd className="break-all">{claims.email}</dd>
            {NOMBRE_ROL[perfil.rol] && (
              <>
                <dt className="font-semibold">Rol</dt>
                <dd>{NOMBRE_ROL[perfil.rol]}</dd>
              </>
            )}
          </dl>

          <FormularioNombre nombreActual={perfil.nombre_visible ?? ""} />
        </>
      )}

      <nav
        aria-labelledby="titulo-tus-reportes"
        className="flex flex-col gap-2"
      >
        <h2 id="titulo-tus-reportes" className={TITULO_SECCION}>
          Tus reportes
        </h2>
        <ul className="flex flex-col gap-2">
          <li>
            <Link href="/reportar" className={ENLACE}>
              Reportar un problema
            </Link>
          </li>
          <li>
            <Link href="/mis-reportes" className={ENLACE}>
              Ver mis reportes
            </Link>
          </li>
        </ul>
      </nav>

      <form action={cerrarSesion}>
        <button type="submit" className={BOTON_SECUNDARIO}>
          Cerrar sesión
        </button>
      </form>
    </main>
  );
}
