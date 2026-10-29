import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { z } from "zod";

import { AvisoModeracion } from "@/app/moderacion/aviso-moderacion";
import {
  FormCambiarEstado,
  FormOcultarFoto,
  FormOcultarReporte,
} from "@/app/moderacion/formularios";
import { FichaCategoria } from "@/components/categorias/ficha-categoria";
import { DescripcionPlegable } from "@/components/reportes/detalle/descripcion-plegable";
import {
  claseTitulo,
  Dato,
  EnlaceFoto,
  ETIQUETA,
  EtiquetaEstado,
  type FotoDetalle,
  FotosGrilla,
  LineaAvance,
  textoFoto,
  VerEnElMapa,
  VolverAlMapa,
} from "@/components/reportes/detalle/piezas";
import { VotosReporte } from "@/components/reportes/votos-reporte";
import { TARJETA, TEXTO_SUAVE } from "@/components/ui/estilos";
import { esModerador } from "@/lib/auth/rol";
import { urlFotoPublica } from "@/lib/fotos/servidor";
import { tituloPagina } from "@/lib/marca";
import { categoriaDe } from "@/lib/reportes/categorias";
import { consultarParticipacion } from "@/lib/reportes/participacion";
import {
  type EstadoPublico,
  ESTADOS_PUBLICOS,
  formatearFecha,
} from "@/lib/reportes/presentacion";
import type { Participacion } from "@/lib/reportes/votos";
import { createClient } from "@/lib/supabase/server";

// Detalle público de un reporte. La vista y las fotos aplican la RLS de
// quien consulta: solo existe si está publicado (si no, 404) y nunca
// incluye datos del autor.
// Diseño «Ficha»: la ficha de categoría arriba, el estado con su línea de
// avance y los datos en tarjetas. En el DOM va primero la columna de
// estado y datos (orden de lectura en el teléfono); desde md pasa a la
// derecha y la descripción, las fotos y la moderación quedan a la
// izquierda.

const esEstadoPublico = (estado: string): estado is EstadoPublico =>
  (ESTADOS_PUBLICOS as readonly string[]).includes(estado);

// Una sola consulta por petición, compartida con generateMetadata.
const cargarReporte = cache(async (id: string) => {
  if (!z.uuid().safeParse(id).success) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("v_reportes_publicos")
    .select(
      "id, categoria_id, titulo, descripcion, direccion_referencia, estado, creado_en, resuelto_en, me_afecta, no_me_afecta",
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
    totales: {
      me_afecta: data.me_afecta ?? 0,
      no_me_afecta: data.no_me_afecta ?? 0,
    },
  };
});

// ¿Puede votar quien mira? Si falla la consulta, se muestran los botones:
// la base rechaza igual el voto del autor.
async function cargarParticipacion(
  supabase: Awaited<ReturnType<typeof createClient>>,
  reporteId: string,
): Promise<Participacion> {
  return (
    (await consultarParticipacion(supabase, reporteId)) ?? {
      tipo: "votante",
      voto: null,
    }
  );
}

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
        .select("nombre, codigo")
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
  const [modera, participacion] = sesion?.claims
    ? await Promise.all([
        esModerador(supabase),
        cargarParticipacion(supabase, reporte.id),
      ])
    : [false, { tipo: "sin_sesion" } as const];

  // URLs firmadas: la mediana para mostrar, la completa al abrir.
  const visibles: FotoDetalle[] = (fotos ?? []).map((foto) => ({
    id: foto.id,
    mediana: urlFotoPublica(foto.id, "mediana"),
    completa: urlFotoPublica(foto.id),
  }));

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 md:px-8 md:py-10">
      <VolverAlMapa />

      <header className="flex flex-col gap-4">
        <p className="flex items-center gap-3">
          <FichaCategoria
            categoria={categoriaDe(categoria?.codigo)}
            tamano={44}
          />
          <span className="flex flex-col">
            <span className={ETIQUETA}>Categoría</span>
            <span className="text-lg font-semibold">
              {categoria?.nombre ?? "Sin categoría"}
            </span>
          </span>
        </p>
        <h1 className={claseTitulo(reporte.titulo)}>{reporte.titulo}</h1>
      </header>

      <AvisoModeracion codigo={aviso} />

      <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_22rem] md:items-start md:gap-12">
        <aside className="flex flex-col gap-4 md:sticky md:top-6 md:col-start-2 md:row-start-1">
          <section
            aria-labelledby="titulo-estado"
            className={`flex flex-col gap-4 p-4 ${TARJETA}`}
          >
            <div className="flex items-center justify-between gap-3">
              <h2 id="titulo-estado" className={ETIQUETA}>
                Estado del reporte
              </h2>
              <EtiquetaEstado estado={reporte.estado} />
            </div>
            <LineaAvance estado={reporte.estado} />
          </section>

          <dl className="grid grid-cols-2 gap-2">
            <Dato
              etiqueta="Reportado"
              valor={formatearFecha(reporte.creado_en)}
            />
            <Dato
              etiqueta="Resuelto"
              valor={
                reporte.resuelto_en
                  ? formatearFecha(reporte.resuelto_en)
                  : "Todavía no"
              }
            />
          </dl>

          <section
            aria-labelledby="titulo-ubicacion"
            className={`flex flex-col gap-3 p-4 ${TARJETA}`}
          >
            <h2 id="titulo-ubicacion" className={ETIQUETA}>
              Ubicación
            </h2>
            <p
              className={
                reporte.direccion_referencia ? "break-words" : TEXTO_SUAVE
              }
            >
              {reporte.direccion_referencia ?? "Sin referencia escrita."}
            </p>
            <VerEnElMapa reporteId={reporte.id} />
          </section>

          <div className={`p-4 ${TARJETA}`}>
            <VotosReporte
              reporteId={reporte.id}
              totales={reporte.totales}
              participacion={participacion}
            />
          </div>
        </aside>

        <div className="flex flex-col gap-8 md:col-start-1 md:row-start-1">
          {reporte.descripcion && (
            <section
              aria-labelledby="titulo-descripcion"
              className="flex flex-col gap-2"
            >
              <h2 id="titulo-descripcion" className={ETIQUETA}>
                Descripción
              </h2>
              <DescripcionPlegable texto={reporte.descripcion} />
            </section>
          )}

          {visibles.length > 0 && (
            <section
              aria-labelledby="titulo-fotos"
              className="flex flex-col gap-2"
            >
              <h2 id="titulo-fotos" className={ETIQUETA}>
                Fotos ({visibles.length})
              </h2>
              {modera ? (
                // Moderación: cada foto en grande, con su botón debajo.
                <ul className="flex flex-col gap-4">
                  {visibles.map((foto, indice) => (
                    <li key={foto.id} className="flex flex-col gap-2">
                      <EnlaceFoto
                        foto={foto}
                        alt={textoFoto(
                          indice + 1,
                          visibles.length,
                          reporte.titulo,
                        )}
                        imagen="w-full object-contain"
                      />
                      <FormOcultarFoto
                        reporteId={reporte.id}
                        fotoId={foto.id}
                        origen="detalle"
                        descripcion={`foto ${indice + 1} de «${reporte.titulo}»`}
                      />
                    </li>
                  ))}
                </ul>
              ) : (
                <FotosGrilla fotos={visibles} titulo={reporte.titulo} />
              )}
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
                  Solo moderadores y administradores ven esta sección. Para
                  ocultar una foto usa el botón bajo cada foto.
                </p>
              </div>
              <FormCambiarEstado
                reporteId={reporte.id}
                estadoActual={reporte.estado}
              />
              <FormOcultarReporte reporteId={reporte.id} />
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
