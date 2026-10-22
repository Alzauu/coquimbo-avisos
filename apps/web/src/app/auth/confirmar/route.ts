import type { EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";

import { rutaSegura } from "@/lib/auth/redireccion";
import { createClient } from "@/lib/supabase/server";

// Tipos de enlace por correo que acepta este callback.
const TIPOS_PERMITIDOS = ["email", "magiclink", "signup"] as const;

function esTipoPermitido(tipo: string | null): tipo is EmailOtpType {
  return TIPOS_PERMITIDOS.some((permitido) => permitido === tipo);
}

// Destino del enlace del correo. Acepta dos formatos:
// - token_hash + type: plantilla de correo propia (requiere SMTP propio).
//   Funciona aunque el enlace se abra en otro navegador o dispositivo.
// - code: plantilla estándar de Supabase con PKCE. Solo funciona en el
//   mismo navegador donde se pidió el enlace (ahí está el code_verifier).
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const tipo = searchParams.get("type");
  const codigo = searchParams.get("code");
  const siguiente = rutaSegura(searchParams.get("siguiente"));

  if (tokenHash && esTipoPermitido(tipo)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      type: tipo,
      token_hash: tokenHash,
    });
    if (!error) redirect(siguiente);
  } else if (codigo) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(codigo);
    if (!error) redirect(siguiente);
  }

  redirect("/ingresar?error=enlace");
}
