"use server";

import type { PostgrestError } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import type { z } from "zod";

import {
  esquemaAprobacion,
  esquemaCambioEstado,
  esquemaOcultarFoto,
  esquemaOcultarReporte,
  esquemaRechazo,
  type Origen,
} from "@/lib/moderacion/esquemas";
import {
  type CodigoAviso,
  mensajeDeErrorModeracion,
} from "@/lib/moderacion/mensajes";
import { createClient } from "@/lib/supabase/server";

// Server Actions de moderación (Next.js las protege contra CSRF). Usan la
// sesión de quien modera: cada función de la base verifica el rol, así
// que un usuario normal recibe 42501 aunque llame a la acción a mano.

export type EstadoAccion =
  { estado: "inicial" } | { estado: "error"; mensaje: string };

const fallo = (mensaje: string): EstadoAccion => ({ estado: "error", mensaje });

const primerError = (error: z.ZodError) =>
  error.issues[0]?.message ?? "Revisa los datos enviados.";

async function clienteConSesion() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return data?.claims ? supabase : null;
}

const SIN_SESION = "Tu sesión terminó. Vuelve a ingresar.";

function errorDeBase(accion: string, error: PostgrestError): EstadoAccion {
  if (!error.hint && error.code !== "42501") console.error(accion, error.code);
  return fallo(mensajeDeErrorModeracion(error));
}

// Vuelve a la página desde donde se moderó, con un aviso de éxito.
function volver(origen: Origen, reporteId: string, aviso: CodigoAviso): never {
  redirect(
    origen === "detalle"
      ? `/reporte/${reporteId}?aviso=${aviso}`
      : `/moderacion?aviso=${aviso}`,
  );
}

export async function aprobarReporte(
  _previo: EstadoAccion,
  formData: FormData,
): Promise<EstadoAccion> {
  const datos = esquemaAprobacion.safeParse({
    reporte_id: formData.get("reporte_id"),
  });
  if (!datos.success) return fallo(primerError(datos.error));

  const supabase = await clienteConSesion();
  if (!supabase) return fallo(SIN_SESION);

  const { error } = await supabase.rpc("aprobar_reporte", {
    reporte: datos.data.reporte_id,
  });
  if (error) return errorDeBase("aprobar_reporte", error);
  volver("panel", datos.data.reporte_id, "aprobado");
}

export async function rechazarReporte(
  _previo: EstadoAccion,
  formData: FormData,
): Promise<EstadoAccion> {
  const datos = esquemaRechazo.safeParse({
    reporte_id: formData.get("reporte_id"),
    motivo: formData.get("motivo"),
  });
  if (!datos.success) return fallo(primerError(datos.error));

  const supabase = await clienteConSesion();
  if (!supabase) return fallo(SIN_SESION);

  const { error } = await supabase.rpc("rechazar_reporte", {
    reporte: datos.data.reporte_id,
    motivo: datos.data.motivo,
  });
  if (error) return errorDeBase("rechazar_reporte", error);
  volver("panel", datos.data.reporte_id, "rechazado");
}

export async function ocultarFoto(
  _previo: EstadoAccion,
  formData: FormData,
): Promise<EstadoAccion> {
  const datos = esquemaOcultarFoto.safeParse({
    reporte_id: formData.get("reporte_id"),
    foto_id: formData.get("foto_id"),
    origen: formData.get("origen"),
  });
  if (!datos.success) return fallo(primerError(datos.error));

  const supabase = await clienteConSesion();
  if (!supabase) return fallo(SIN_SESION);

  const { error } = await supabase.rpc("ocultar_foto", {
    foto: datos.data.foto_id,
  });
  if (error) return errorDeBase("ocultar_foto", error);
  volver(datos.data.origen, datos.data.reporte_id, "foto_oculta");
}

export async function ocultarReporte(
  _previo: EstadoAccion,
  formData: FormData,
): Promise<EstadoAccion> {
  const datos = esquemaOcultarReporte.safeParse({
    reporte_id: formData.get("reporte_id"),
    motivo: formData.get("motivo"),
  });
  if (!datos.success) return fallo(primerError(datos.error));

  const supabase = await clienteConSesion();
  if (!supabase) return fallo(SIN_SESION);

  const { error } = await supabase.rpc("ocultar_reporte", {
    reporte: datos.data.reporte_id,
    motivo: datos.data.motivo ?? undefined,
  });
  if (error) return errorDeBase("ocultar_reporte", error);
  // El reporte ya no es público: su página de detalle respondería 404.
  volver("panel", datos.data.reporte_id, "reporte_oculto");
}

export async function cambiarEstado(
  _previo: EstadoAccion,
  formData: FormData,
): Promise<EstadoAccion> {
  const datos = esquemaCambioEstado.safeParse({
    reporte_id: formData.get("reporte_id"),
    estado: formData.get("estado"),
  });
  if (!datos.success) return fallo(primerError(datos.error));

  const supabase = await clienteConSesion();
  if (!supabase) return fallo(SIN_SESION);

  const { error } = await supabase.rpc("cambiar_estado_reporte", {
    reporte: datos.data.reporte_id,
    nuevo: datos.data.estado,
  });
  if (error) return errorDeBase("cambiar_estado_reporte", error);
  volver("detalle", datos.data.reporte_id, "estado");
}
