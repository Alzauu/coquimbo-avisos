import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { FichaCategoria } from "@/components/categorias/ficha-categoria";
import {
  AVISO_EXITO,
  BOTON_PRINCIPAL,
  ENLACE,
  PAGINA,
  TARJETA,
  TEXTO_ERROR,
  TEXTO_SUAVE,
  TITULO_PAGINA,
} from "@/components/ui/estilos";
import { tituloPagina } from "@/lib/marca";
import { categoriaDe } from "@/lib/reportes/categorias";
import {
  EXPLICACION_MODERACION,
  formatearFecha,
  NOMBRE_ESTADO,
  NOMBRE_MODERACION,
} from "@/lib/reportes/presentacion";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: tituloPagina("Mis reportes"),
  robots: { index: false },
};

const BUCKET_FOTOS = "reportes-fotos";
// Las URLs firmadas vencen pronto: las fotos no son públicas.
const DURACION_URL_FIRMADA = 5 * 60;

export default async function MisReportesPage({
  searchParams,
}: PageProps<"/mis-reportes">) {
  const { nuevo, fotos_fallidas } = await searchParams;
  const supabase = await createClient();

  // El proxy ya redirige sin sesión; esta verificación es la que cuenta.
  const { data: sesion } = await supabase.auth.getClaims();
  if (!sesion?.claims) redirect("/ingresar?siguiente=/mis-reportes");

  const [{ data: reportes, error }, { data: categorias }] = await Promise.all([
    supabase.rpc("mis_reportes"),
    supabase
      .from("categorias")
      .select("id, codigo, nombre")
      .eq("tipo", "reporte"),
  ]);
  if (error) console.error("mis_reportes", error.code);
  const categoriasPorId = new Map(
    (categorias ?? []).map((categoria) => [categoria.id, categoria]),
  );

  // Una sola petición para firmar todas las fotos. Con la sesión del
  // usuario: Storage solo le deja firmar las suyas.
  const rutas = (reportes ?? []).flatMap((reporte) => reporte.fotos);
  const { data: firmadas } =
    rutas.length > 0
      ? await supabase.storage
          .from(BUCKET_FOTOS)
          .createSignedUrls(rutas, DURACION_URL_FIRMADA)
      : { data: [] };
  const urlDeFoto = new Map(
    (firmadas ?? []).flatMap((firmada) =>
      firmada.path && firmada.signedUrl
        ? [[firmada.path, firmada.signedUrl] as const]
        : [],
    ),
  );

  const fallidas = Number(fotos_fallidas);
  const hayFotosFallidas = Number.isInteger(fallidas) && fallidas > 0;

  return (
    <main className={PAGINA}>
      <div className="flex flex-col gap-2">
        <Link href="/" className={`${ENLACE} self-start text-sm`}>
          Volver al mapa
        </Link>
        <h1 className={TITULO_PAGINA}>Mis reportes</h1>
      </div>

      {nuevo === "1" && (
        <div role="status" className={`flex flex-col gap-1 ${AVISO_EXITO}`}>
          <p className="font-bold">Tu reporte fue recibido y será revisado.</p>
          {hayFotosFallidas && (
            <p>
              No pudimos subir{" "}
              {fallidas === 1 ? "1 de las fotos" : `${fallidas} de las fotos`};
              el reporte se guardó sin {fallidas === 1 ? "ella" : "ellas"}.
            </p>
          )}
        </div>
      )}

      <Link href="/reportar" className={`${BOTON_PRINCIPAL} self-start`}>
        Reportar un problema
      </Link>

      {error ? (
        <p role="alert" className={TEXTO_ERROR}>
          No pudimos cargar tus reportes. Inténtalo de nuevo más tarde.
        </p>
      ) : !reportes || reportes.length === 0 ? (
        <p className={TEXTO_SUAVE}>Todavía no has enviado reportes.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {reportes.map((reporte) => (
            <li
              key={reporte.id}
              className={`flex flex-col gap-2 p-4 ${TARJETA}`}
            >
              <div className="flex items-start gap-3">
                <FichaCategoria
                  categoria={categoriaDe(
                    categoriasPorId.get(reporte.categoria_id)?.codigo,
                  )}
                  tamano={28}
                />
                <h2 className="font-bold break-words">{reporte.titulo}</h2>
              </div>
              <p className={`text-sm ${TEXTO_SUAVE}`}>
                {categoriasPorId.get(reporte.categoria_id)?.nombre ??
                  "Sin categoría"}{" "}
                · Enviado el {formatearFecha(reporte.creado_en)}
              </p>

              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                <dt className="font-semibold">Revisión</dt>
                <dd>
                  <span className="font-semibold">
                    {NOMBRE_MODERACION[reporte.moderacion]}
                  </span>
                  . {EXPLICACION_MODERACION[reporte.moderacion]}
                </dd>
                {/* Solo el motivo: nunca quién moderó. El tipo generado no
                    marca la columna como opcional, pero viene NULL si no
                    hubo rechazo. */}
                {reporte.moderacion === "rechazado" &&
                  reporte.motivo_rechazo && (
                    <>
                      <dt className="font-semibold">Motivo</dt>
                      <dd className="break-words whitespace-pre-line">
                        {reporte.motivo_rechazo}
                      </dd>
                    </>
                  )}
                {/* El estado del problema solo tiene sentido una vez publicado. */}
                {reporte.moderacion === "aprobado" && (
                  <>
                    <dt className="font-semibold">Estado</dt>
                    <dd>{NOMBRE_ESTADO[reporte.estado]}</dd>
                  </>
                )}
              </dl>

              {reporte.fotos.length > 0 && (
                <ul className="grid grid-cols-3 gap-2">
                  {reporte.fotos.map((ruta, indice) => {
                    const url = urlDeFoto.get(ruta);
                    const descripcion = `Foto ${indice + 1} de «${reporte.titulo}»`;
                    return (
                      <li key={ruta}>
                        {url ? (
                          // URL firmada de corta duración: no conviene que
                          // next/image la optimice ni la guarde en caché.
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={url}
                            alt={descripcion}
                            loading="lazy"
                            className="aspect-square w-full rounded-(--radio-control) border border-(--borde) object-cover"
                          />
                        ) : (
                          <p
                            className={`flex aspect-square items-center justify-center rounded-(--radio-control) border border-(--borde) p-2 text-center text-xs ${TEXTO_SUAVE}`}
                          >
                            {descripcion}: no disponible
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
