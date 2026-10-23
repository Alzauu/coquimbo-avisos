import { describe, expect, it } from "vitest";

import { moverIndice, pasoDeslizar, UMBRAL_DESLIZAR } from "./carrusel";

describe("pasoDeslizar", () => {
  it("hacia la izquierda avanza y hacia la derecha retrocede", () => {
    expect(pasoDeslizar(-UMBRAL_DESLIZAR, 0)).toBe(1);
    expect(pasoDeslizar(UMBRAL_DESLIZAR + 30, 10)).toBe(-1);
  });

  it("ignora gestos cortos o más verticales que horizontales", () => {
    expect(pasoDeslizar(UMBRAL_DESLIZAR - 1, 0)).toBe(0);
    expect(pasoDeslizar(-60, 80)).toBe(0);
    expect(pasoDeslizar(60, -60)).toBe(0);
    expect(pasoDeslizar(0, 0)).toBe(0);
  });
});

describe("moverIndice", () => {
  it("avanza y retrocede sin salirse de los extremos", () => {
    expect(moverIndice(0, 1, 3)).toBe(1);
    expect(moverIndice(2, 1, 3)).toBe(2);
    expect(moverIndice(0, -1, 3)).toBe(0);
    expect(moverIndice(1, -1, 3)).toBe(0);
  });

  it("ajusta un índice que quedó fuera tras cambiar la lista", () => {
    expect(moverIndice(2, 0, 1)).toBe(0);
    expect(moverIndice(1, 0, 0)).toBe(0);
  });
});
