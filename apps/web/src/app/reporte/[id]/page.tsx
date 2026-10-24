import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { z } from "zod";

import { AvisoModeracion } from "@/app/moderacion/aviso-moderacion";
import {
  FormCambiarEstado,
  FormOcultarFoto,
  FormOcultarReporte,
} from "@/app/moderacion/formularios";
import { TARJETA, TEXTO_SUAVE } from "@/components/ui/estilos";
import { esModerador } from "@/lib/auth/rol";
import { urlFotoPublica } from "@/lib/fotos/servidor";
import { tituloPagina } from "@/lib/marca";
import {
  type EstadoPublico,
  ESTADOS_PUBLICOS,
  formatearFecha,
  NOMBRE_ESTADO,
} from "@/lib/reportes/presentacion";
import { createClient } from "@/lib/supabase/server";

// Detalle público de un reporte. La vista y las fotos aplican la RLS de
// quien consulta: solo existe si está publicado (si no, 404) y nunca
// incluye datos del autor.

const esEstadoPublico = (estado: string): estado is EstadoPublico =>
  (ESTADOS_PUBLICOS as readonly string[]).includes(estado);

// Una sola consulta por petición, compartida con generateMetadata.
const cargarReporte = cache(async (id: string) => {
  if (!z.uuid().safeParse(id).success) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("v_reportes_publicos")
    .select(
      "id, categoria_id, titulo, descripcion, direccion_referencia, estado, creado_en, resuelto_en",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) console.error("v_reportes_publicos", error.code);

  // Los tipos generados marcan nullable toda columna de una vista; en la
  // tabla estas son NOT NULL.
  if (
    !data?.id ||
    !data.titulo ||
    !data.creado_en ||
    data.categoria_id === null ||
    !data.estado ||
    !esEstadoPublico(data.estado)
  ) {
    return null;
  }
  return {
    ...data,
    id: data.id,
    titulo: data.titulo,
    creado_en: data.creado_en,
    categoria_id: data.categoria_id,
    estado: data.estado,
  };
});

export async function generateMetadata({
  params,
}: PageProps<"/reporte/[id]">): Promise<Metadata> {
  const reporte = await cargarReporte((await params).id);
  return {
    title: tituloPagina(reporte?.titulo ?? "Reporte"),
    // Contenido de vecinos: por ahora no se indexa en buscadores.
    robots: { index: false },
  };
}

export default async function ReportePage({
  params,
  searchParams,
}: PageProps<"/reporte/[id]">) {
  const [{ id }, { aviso }] = await Promise.all([params, searchParams]);
  const reporte = await cargarReporte(id);
  if (!reporte) notFound();

  const supabase = await createClient();
  const [{ data: categoria }, { data: fotos }, { data: sesion }] =
    await Promise.all([
      supabase
        .from("categorias")
        .select("nombre")
        .eq("id", reporte.categoria_id)
        .maybeSingle(),
      // Solo fotos visibles de reportes publicados (RLS); sin ruta.
      supabase
        .from("reporte_fotos")
        .select("id, orden")
        .eq("reporte_id", reporte.id)
        .order("orden"),
      supabase.auth.getClaims(),
    ]);
  const modera = sesion?.claims ? await esModerador(supabase) : false;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <div className="flex flex-col gap-2">
        <Link href="/" className="self-start text-sm underline">
          Volver al mapa
        </Link>
        <h1 className="text-2xl font-bold break-words">{reporte.titulo}</h1>
        <p className="text-zinc-700 dark:text-zinc-300">
          {categoria?.nombre ?? "Sin categoría"}
        </p>
      </div>

      <AvisoModeracion codigo={aviso} />

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
        <dt className="font-medium">Estado</dt>
        <dd>{NOMBRE_ESTADO[reporte.estado]}</dd>
        <dt className="font-medium">Reportado</dt>
        <dd>{formatearFecha(reporte.creado_en)}</dd>
        {reporte.resuelto_en && (
          <>
            <dt className="font-medium">Resuelto</dt>
            <dd>{formatearFecha(reporte.resuelto_en)}</dd>
          </>
        )}
        {reporte.direccion_referencia && (
          <>
            <dt className="font-medium">Referencia</dt>
            <dd className="break-words">{reporte.direccion_referencia}</dd>
          </>
        )}
      </dl>

      {reporte.descripcion && (
        <p className="break-words whitespace-pre-line">{reporte.descripcion}</p>
      )}

      {fotos && fotos.length > 0 && (
        <section aria-labelledby="titulo-fotos" className="flex flex-col gap-3">
          <h2 id="titulo-fotos" className="text-lg font-bold">
            Fotos
          </h2>
          <ul className="flex flex-col gap-4">
            {fotos.map((foto) => {
              const descripcion = `foto ${foto.orden} de «${reporte.titulo}»`;
              return (
                <li key={foto.id} className="flex flex-col gap-2">
                  {/* URL firmada por la app, de corta duración: no conviene
                      que next/image la optimice ni la guarde en caché. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={urlFotoPublica(foto.id)}
                    alt={`Foto ${foto.orden} del reporte`}
                    loading="lazy"
                    className="w-full rounded-md border border-zinc-300 object-contain dark:border-zinc-700"
                  />
                  {modera && (
                    <FormOcultarFoto
                      reporteId={reporte.id}
                      fotoId={foto.id}
                      origen="detalle"
                      descripcion={descripcion}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {modera && (
        <section
          aria-labelledby="titulo-moderacion"
          className={`flex flex-col gap-4 p-4 ${TARJETA}`}
        >
          <div className="flex flex-col gap-1">
            <h2 id="titulo-moderacion" className="text-lg font-bold">
              Moderación
            </h2>
            <p className={`text-sm ${TEXTO_SUAVE}`}>
              Solo moderadores y administradores ven esta sección. Para ocultar
              una foto usa el botón bajo cada foto.
            </p>
          </div>
          <FormCambiarEstado
            reporteId={reporte.id}
            estadoActual={reporte.estado}
          />
          <FormOcultarReporte reporteId={reporte.id} />
        </section>
      )}
    </main>
  );
}
