import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { rutaSegura } from "@/lib/auth/redireccion";
import { createClient } from "@/lib/supabase/server";

import { FormularioIngreso } from "./formulario-ingreso";

export const metadata: Metadata = {
  title: "Ingresar · Coquimbo Avisos",
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
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-12">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">Ingresar</h1>
        <p className="text-zinc-700 dark:text-zinc-300">
          Te enviaremos un enlace a tu correo. No necesitas contraseña.
        </p>
      </div>

      {error === "enlace" && (
        <p role="alert" className="text-red-700 dark:text-red-400">
          El enlace no es válido o ya venció. Pide uno nuevo.
        </p>
      )}

      <FormularioIngreso siguiente={siguiente} />

      <Link href="/" className="text-sm underline">
        Volver al inicio
      </Link>
    </main>
  );
}
