import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Logo } from "@/components/marca/logo";
import { ENLACE, FOCO } from "@/components/ui/estilos";
import { rutaSegura } from "@/lib/auth/redireccion";
import { MARCA, tituloPagina } from "@/lib/marca";
import { createClient } from "@/lib/supabase/server";

import { FormularioIngreso } from "./formulario-ingreso";

export const metadata: Metadata = {
  title: tituloPagina("Ingresar"),
};

export default async function IngresarPage({
  searchParams,
}: PageProps<"/ingresar">) {
  const { siguiente: siguienteParam, error } = await searchParams;
  const siguiente = rutaSegura(siguienteParam);

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims) redirect(siguiente);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 px-4 py-10">
      <Link
        href="/"
        className={`flex items-center gap-2 self-start rounded-(--radio-control) ${FOCO}`}
      >
        <Logo tamano={40} />
        <span className="text-xl font-bold">{MARCA.nombre}</span>
      </Link>

      <FormularioIngreso
        siguiente={siguiente}
        enlaceVencido={error === "enlace"}
      />

      <Link href="/" className={`${ENLACE} self-start text-sm`}>
        Volver al mapa
      </Link>
    </main>
  );
}
