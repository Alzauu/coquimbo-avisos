import type { Metadata } from "next";

import { tituloPagina } from "@/lib/marca";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: tituloPagina("Prueba de base de datos"),
  robots: { index: false },
};

// Página de prueba: confirma que la app lee la base con la clave pública.
export default async function PruebaDbPage() {
  const supabase = await createClient();
  const { data: comunas, error } = await supabase
    .from("comunas")
    .select("id, nombre, activa")
    .order("nombre");

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-12">
      <h1 className="mb-6 text-2xl font-bold">Comunas en la base</h1>

      {error ? (
        <p role="alert" className="text-red-700 dark:text-red-400">
          Error al leer las comunas: {error.message}
        </p>
      ) : comunas.length === 0 ? (
        <p>No hay comunas. ¿Se aplicaron las migraciones y la política RLS?</p>
      ) : (
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {comunas.map((comuna) => (
            <li key={comuna.id} className="flex justify-between py-2">
              <span>{comuna.nombre}</span>
              <span className="text-sm text-zinc-600 dark:text-zinc-400">
                {comuna.activa ? "Activa" : "Desactivada"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
