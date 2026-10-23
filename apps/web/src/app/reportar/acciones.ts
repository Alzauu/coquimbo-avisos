"use server";

import { randomUUID } from "node:crypto";

import type { PostgrestError } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

import {
  COMUNA_LA_SERENA,
  erroresDeValidacion,
  type ErroresReporte,
  esquemaFotos,
  esquemaReporte,
} from "@/lib/reportes/esquemas";
import { FotoInvalida, procesarFoto } from "@/lib/reportes/fotos";
import { createClient } from "@/lib/supabase/server";

const BUCKET_FOTOS = "reportes-fotos";

export type EstadoFormulario =
  | { estado: "inicial" }
  | { estado: "error"; mensaje: string; errores: ErroresReporte };

const fallo = (
  mensaje: string,
  errores: ErroresReporte = {},
): EstadoFormulario => ({ estado: "error", mensaje, errores });

// Server Action (Next.js la protege contra CSRF). Usa la sesión del
// usuario: la RLS, los permisos por columna y el trigger de la base
// aplican igual que si llamara a la API directamente.
export async function crearReporte(
  _previo: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const supabase = await createClient();
  const { data: sesion } = await supabase.auth.getClaims();
  const usuarioId = sesion?.claims?.sub;
  if (!usuarioId) {
    return fallo(
      "Tu sesión terminó. Vuelve a ingresar para enviar el reporte.",
    );
  }

  // 1. Validar
  const campos = esquemaReporte.safeParse({
    categoria_id: formData.get("categoria_id"),
    titulo: formData.get("titulo"),
    descripcion: formData.get("descripcion"),
    direccion_referencia: formData.get("direccion_referencia"),
    latitud: formData.get("latitud"),
    longitud: formData.get("longitud"),
  });
  const fotos = esquemaFotos.safeParse(
    formData
      .getAll("fotos")
      .filter((foto) => !(foto instanceof File && foto.size === 0)),
  );
  if (!campos.success || !fotos.success) {
    return fallo(
      "Revisa los campos marcados.",
      erroresDeValidacion(campos.error, fotos.error),
    );
  }
  const reporte = campos.data;

  // La llave foránea aceptaría también una categoría de obras.
  const { data: categoria } = await supabase
    .from("categorias")
    .select("id")
    .eq("id", reporte.categoria_id)
    .eq("tipo", "reporte")
    .eq("activa", true)
    .maybeSingle();
  if (!categoria) {
    return fallo("Revisa los campos marcados.", {
      categoria_id: "Elige una categoría de la lista.",
    });
  }

  // 2. Procesar las fotos antes de guardar nada
  let procesadas: Buffer[];
  try {
    procesadas = await Promise.all(
      fotos.data.map(async (foto) =>
        procesarFoto(Buffer.from(await foto.arrayBuffer())),
      ),
    );
  } catch (error) {
    if (!(error instanceof FotoInvalida)) throw error;
    return fallo("Revisa los campos marcados.", {
      fotos:
        "Una de las fotos no es una imagen válida o no se pudo procesar. Quítala o prueba con otra.",
    });
  }

  // 3. Guardar el reporte. El id se genera aquí: la RLS no deja leer la
  //    fila pendiente, así que no se puede usar RETURNING.
  const reporteId = randomUUID();
  const { error } = await supabase.from("reportes").insert({
    id: reporteId,
    categoria_id: reporte.categoria_id,
    comuna_id: COMUNA_LA_SERENA,
    titulo: reporte.titulo,
    descripcion: reporte.descripcion,
    direccion_referencia: reporte.direccion_referencia,
    ubicacion: `SRID=4326;POINT(${reporte.longitud} ${reporte.latitud})`,
  });
  if (error) return traducirError(error);

  // 4. Subir y registrar las fotos. El reporte ya existe: si una falla,
  //    se sigue con las demás y se avisa al llegar a Mis reportes.
  let fotosFallidas = 0;
  for (const [indice, foto] of procesadas.entries()) {
    const ruta = `${usuarioId}/${reporteId}/${randomUUID()}.webp`;
    const subida = await supabase.storage
      .from(BUCKET_FOTOS)
      .upload(ruta, foto, { contentType: "image/webp", upsert: false });
    const registro = subida.error
      ? null
      : await supabase
          .from("reporte_fotos")
          .insert({ reporte_id: reporteId, ruta, orden: indice + 1 });
    if (subida.error || registro?.error) {
      console.error(
        "crearReporte: foto",
        subida.error?.message ?? registro?.error?.code,
      );
      fotosFallidas++;
    }
  }

  redirect(
    fotosFallidas > 0
      ? `/mis-reportes?nuevo=1&fotos_fallidas=${fotosFallidas}`
      : "/mis-reportes?nuevo=1",
  );
}

function traducirError(error: PostgrestError): EstadoFormulario {
  switch (error.hint) {
    case "limite_frecuencia":
      return fallo(
        "Alcanzaste el máximo de 5 reportes por hora. Inténtalo de nuevo más tarde.",
      );
    case "fuera_de_comuna":
      return fallo("Revisa los campos marcados.", {
        ubicacion:
          "La ubicación está fuera de La Serena. Por ahora solo recibimos reportes de La Serena.",
      });
  }
  switch (error.code) {
    case "23514": // CHECK de largo: Zod debió detenerlo antes
      return fallo("Revisa el título y la descripción.");
    case "42501": // RLS o permisos: sesión vencida o comuna desactivada
      return fallo(
        "No pudimos guardar tu reporte con tu sesión actual. Vuelve a ingresar e inténtalo otra vez.",
      );
  }
  console.error("crearReporte", error.code);
  return fallo(
    "No pudimos guardar tu reporte. Inténtalo de nuevo en unos minutos.",
  );
}
