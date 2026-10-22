import { z } from "zod";

export const esquemaCorreo = z
  .string("Escribe tu correo.")
  .trim()
  .pipe(
    z.email("Escribe un correo válido.").max(254, "El correo es muy largo."),
  );

// Caracteres de control y de dirección de texto (se usan para suplantar nombres).
const CARACTERES_NO_PERMITIDOS = /[\p{Cc}‪-‮⁦-⁩]/u;

// Debe coincidir con el CHECK de perfiles.nombre_visible (2 a 50 caracteres,
// sin espacios al inicio o al final). Se cuentan caracteres, no unidades UTF-16.
export const esquemaNombreVisible = z
  .string("Escribe un nombre.")
  .transform((valor) => valor.trim().replace(/\s+/g, " "))
  .refine((valor) => [...valor].length >= 2, {
    error: "El nombre debe tener al menos 2 caracteres.",
  })
  .refine((valor) => [...valor].length <= 50, {
    error: "El nombre puede tener hasta 50 caracteres.",
  })
  .refine((valor) => !CARACTERES_NO_PERMITIDOS.test(valor), {
    error: "El nombre tiene caracteres no permitidos.",
  });

export function primerError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Revisa los datos ingresados.";
}
