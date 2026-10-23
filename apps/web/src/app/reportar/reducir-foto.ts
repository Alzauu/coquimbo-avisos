import { LADO_MAX_FOTO, MAX_BYTES_FOTO_ENVIADA } from "@/lib/reportes/esquemas";

// Reduce una foto en el navegador antes de enviarla, para respetar el
// límite de la Server Action. Se guarda como JPEG porque Safari no sabe
// generar WebP desde un canvas; el servidor la convierte a WebP después.
// Al redibujarla en un canvas también se pierden sus metadatos (EXIF, GPS),
// aunque el servidor los quita de todas formas.
export async function reducirFoto(archivo: File): Promise<File> {
  const imagen = await createImageBitmap(archivo, {
    imageOrientation: "from-image",
  });
  try {
    const escala = Math.min(
      1,
      LADO_MAX_FOTO / Math.max(imagen.width, imagen.height),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(imagen.width * escala));
    canvas.height = Math.max(1, Math.round(imagen.height * escala));

    const contexto = canvas.getContext("2d");
    if (!contexto) throw new Error("El navegador no permite dibujar la foto.");
    // Fondo blanco para PNG con transparencia (JPEG no la admite).
    contexto.fillStyle = "#ffffff";
    contexto.fillRect(0, 0, canvas.width, canvas.height);
    contexto.drawImage(imagen, 0, 0, canvas.width, canvas.height);

    for (const calidad of [0.85, 0.75, 0.6]) {
      const blob = await new Promise<Blob | null>((resolver) =>
        canvas.toBlob(resolver, "image/jpeg", calidad),
      );
      if (blob && blob.size <= MAX_BYTES_FOTO_ENVIADA) {
        return new File([blob], "foto.jpg", { type: "image/jpeg" });
      }
    }
    throw new Error("La foto sigue siendo demasiado pesada.");
  } finally {
    imagen.close();
  }
}
