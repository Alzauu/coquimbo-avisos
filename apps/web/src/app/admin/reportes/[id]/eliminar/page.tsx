import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { tituloPagina } from "@/lib/marca";
import {
  formatearFecha,
  NOMBRE_ESTADO,
  NOMBRE_MODERACION,
} from "@/lib/reportes/presentacion";

import { clienteAdmin } from "../../acceso";
import { FormularioEliminacion } from "./formulario-eliminacion";

export const metadata: Metadata = {
  title: tituloPagina("Eliminar reporte"),
  robots: { index: false },
};

// Página aparte (no un modal): funciona sin JavaScript y obliga a leer
// qué se va a borrar antes de confirmar.
export default async function EliminarReportePage({
  params,
}: PageProps<"/admin/reportes/[id]/eliminar">) {
  const { id } = await params;
  const supabase = await clienteAdmin(`/admin/reportes/${id}/eliminar`);
  if (!z.uuid().safeParse(id).success) notFound();

  const { data: reporte, error } = await supabase
    .rpc("obtener_reporte_admin", { reporte: id })
    .maybeSingle();
  if (error) console.error("obtener_reporte_admin", error.code);
  if (!reporte) notFound();

  const { data: categoria } = await supabase
    .from("categorias")
    .select("nombre")
    .eq("id", reporte.categoria_id)
    .maybeSingle();

  const edicion = `/admin/reportes/${reporte.id}`;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <div className="flex flex-col gap-2">
        <Link href={edicion} className="self-start text-sm underline">
          Volver al reporte
        </Link>
        <h1 className="text-2xl font-bold">Eliminar reporte</h1>
      </div>

      <section
        aria-labelledby="titulo-resumen"
        className="flex flex-col gap-2 rounded-md border border-zinc-300 p-4 dark:border-zinc-700"
      >
        <h2 id="titulo-resumen" className="font-bold break-words">
          {reporte.titulo}
        </h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="font-medium">Categoría</dt>
          <dd>{categoria?.nombre ?? "Sin categoría"}</dd>
          <dt className="font-medium">Moderación</dt>
          <dd>{NOMBRE_MODERACION[reporte.moderacion]}</dd>
          <dt className="font-medium">Estado</dt>
          <dd>{NOMBRE_ESTADO[reporte.estado]}</dd>
          <dt className="font-medium">Creado</dt>
          <dd>{formatearFecha(reporte.creado_en)}</dd>
          <dt className="font-medium">Fotos</dt>
          <dd>{reporte.fotos}</dd>
        </dl>
      </section>

      <div className="flex flex-col gap-2 rounded-md bg-amber-50 p-4 text-amber-950 dark:bg-amber-950 dark:text-amber-50">
        <p className="font-medium">Esto no se puede deshacer.</p>
        <p>
          Se borran el reporte, su historial, sus votos y comentarios, y sus
          fotos. Solo queda un registro con la fecha, quién lo eliminó y el
          motivo, sin el contenido del reporte.
        </p>
        <p>
          Si solo quieres sacarlo del mapa público, mejor{" "}
          <Link href="/admin/reportes" className="underline">
            archívalo desde la lista
          </Link>
          : se puede restaurar.
        </p>
      </div>

      <FormularioEliminacion reporteId={reporte.id} volver={edicion} />
    </main>
  );
}
