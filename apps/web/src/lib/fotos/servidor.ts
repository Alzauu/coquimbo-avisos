import "server-only";

import { firmarFoto, rutaFoto, type TamanoFoto } from "./firma";
import { DURACION_URL_FOTO } from "./respuesta";

// El secreto solo vive en el servidor: firma las URLs de fotos públicas.
export function secretoFotos(): string {
  const secreto = process.env.FOTOS_FIRMA_SECRETO;
  if (!secreto || secreto.length < 32) {
    throw new Error(
      "Falta FOTOS_FIRMA_SECRETO (al menos 32 caracteres) en apps/web/.env.local.",
    );
  }
  return secreto;
}

// URL de una foto pública, válida por DURACION_URL_FOTO. Si la foto o su
// reporte dejan de ser públicos, la URL deja de servir aunque no venza.
export function urlFotoPublica(
  fotoId: number,
  tamano: TamanoFoto = "completa",
): string {
  const expira = Math.floor(Date.now() / 1000) + DURACION_URL_FOTO;
  const firma = firmarFoto(fotoId, expira, tamano, secretoFotos());
  return rutaFoto(fotoId, expira, tamano, firma);
}
