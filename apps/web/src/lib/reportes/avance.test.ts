import { describe, expect, it } from "vitest";

import { pasosDeAvance } from "./avance";

const resumen = (estado: Parameters<typeof pasosDeAvance>[0]) =>
  pasosDeAvance(estado).map(
    (paso) =>
      `${paso.estado}:${paso.hecho ? "hecho" : "-"}${paso.actual ? "*" : ""}`,
  );

describe("pasosDeAvance", () => {
  it("tiene los cuatro estados públicos en orden", () => {
    expect(pasosDeAvance("recibido").map((paso) => paso.estado)).toEqual([
      "recibido",
      "en_revision",
      "derivado",
      "resuelto",
    ]);
  });

  it("recibido: es el actual y nada está hecho", () => {
    expect(resumen("recibido")).toEqual([
      "recibido:-*",
      "en_revision:-",
      "derivado:-",
      "resuelto:-",
    ]);
  });

  it("en revisión: el anterior está hecho", () => {
    expect(resumen("en_revision")).toEqual([
      "recibido:hecho",
      "en_revision:-*",
      "derivado:-",
      "resuelto:-",
    ]);
  });

  it("derivado: los dos anteriores están hechos", () => {
    expect(resumen("derivado")).toEqual([
      "recibido:hecho",
      "en_revision:hecho",
      "derivado:-*",
      "resuelto:-",
    ]);
  });

  it("resuelto: todos hechos y resuelto es el actual", () => {
    expect(resumen("resuelto")).toEqual([
      "recibido:hecho",
      "en_revision:hecho",
      "derivado:hecho",
      "resuelto:hecho*",
    ]);
  });

  it("siempre hay exactamente un paso actual", () => {
    for (const estado of [
      "recibido",
      "en_revision",
      "derivado",
      "resuelto",
    ] as const) {
      expect(pasosDeAvance(estado).filter((paso) => paso.actual)).toHaveLength(
        1,
      );
    }
  });
});
