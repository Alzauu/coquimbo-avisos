"use server";

import { headers } from "next/headers";

import { esquemaCorreo, primerError } from "@/lib/auth/esquemas";
import { rutaSegura } from "@/lib/auth/redireccion";
import { createClient } from "@/lib/supabase/server";

export type EstadoIngreso =
  | { estado: "inicial" }
  | { estado: "enviado"; correo: string }
  | { estado: "error"; mensaje: string };

const ERROR_GENERICO =
  "No pudimos enviar el enlace. Inténtalo de nuevo en unos minutos.";

export async function enviarEnlace(
  _previo: EstadoIngreso,
  formData: FormData,
): Promise<EstadoIngreso> {
  const correo = esquemaCorreo.safeParse(formData.get("correo"));
  if (!correo.success) {
    return { estado: "error", mensaje: primerError(correo.error) };
  }

  // Next.js ya comprueba que el Origin de una Server Action coincida con el host.
  const origen = (await headers()).get("origin");
  if (!origen) return { estado: "error", mensaje: ERROR_GENERICO };

  // Supabase agrega &code=... a esta URL (plantilla estándar, PKCE) o, con
  // una plantilla propia, &token_hash=...&type=email.
  const confirmar = new URL("/auth/confirmar", origen);
  confirmar.searchParams.set(
    "siguiente",
    rutaSegura(formData.get("siguiente")),
  );

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: correo.data,
    options: { emailRedirectTo: confirmar.toString() },
  });

  if (error) {
    if (error.status === 429) {
      return {
        estado: "error",
        mensaje:
          "Pediste varios enlaces seguidos. Espera un momento y vuelve a intentarlo.",
      };
    }
    console.error("signInWithOtp", error.status, error.code);
    return { estado: "error", mensaje: ERROR_GENERICO };
  }

  return { estado: "enviado", correo: correo.data };
}
