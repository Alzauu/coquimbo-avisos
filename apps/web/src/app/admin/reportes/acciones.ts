"use server";

import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import type { z } from "zod";

import {
  esquemaArchivo,
  esquemaEliminacion,
  esquemaMetaEdicion,
  esquemaRutasFotos,
} from "@/lib/admin/esquemas";
import { rutaDeLista } from "@/lib/admin/filtros";
import { CAMPO_POR_PISTA, mensajeDeErrorAdmin } from "@/lib/admin/mensajes";
import {
  erroresDeValidacion,
  type ErroresReporte,
  esquemaReporte,
} from "@/lib/reportes/esquemas";
import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

// Server Actions de administración (Next.js las protege contra CSRF).
// Usan la sesión de quien administra: cada función de la base verifica
// el rol, así que un moderador o un ciudadano recibe 42501 aunque llame a
// la acción a mano. Las fotos se borran con la misma sesión, nunca con
// service_role.

const BUCKET_FOTOS = "reportes-fotos";

export type EstadoAccion =
  { estado: "inicial" } | { estado: "error"; mensaje: string };

export type EstadoEdicion =
  | { estado: "inicial" }
  | { estado: "error"; mensaje: string; errores: ErroresReporte };

export type EstadoEliminacion =
  | EstadoAccion
  // El reporte ya se eliminó, pero quedaron archivos por borrar.
  | { estado: "archivos_pendientes"; mensaje: string; rutas: string[] };

const fallo = (mensaje: string) => ({ estado: "error" as const, mensaje });

const primerError = (error: z.ZodError) =>
  error.issues[0]?.message ?? "Revisa los datos enviados.";

async function clienteConSesion() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return data?.claims ? supabase : null;
}

const SIN_SESION = "Tu sesión terminó. Vuelve a ingresar.";

function mensajeDeBase(accion: string, error: PostgrestError): string {
  if (!error.hint && error.code !== "42501") console.error(accion, error.code);
  return mensajeDeErrorAdmin(error);
}

export async function archivarReporte(
  _previo: EstadoAccion,
  formData: FormData,
): Promise<EstadoAccion> {
  const datos = esquemaArchivo.safeParse({
    reporte_id: formData.get("reporte_id"),
  });
  if (!datos.success) return fallo(primerError(datos.error));

  const supabase = await clienteConSesion();
  if (!supabase) return fallo(SIN_SESION);

  const { error } = await supabase.rpc("archivar_reporte", {
    reporte: datos.data.reporte_id,
  });
  if (error) return fallo(mensajeDeBase("archivar_reporte", error));
  redirect(rutaDeLista(formData.get("volver"), "archivado"));
}

export async function restaurarReporte(
  _previo: EstadoAccion,
  formData: FormData,
): Promise<EstadoAccion> {
  const datos = esquemaArchivo.safeParse({
    reporte_id: formData.get("reporte_id"),
  });
  if (!datos.success) return fallo(primerError(datos.error));

  const supabase = await clienteConSesion();
  if (!supabase) return fallo(SIN_SESION);

  const { error } = await supabase.rpc("restaurar_reporte", {
    reporte: datos.data.reporte_id,
  });
  if (error) return fallo(mensajeDeBase("restaurar_reporte", error));
  redirect(rutaDeLista(formData.get("volver"), "restaurado"));
}

export async function editarReporte(
  _previo: EstadoEdicion,
  formData: FormData,
): Promise<EstadoEdicion> {
  const meta = esquemaMetaEdicion.safeParse({
    reporte_id: formData.get("reporte_id"),
    version: formData.get("version"),
    estado: formData.get("estado"),
  });
  if (!meta.success) {
    return { ...fallo(primerError(meta.error)), errores: {} };
  }
  // Las mismas validaciones del formulario de reportar.
  const campos = esquemaReporte.safeParse({
    categoria_id: formData.get("categoria_id"),
    titulo: formData.get("titulo"),
    descripcion: formData.get("descripcion"),
    direccion_referencia: formData.get("direccion_referencia"),
    latitud: formData.get("latitud"),
    longitud: formData.get("longitud"),
  });
  if (!campos.success) {
    return {
      ...fallo("Revisa los campos marcados."),
      errores: erroresDeValidacion(campos.error, undefined),
    };
  }

  const supabase = await clienteConSesion();
  if (!supabase) return { ...fallo(SIN_SESION), errores: {} };

  const reporte = campos.data;
  const { error } = await supabase.rpc("editar_reporte", {
    reporte: meta.data.reporte_id,
    version: meta.data.version,
    nuevo_titulo: reporte.titulo,
    // La base convierte "" en NULL.
    nueva_descripcion: reporte.descripcion ?? "",
    nueva_categoria: reporte.categoria_id,
    nueva_referencia: reporte.direccion_referencia ?? "",
    nueva_latitud: reporte.latitud,
    nueva_longitud: reporte.longitud,
    nuevo_estado: meta.data.estado,
  });
  if (error) {
    const mensaje = mensajeDeBase("editar_reporte", error);
    const campo = error.hint ? CAMPO_POR_PISTA[error.hint] : undefined;
    return campo
      ? {
          ...fallo("Revisa los campos marcados."),
          errores: { [campo]: mensaje },
        }
      : { ...fallo(mensaje), errores: {} };
  }
  redirect(`/admin/reportes/${meta.data.reporte_id}?aviso=editado`);
}

// Borra archivos de Storage con la sesión del admin y devuelve los que
// no se pudieron borrar. La política de Storage solo lo permite si su
// reporte ya no existe.
async function borrarArchivos(
  supabase: SupabaseClient<Database>,
  rutas: string[],
): Promise<string[]> {
  if (rutas.length === 0) return [];
  const { data, error } = await supabase.storage
    .from(BUCKET_FOTOS)
    .remove(rutas);
  if (error) {
    console.error("borrar fotos de reporte eliminado", error.message);
    return rutas;
  }
  const borradas = new Set((data ?? []).map((archivo) => archivo.name));
  const pendientes = rutas.filter((ruta) => !borradas.has(ruta));
  if (pendientes.length > 0) {
    console.error("borrar fotos de reporte eliminado", pendientes.length);
  }
  return pendientes;
}

function archivosPendientes(rutas: string[]): EstadoEliminacion {
  return {
    estado: "archivos_pendientes",
    mensaje: `El reporte se eliminó, pero no pudimos borrar ${
      rutas.length === 1 ? "1 foto" : `${rutas.length} fotos`
    } del almacenamiento. Ya no se pueden ver. Reintenta el borrado.`,
    rutas,
  };
}

export async function eliminarReporte(
  _previo: EstadoEliminacion,
  formData: FormData,
): Promise<EstadoEliminacion> {
  const datos = esquemaEliminacion.safeParse({
    reporte_id: formData.get("reporte_id"),
    motivo: formData.get("motivo"),
    confirmacion: formData.get("confirmacion"),
  });
  if (!datos.success) return fallo(primerError(datos.error));

  const supabase = await clienteConSesion();
  if (!supabase) return fallo(SIN_SESION);

  // Primero la base (en una transacción): desde aquí el reporte y sus
  // fotos ya no existen ni se pueden servir.
  const { data: rutas, error } = await supabase.rpc("eliminar_reporte", {
    reporte: datos.data.reporte_id,
    motivo: datos.data.motivo,
  });
  if (error) return fallo(mensajeDeBase("eliminar_reporte", error));

  const pendientes = await borrarArchivos(supabase, rutas ?? []);
  if (pendientes.length > 0) return archivosPendientes(pendientes);
  redirect(rutaDeLista(null, "eliminado"));
}

export async function reintentarBorrado(
  _previo: EstadoEliminacion,
  formData: FormData,
): Promise<EstadoEliminacion> {
  const rutas = esquemaRutasFotos.safeParse(formData.getAll("ruta"));
  if (!rutas.success) return fallo(primerError(rutas.error));

  const supabase = await clienteConSesion();
  if (!supabase) return fallo(SIN_SESION);

  const pendientes = await borrarArchivos(supabase, rutas.data);
  if (pendientes.length > 0) return archivosPendientes(pendientes);
  redirect(rutaDeLista(null, "eliminado"));
}
