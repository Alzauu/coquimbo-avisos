import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import {
  ENLACE,
  PAGINA,
  TEXTO_ERROR,
  TEXTO_SUAVE,
  TITULO_PAGINA,
} from "@/components/ui/estilos";
import { esModerador } from "@/lib/auth/rol";
import { tituloPagina } from "@/lib/marca";
import { formatearFecha } from "@/lib/reportes/presentacion";
import { createClient } from "@/lib/supabase/server";

import { AvisoModeracion } from "./aviso-moderacion";
import { ListaPendientes, type Pendiente } from "./lista-pendientes";

export const metadata: Metadata = {
  title: tituloPagina("Moderación"),
  robots: { index: false },
};

const BUCKET_FOTOS = "reportes-fotos";
// Fotos aún no públicas: URLs firmadas de Supabase, solo para moderación
// (la política de Storage solo deja firmarlas a moderadores y admins).
const DURACION_URL_FIRMADA = 5 * 60;

// reportes_pendientes entrega las fotos como JSON.
const esquemaFotos = z.array(
  z.object({
    id: z.number(),
    ruta: z.string(),
    orden: z.number(),
    oculta: z.boolean(),
  }),
);

export default async function ModeracionPage({
  searchParams,
}: PageProps<"/moderacion">) {
  const { aviso } = await searchParams;
  const supabase = await createClient();

  // El proxy ya redirige sin sesión; esta verificación es la que cuenta.
  const { data: sesion } = await supabase.auth.getClaims();
  if (!sesion?.claims) redirect("/ingresar?siguiente=/moderacion");
  // A quien no modera no se le confirma que la página existe.
  if (!(await esModerador(supabase))) notFound();

  const [{ data: filas, error }, { data: categorias }] = await Promise.all([
    supabase.rpc("reportes_pendientes"),
    supabase.from("categorias").select("id, nombre").eq("tipo", "reporte"),
  ]);
  if (error) console.error("reportes_pendientes", error.code);
  const nombreCategoria = new Map(
    (categorias ?? []).map((categoria) => [categoria.id, categoria.nombre]),
  );

  const reportes = (filas ?? []).map((fila) => {
    const fotos = esquemaFotos.safeParse(fila.fotos);
    if (!fotos.success) console.error("reportes_pendientes: fotos");
    return { ...fila, fotos: fotos.data ?? [] };
  });

  // Una sola petición para firmar las fotos visibles.
  const rutas = reportes.flatMap((reporte) =>
    reporte.fotos.filter((foto) => !foto.oculta).map((foto) => foto.ruta),
  );
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

  // Al navegador solo llega lo necesario: sin rutas de Storage.
  const pendientes: Pendiente[] = reportes.map((reporte) => ({
    id: reporte.id,
    titulo: reporte.titulo,
    categoria: nombreCategoria.get(reporte.categoria_id) ?? "Sin categoría",
    descripcion: reporte.descripcion,
    direccion: reporte.direccion_referencia,
    enviado: formatearFecha(reporte.creado_en),
    latitud: reporte.latitud,
    longitud: reporte.longitud,
    fotos: reporte.fotos.map((foto) => ({
      id: foto.id,
      orden: foto.orden,
      oculta: foto.oculta,
      url: foto.oculta ? null : (urlDeFoto.get(foto.ruta) ?? null),
    })),
  }));

  return (
    <main className={PAGINA}>
      <div className="flex flex-col gap-2">
        <Link href="/" className={`${ENLACE} self-start text-sm`}>
          Volver al mapa
        </Link>
        <h1 className={TITULO_PAGINA}>Moderación</h1>
        <p className={TEXTO_SUAVE}>
          Reportes pendientes de revisión, del más antiguo al más reciente.
          Revisa que las fotos no muestren rostros ni patentes antes de aprobar.
        </p>
      </div>

      <AvisoModeracion codigo={aviso} />

      {error ? (
        <p role="alert" className={TEXTO_ERROR}>
          No pudimos cargar los reportes pendientes. Inténtalo de nuevo más
          tarde.
        </p>
      ) : pendientes.length === 0 ? (
        <p>No hay reportes pendientes. ¡Todo al día!</p>
      ) : (
        <>
          <p className={`text-sm ${TEXTO_SUAVE}`}>
            {pendientes.length === 1
              ? "1 reporte pendiente."
              : `${pendientes.length} reportes pendientes${pendientes.length >= 50 ? " (se muestran los 50 más antiguos)" : ""}.`}
          </p>
          <ListaPendientes pendientes={pendientes} />
        </>
      )}
    </main>
  );
}
