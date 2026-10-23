import { randomBytes } from "node:crypto";

import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { LADO_MAX_FOTO, MAX_BYTES_FOTO_GUARDADA } from "./esquemas";
import { FotoInvalida, procesarFoto } from "./fotos";

// Imagen de ruido: es lo más difícil de comprimir, así que pone a prueba el
// límite de peso.
function ruido(ancho: number, alto: number) {
  return sharp(randomBytes(ancho * alto * 3), {
    raw: { width: ancho, height: alto, channels: 3 },
  });
}

describe("procesarFoto", () => {
  it("reduce, convierte a WebP, respeta el peso máximo y quita EXIF y GPS", async () => {
    const original = await ruido(4000, 3000)
      .jpeg({ quality: 90 })
      .withExif({
        IFD0: { Make: "Camara de prueba", Model: "Modelo X" },
        IFD3: { GPSLatitudeRef: "S", GPSLongitudeRef: "W" },
      })
      .toBuffer();
    // La entrada sí trae EXIF con el bloque GPS (etiqueta 0x8825, en el
    // orden de bytes que use el archivo).
    const exif = (await sharp(original).metadata()).exif;
    expect(exif?.includes(Buffer.from("Camara de prueba"))).toBe(true);
    expect(
      exif?.includes(Buffer.from([0x88, 0x25])) ||
        exif?.includes(Buffer.from([0x25, 0x88])),
    ).toBe(true);

    const salida = await procesarFoto(original);
    const despues = await sharp(salida).metadata();

    expect(despues.format).toBe("webp");
    expect(Math.max(despues.width!, despues.height!)).toBeLessThanOrEqual(
      LADO_MAX_FOTO,
    );
    expect(salida.length).toBeLessThanOrEqual(MAX_BYTES_FOTO_GUARDADA);
    expect(despues.exif).toBeUndefined();
    expect(despues.xmp).toBeUndefined();
    expect(despues.iptc).toBeUndefined();
  }, 30_000);

  it("endereza la foto según su orientación EXIF", async () => {
    // 200×100 con orientación 6 ("girar 90°"): se ve vertical.
    const original = await ruido(200, 100)
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();
    expect((await sharp(original).metadata()).orientation).toBe(6);

    const despues = await sharp(await procesarFoto(original)).metadata();

    expect({ ancho: despues.width, alto: despues.height }).toEqual({
      ancho: 100,
      alto: 200,
    });
    expect(despues.orientation).toBeUndefined();
  });

  it("no agranda fotos pequeñas", async () => {
    const original = await ruido(300, 200).png().toBuffer();
    const despues = await sharp(await procesarFoto(original)).metadata();
    expect({ ancho: despues.width, alto: despues.height }).toEqual({
      ancho: 300,
      alto: 200,
    });
  });

  it("rechaza archivos que no son imágenes", async () => {
    await expect(
      procesarFoto(Buffer.from("<script>alert(1)</script>")),
    ).rejects.toBeInstanceOf(FotoInvalida);
  });

  it("rechaza formatos no permitidos aunque sean imágenes", async () => {
    const gif = await ruido(20, 20).gif().toBuffer();
    await expect(procesarFoto(gif)).rejects.toBeInstanceOf(FotoInvalida);
  });

  it("rechaza una imagen truncada", async () => {
    const jpeg = await ruido(400, 300).jpeg().toBuffer();
    await expect(
      procesarFoto(jpeg.subarray(0, jpeg.length / 2)),
    ).rejects.toBeInstanceOf(FotoInvalida);
  });
});
