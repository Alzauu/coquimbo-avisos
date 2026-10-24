import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { tituloPagina } from "@/lib/marca";
import { ordenDeCategoria } from "@/lib/reportes/categorias";
import { formatearFecha, NOMBRE_MODERACION } from "@/lib/reportes/presentacion";

import { clienteAdmin } from "../acceso";
import { AvisoAdmin } from "../aviso-admin";
import { ENLACE_PELIGRO } from "../estilos";
import { FormArchivo } from "../formularios";
import { FormularioEdicion } from "./formulario-edicion";

export const metadata: Metadata = {
  title: tituloPagina("Editar reporte"),
  robots: { index: false },
};

export default async function EditarReportePage({
  params,
  searchParams,
}: PageProps<"/admin/reportes/[id]">) {
  const [{ id }, { aviso }] = await Promise.all([params, searchParams]);
  const supabase = await clienteAdmin(`/admin/reportes/${id}`);
  if (!z.uuid().safeParse(id).success) notFound();

  const { data: reporte, error } = await supabase
    .rpc("obtener_reporte_admin", { reporte: id })
    .maybeSingle();
  if (error) console.error("obtener_reporte_admin", error.code);
  if (!reporte) notFound();

  // Las categorías activas y, si ya no lo está, la actual del reporte.
  const { data: categorias } = await supabase
    .from("categorias")
    .select("id, codigo, nombre")
    .eq("tipo", "reporte")
    .or(`activa.eq.true,id.eq.${reporte.categoria_id}`)
    .order("id");
  categorias?.sort(
    (a, b) => ordenDeCategoria(a.codigo) - ordenDeCategoria(b.codigo),
  );

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <div className="flex flex-col gap-2">
        <Link href="/admin/reportes" className="self-start text-sm underline">
          Volver a la lista
        </Link>
        <h1 className="text-2xl font-bold">Editar reporte</h1>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="font-medium">Moderación</dt>
          <dd>{NOMBRE_MODERACION[reporte.moderacion]}</dd>
          <dt className="font-medium">Creado</dt>
          <dd>{formatearFecha(reporte.creado_en)}</dd>
          <dt className="font-medium">Fotos</dt>
          <dd>
            {reporte.fotos === 0
              ? "Sin fotos"
              : reporte.fotos === 1
                ? "1 foto"
                : `${reporte.fotos} fotos`}
          </dd>
        </dl>
        {reporte.moderacion === "aprobado" && (
          <Link
            href={`/reporte/${reporte.id}`}
            className="self-start text-sm underline"
          >
            Ver cómo se muestra al público
          </Link>
        )}
      </div>

      <AvisoAdmin codigo={aviso} />

      <FormularioEdicion
        // Tras guardar se vuelve a montar con los datos y la versión nuevos.
        key={reporte.actualizado_en}
        reporte={{
          id: reporte.id,
          version: reporte.actualizado_en,
          categoria_id: reporte.categoria_id,
          titulo: reporte.titulo,
          descripcion: reporte.descripcion,
          direccion_referencia: reporte.direccion_referencia,
          estado: reporte.estado,
          latitud: reporte.latitud,
          longitud: reporte.longitud,
        }}
        categorias={categorias ?? []}
      />

      <section
        aria-labelledby="titulo-archivar"
        className="flex flex-col items-start gap-2 border-t border-zinc-300 pt-6 dark:border-zinc-700"
      >
        <h2 id="titulo-archivar" className="text-lg font-bold">
          {reporte.moderacion === "archivado" ? "Restaurar" : "Archivar"}
        </h2>
        <p className="text-sm text-zinc-700 dark:text-zinc-300">
          {reporte.moderacion === "archivado"
            ? "Vuelve al estado de moderación que tenía al archivarse; si estaba publicado, vuelve al mapa."
            : "Lo saca del mapa y de la lista habitual, sin borrarlo. Se puede restaurar."}
        </p>
        <FormArchivo
          key={reporte.moderacion}
          reporteId={reporte.id}
          titulo={reporte.titulo}
          archivado={reporte.moderacion === "archivado"}
          volver=""
        />
      </section>

      <section
        aria-labelledby="titulo-eliminar"
        className="flex flex-col items-start gap-2 border-t border-zinc-300 pt-6 dark:border-zinc-700"
      >
        <h2 id="titulo-eliminar" className="text-lg font-bold">
          Eliminar
        </h2>
        <p className="text-sm text-zinc-700 dark:text-zinc-300">
          Borra el reporte, su historial y sus fotos. No se puede deshacer. Si
          solo quieres sacarlo del mapa, archívalo.
        </p>
        <Link
          href={`/admin/reportes/${reporte.id}/eliminar`}
          className={ENLACE_PELIGRO}
        >
          Eliminar este reporte…
        </Link>
      </section>
    </main>
  );
}
