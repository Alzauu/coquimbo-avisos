import { describe, expect, it } from "vitest";

import {
  ERROR_VOTO_GENERICO,
  esquemaVoto,
  mensajeDeErrorVoto,
  siguienteVoto,
  textoVotos,
  totalesTrasVoto,
} from "./votos";

const ID = "0b7c5a52-3f0e-4a8e-9a43-5d2f4f6f1c11";

describe("esquemaVoto", () => {
  it.each([1, -1, null])("acepta el voto %s", (voto) => {
    expect(esquemaVoto.safeParse({ reporteId: ID, voto }).success).toBe(true);
  });

  it.each([0, 2, -2, "1", undefined, true])("rechaza el voto %s", (voto) => {
    expect(esquemaVoto.safeParse({ reporteId: ID, voto }).success).toBe(false);
  });

  it("rechaza un reporte que no es un uuid", () => {
    const resultado = esquemaVoto.safeParse({ reporteId: "abc", voto: 1 });
    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues[0]?.message).toBe(
      "El reporte no es válido.",
    );
  });
});

describe("siguienteVoto", () => {
  it("sin voto, toma la opción tocada", () => {
    expect(siguienteVoto(null, 1)).toBe(1);
    expect(siguienteVoto(null, -1)).toBe(-1);
  });

  it("tocar la opción elegida quita el voto", () => {
    expect(siguienteVoto(1, 1)).toBeNull();
    expect(siguienteVoto(-1, -1)).toBeNull();
  });

  it("tocar la otra opción cambia el voto", () => {
    expect(siguienteVoto(1, -1)).toBe(-1);
    expect(siguienteVoto(-1, 1)).toBe(1);
  });
});

describe("totalesTrasVoto", () => {
  const base = { me_afecta: 4, no_me_afecta: 2 };

  it("suma un voto nuevo", () => {
    expect(totalesTrasVoto(base, null, 1)).toEqual({
      me_afecta: 5,
      no_me_afecta: 2,
    });
    expect(totalesTrasVoto(base, null, -1)).toEqual({
      me_afecta: 4,
      no_me_afecta: 3,
    });
  });

  it("mueve un voto que cambia", () => {
    expect(totalesTrasVoto(base, 1, -1)).toEqual({
      me_afecta: 3,
      no_me_afecta: 3,
    });
  });

  it("resta un voto quitado", () => {
    expect(totalesTrasVoto(base, -1, null)).toEqual({
      me_afecta: 4,
      no_me_afecta: 1,
    });
  });

  it("no cambia si el voto es el mismo", () => {
    expect(totalesTrasVoto(base, 1, 1)).toEqual(base);
    expect(totalesTrasVoto(base, null, null)).toEqual(base);
  });

  it("nunca deja totales negativos, aunque los de partida estén desactualizados", () => {
    const vacios = { me_afecta: 0, no_me_afecta: 0 };
    expect(totalesTrasVoto(vacios, 1, null)).toEqual(vacios);
    expect(totalesTrasVoto(vacios, -1, 1)).toEqual({
      me_afecta: 1,
      no_me_afecta: 0,
    });
    expect(totalesTrasVoto(vacios, 1, -1)).toEqual({
      me_afecta: 0,
      no_me_afecta: 1,
    });
  });
});

describe("mensajeDeErrorVoto", () => {
  it("traduce las pistas de la base", () => {
    expect(mensajeDeErrorVoto({ hint: "reporte_propio" })).toBe(
      "No puedes votar tu propio reporte.",
    );
    expect(mensajeDeErrorVoto({ hint: "limite_frecuencia" })).toMatch(
      /60 votos por hora/,
    );
  });

  it("usa un mensaje genérico para lo desconocido", () => {
    expect(mensajeDeErrorVoto({ hint: "toString" })).toBe(ERROR_VOTO_GENERICO);
    expect(mensajeDeErrorVoto({ code: "500" })).toBe(ERROR_VOTO_GENERICO);
  });
});

describe("textoVotos", () => {
  it("usa singular y plural, con separador de miles chileno", () => {
    expect(textoVotos(0)).toBe("0 votos");
    expect(textoVotos(1)).toBe("1 voto");
    expect(textoVotos(1024)).toBe("1.024 votos");
  });
});
