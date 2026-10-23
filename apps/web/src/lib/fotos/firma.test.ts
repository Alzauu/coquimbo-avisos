import { describe, expect, it } from "vitest";

import {
  DURACION_URL_FOTO,
  firmarFoto,
  leerParametrosFoto,
  verificarFirmaFoto,
} from "./firma";

const SECRETO = "secreto-de-prueba-con-mas-de-32-caracteres";
const AHORA = 1_800_000_000;
const EXPIRA = AHORA + DURACION_URL_FOTO;

const valida = { fotoId: 42, expira: EXPIRA, firma: "" };
valida.firma = firmarFoto(valida.fotoId, valida.expira, SECRETO);

describe("verificarFirmaFoto", () => {
  it("acepta una firma válida y vigente", () => {
    expect(verificarFirmaFoto(valida, SECRETO, AHORA)).toBe(true);
    expect(verificarFirmaFoto(valida, SECRETO, EXPIRA - 1)).toBe(true);
  });

  it("rechaza una URL vencida", () => {
    expect(verificarFirmaFoto(valida, SECRETO, EXPIRA)).toBe(false);
    expect(verificarFirmaFoto(valida, SECRETO, EXPIRA + 3600)).toBe(false);
  });

  it("rechaza un vencimiento más lejano que la duración permitida", () => {
    const lejana = { fotoId: 42, expira: AHORA + 365 * 24 * 3600, firma: "" };
    lejana.firma = firmarFoto(lejana.fotoId, lejana.expira, SECRETO);
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

  it("rechaza una firma hecha con otro secreto", () => {
    const ajena = {
      ...valida,
      firma: firmarFoto(42, EXPIRA, "otro-secreto-de-prueba-con-32-caracteres"),
    };
    expect(verificarFirmaFoto(ajena, SECRETO, AHORA)).toBe(false);
  });
});

describe("leerParametrosFoto", () => {
  it("lee parámetros bien formados", () => {
    expect(leerParametrosFoto("42", String(EXPIRA), valida.firma)).toEqual(
      valida,
    );
  });

  it.each([
    ["0", String(EXPIRA), valida.firma],
    ["-1", String(EXPIRA), valida.firma],
    ["1.5", String(EXPIRA), valida.firma],
    ["abc", String(EXPIRA), valida.firma],
    ["42", null, valida.firma],
    ["42", "1e9", valida.firma],
    ["42", String(EXPIRA), null],
    ["42", String(EXPIRA), "con espacios y símbolos!"],
  ])("rechaza id=%s exp=%s firma=%s", (id, exp, firma) => {
    expect(leerParametrosFoto(id, exp, firma)).toBeNull();
  });
});
