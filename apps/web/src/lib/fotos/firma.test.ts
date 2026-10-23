import { describe, expect, it } from "vitest";

import {
  firmarFoto,
  leerParametrosFoto,
  rutaFoto,
  verificarFirmaFoto,
} from "./firma";
import { DURACION_URL_FOTO } from "./respuesta";

const SECRETO = "secreto-de-prueba-con-mas-de-32-caracteres";
const AHORA = 1_800_000_000;
const EXPIRA = AHORA + DURACION_URL_FOTO;

const valida = {
  fotoId: 42,
  expira: EXPIRA,
  tamano: "completa" as const,
  firma: firmarFoto(42, EXPIRA, "completa", SECRETO),
};
const mediana = {
  ...valida,
  tamano: "mediana" as const,
  firma: firmarFoto(42, EXPIRA, "mediana", SECRETO),
};

describe("verificarFirmaFoto", () => {
  it("acepta una firma válida y vigente", () => {
    expect(verificarFirmaFoto(valida, SECRETO, AHORA)).toBe(true);
    expect(verificarFirmaFoto(valida, SECRETO, EXPIRA - 1)).toBe(true);
    expect(verificarFirmaFoto(mediana, SECRETO, AHORA)).toBe(true);
  });

  it("rechaza una URL vencida", () => {
    expect(verificarFirmaFoto(valida, SECRETO, EXPIRA)).toBe(false);
    expect(verificarFirmaFoto(valida, SECRETO, EXPIRA + 3600)).toBe(false);
  });

  it("rechaza un vencimiento más lejano que la duración permitida", () => {
    const expira = AHORA + 365 * 24 * 3600;
    const lejana = {
      ...valida,
      expira,
      firma: firmarFoto(42, expira, "completa", SECRETO),
    };
    expect(verificarFirmaFoto(lejana, SECRETO, AHORA)).toBe(false);
  });

  it("rechaza si se altera la foto, el vencimiento o la firma", () => {
    expect(verificarFirmaFoto({ ...valida, fotoId: 43 }, SECRETO, AHORA)).toBe(
      false,
    );
    expect(
      verificarFirmaFoto({ ...valida, expira: EXPIRA - 1 }, SECRETO, AHORA),
    ).toBe(false);
    const alterada =
      (valida.firma[0] === "A" ? "B" : "A") + valida.firma.slice(1);
    expect(
      verificarFirmaFoto({ ...valida, firma: alterada }, SECRETO, AHORA),
    ).toBe(false);
    expect(
      verificarFirmaFoto({ ...valida, firma: "corta" }, SECRETO, AHORA),
    ).toBe(false);
  });

  it("una firma de un tamaño no sirve para el otro", () => {
    expect(
      verificarFirmaFoto({ ...valida, firma: mediana.firma }, SECRETO, AHORA),
    ).toBe(false);
    expect(
      verificarFirmaFoto({ ...mediana, firma: valida.firma }, SECRETO, AHORA),
    ).toBe(false);
  });

  it("rechaza una firma hecha con otro secreto", () => {
    const ajena = {
      ...valida,
      firma: firmarFoto(
        42,
        EXPIRA,
        "completa",
        "otro-secreto-de-prueba-con-32-caracteres",
      ),
    };
    expect(verificarFirmaFoto(ajena, SECRETO, AHORA)).toBe(false);
  });
});

describe("leerParametrosFoto y rutaFoto", () => {
  it("lee parámetros bien formados", () => {
    expect(
      leerParametrosFoto("42", String(EXPIRA), valida.firma, null),
    ).toEqual(valida);
    expect(
      leerParametrosFoto("42", String(EXPIRA), mediana.firma, "m"),
    ).toEqual(mediana);
  });

  it("lee de vuelta lo que arma rutaFoto", () => {
    for (const p of [valida, mediana]) {
      const url = new URL(
        rutaFoto(p.fotoId, p.expira, p.tamano, p.firma),
        "http://x",
      );
      expect(url.pathname).toBe("/fotos/42");
      const q = url.searchParams;
      expect(
        leerParametrosFoto("42", q.get("exp"), q.get("firma"), q.get("tam")),
      ).toEqual(p);
    }
  });

  it.each([
    ["0", String(EXPIRA), valida.firma, null],
    ["-1", String(EXPIRA), valida.firma, null],
    ["1.5", String(EXPIRA), valida.firma, null],
    ["abc", String(EXPIRA), valida.firma, null],
    ["42", null, valida.firma, null],
    ["42", "1e9", valida.firma, null],
    ["42", String(EXPIRA), null, null],
    ["42", String(EXPIRA), "con espacios y símbolos!", null],
    ["42", String(EXPIRA), valida.firma, ""],
    ["42", String(EXPIRA), valida.firma, "grande"],
    ["42", String(EXPIRA), valida.firma, "completa"],
  ])("rechaza id=%s exp=%s firma=%s tam=%s", (id, exp, firma, tam) => {
    expect(leerParametrosFoto(id, exp, firma, tam)).toBeNull();
  });
});
