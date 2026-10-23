import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { LADO_FOTO_MEDIANA, reducirAMediana } from "./mediana";

function imagen(ancho: number, alto: number) {
  return sharp({
    create: {
      width: ancho,
      height: alto,
      channels: 3,
      background: { r: 200, g: 120, b: 40 },
    },
  })
    .webp()
    .toBuffer();
}

describe("reducirAMediana", () => {
  it("reduce el lado mayor a LADO_FOTO_MEDIANA y mantiene la proporción", async () => {
    const salida = await reducirAMediana(await imagen(1600, 1200));
    const meta = await sharp(salida).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.width).toBe(LADO_FOTO_MEDIANA);
    expect(meta.height).toBe(600);
  });

  it("no agranda fotos más chicas", async () => {
    const salida = await reducirAMediana(await imagen(500, 700));
    const meta = await sharp(salida).metadata();
    expect([meta.width, meta.height]).toEqual([500, 700]);
  });

  it("falla con datos que no son una imagen", async () => {
    await expect(
      reducirAMediana(Buffer.from("no soy una foto")),
    ).rejects.toThrow();
  });
});
