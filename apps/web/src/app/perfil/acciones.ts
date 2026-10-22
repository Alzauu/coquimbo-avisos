"use server";

import { revalidatePath } from "next/cache";

import { esquemaNombreVisible, primerError } from "@/lib/auth/esquemas";
import { createClient } from "@/lib/supabase/server";

export type EstadoNombre =
  | { estado: "inicial" }
  | { estado: "guardado" }
  | { estado: "error"; mensaje: string };

export async function actualizarNombre(
  _previo: EstadoNombre,
  formData: FormData,
): Promise<EstadoNombre> {
  const nombre = esquemaNombreVisible.safeParse(formData.get("nombre_visible"));
  if (!nombre.success) {
    return { estado: "error", mensaje: primerError(nombre.error) };
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) {
    return {
      estado: "error",
      mensaje: "Tu sesión terminó. Vuelve a ingresar.",
    };
  }

  // RLS limita la fila al propio perfil y el permiso por columna solo
  // permite cambiar nombre_visible.
  const { error } = await supabase
    .from("perfiles")
    .update({ nombre_visible: nombre.data })
    .eq("id", data.claims.sub);

  if (error) {
    console.error("actualizarNombre", error.code);
    return { estado: "error", mensaje: "No pudimos guardar el nombre." };
  }

  revalidatePath("/perfil");
  return { estado: "guardado" };
}
