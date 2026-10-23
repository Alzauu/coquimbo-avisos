import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import {
  EXPLICACION_MODERACION,
  formatearFecha,
  NOMBRE_ESTADO,
  NOMBRE_MODERACION,
} from "@/lib/reportes/presentacion";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Mis reportes · Coquimbo Avisos",
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
    supabase.from("categorias").select("id, nombre").eq("tipo", "reporte"),
  ]);
  if (error) console.error("mis_reportes", error.code);
  const nombreCategoria = new Map(
    (categorias ?? []).map((categoria) => [categoria.id, categoria.nombre]),
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
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <div className="flex flex-col gap-2">
        <Link href="/" className="self-start text-sm underline">
          Volver al mapa
        </Link>
        <h1 className="text-2xl font-bold">Mis reportes</h1>
      </div>

      {nuevo === "1" && (
        <div
          role="status"
          className="flex flex-col gap-1 rounded-md bg-green-50 p-4 text-green-900 dark:bg-green-950 dark:text-green-100"
        >
          <p className="font-medium">
            Tu reporte fue recibido y será revisado.
          </p>
          {hayFotosFallidas && (
            <p>
              No pudimos subir{" "}
              {fallidas === 1 ? "1 de las fotos" : `${fallidas} de las fotos`};
              el reporte se guardó sin {fallidas === 1 ? "ella" : "ellas"}.
            </p>
          )}
        </div>
      )}

      <Link
        href="/reportar"
        className="self-start rounded-md bg-zinc-900 px-4 py-2 font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
      >
        Reportar un problema
      </Link>

      {error ? (
        <p role="alert" className="text-red-700 dark:text-red-400">
          No pudimos cargar tus reportes. Inténtalo de nuevo más tarde.
        </p>
      ) : !reportes || reportes.length === 0 ? (
        <p>Todavía no has enviado reportes.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {reportes.map((reporte) => (
            <li
              key={reporte.id}
              className="flex flex-col gap-2 rounded-md border border-zinc-300 p-4 dark:border-zinc-700"
            >
              <h2 className="font-bold">{reporte.titulo}</h2>
              <p className="text-sm text-zinc-700 dark:text-zinc-300">
                {nombreCategoria.get(reporte.categoria_id) ?? "Sin categoría"} ·
                Enviado el {formatearFecha(reporte.creado_en)}
              </p>

              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                <dt className="font-medium">Revisión</dt>
                <dd>
                  <span className="font-medium">
                    {NOMBRE_MODERACION[reporte.moderacion]}
                  </span>
                  . {EXPLICACION_MODERACION[reporte.moderacion]}
                </dd>
                {/* El estado del problema solo tiene sentido una vez publicado. */}
                {reporte.moderacion === "aprobado" && (
                  <>
                    <dt className="font-medium">Estado</dt>
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
                            className="aspect-square w-full rounded-md border border-zinc-300 object-cover dark:border-zinc-700"
                          />
                        ) : (
                          <p className="flex aspect-square items-center justify-center rounded-md border border-zinc-300 p-2 text-center text-xs dark:border-zinc-700">
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
