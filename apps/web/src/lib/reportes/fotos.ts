import sharp from "sharp";

import { LADO_MAX_FOTO, MAX_BYTES_FOTO_GUARDADA } from "./esquemas";

// Procesamiento de fotos en el servidor. Solo la usa la Server Action:
// sharp es un módulo nativo de Node y no puede llegar al navegador.

const FORMATOS_ENTRADA = new Set(["jpeg", "png", "webp"]);

// Unos 40 megapíxeles: más que cualquier cámara de teléfono, y frena
// imágenes diseñadas para agotar la memoria al descomprimirse.
const MAX_PIXELES_ENTRADA = 40_000_000;

// Si el resultado pasa de MAX_BYTES_FOTO_GUARDADA se intenta con menos
// calidad y luego con menos resolución.
const INTENTOS = [
  { lado: LADO_MAX_FOTO, calidad: 80 },
  { lado: LADO_MAX_FOTO, calidad: 70 },
  { lado: LADO_MAX_FOTO, calidad: 60 },
  { lado: 1280, calidad: 60 },
  { lado: 1024, calidad: 55 },
];

export class FotoInvalida extends Error {}

// Comprueba que sea una imagen real (JPEG, PNG o WebP), la endereza según
// su orientación EXIF y la guarda como WebP de hasta LADO_MAX_FOTO px.
// sharp no copia metadatos a la salida salvo que se le pida: se pierden
// EXIF (con el GPS), XMP e IPTC.
export async function procesarFoto(entrada: Buffer): Promise<Buffer> {
  const opciones = {
    limitInputPixels: MAX_PIXELES_ENTRADA,
    failOn: "error" as const,
  };

  let formato: string | undefined;
  try {
    formato = (await sharp(entrada, opciones).metadata()).format;
  } catch {
    throw new FotoInvalida("El archivo no es una imagen válida.");
  }
  if (!formato || !FORMATOS_ENTRADA.has(formato)) {
    throw new FotoInvalida("Formato de imagen no permitido.");
  }

  for (const { lado, calidad } of INTENTOS) {
    let salida: Buffer;
    try {
      salida = await sharp(entrada, opciones)
        .rotate() // aplica la orientación EXIF antes de descartarla
        .resize({
          width: lado,
          height: lado,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: calidad })
        .toBuffer();
    } catch {
      throw new FotoInvalida("No se pudo procesar la imagen.");
    }
    if (salida.length <= MAX_BYTES_FOTO_GUARDADA) return salida;
  }
  throw new FotoInvalida("La imagen sigue siendo demasiado pesada.");
}
