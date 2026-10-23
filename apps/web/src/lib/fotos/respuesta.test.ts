import { describe, expect, it } from "vitest";

import { esquemaFotosReporte } from "./respuesta";

const foto = {
  id: 7,
  orden: 1,
  mediana: "/fotos/7?exp=1800000600&firma=abc&tam=m",
  completa: "/fotos/7?exp=1800000600&firma=abc",
};

describe("esquemaFotosReporte", () => {
  it("acepta la respuesta de la ruta, también sin fotos", () => {
    expect(esquemaFotosReporte.parse({ fotos: [foto] })).toEqual({
      fotos: [foto],
    });
    expect(esquemaFotosReporte.parse({ fotos: [] })).toEqual({ fotos: [] });
  });

  it("solo acepta URLs propias de /fotos", () => {
    for (const url of [
      "https://otro.sitio/fotos/7?exp=1",
      "//otro.sitio/fotos/7?exp=1",
      "javascript:alert(1)",
      "/fotos/abc?exp=1",
    ]) {
      expect(
        esquemaFotosReporte.safeParse({ fotos: [{ ...foto, completa: url }] })
          .success,
        url,
      ).toBe(false);
    }
  });
});
