import sharp from "sharp";

// Versión mediana de una foto para la tarjeta del mapa. Se genera al
// servirla: la foto guardada ya es un WebP propio (procesarFoto) de hasta
// 1600 px. Generarla al subir queda en docs/pendientes.md.
export const LADO_FOTO_MEDIANA = 800;

export async function reducirAMediana(foto: Buffer): Promise<Buffer> {
  return sharp(foto, { failOn: "error" })
    .resize({
      width: LADO_FOTO_MEDIANA,
      height: LADO_FOTO_MEDIANA,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 70 })
    .toBuffer();
}
