import { describe, expect, it } from "vitest";

import {
  sinDescartados,
  textoDistancia,
  textoResumenCercanos,
} from "./cercanos";

describe("textoDistancia", () => {
  it("redondea a metros y agrupa lo muy cercano", () => {
    expect(textoDistancia(0)).toBe("a menos de 10 m");
    expect(textoDistancia(9.6)).toBe("a menos de 10 m");
    expect(textoDistancia(10)).toBe("a 10 m");
    expect(textoDistancia(40.4)).toBe("a 40 m");
    expect(textoDistancia(199.5)).toBe("a 200 m");
  });

  it("pasa a kilómetros desde 1000 m, con coma decimal", () => {
    expect(textoDistancia(1000)).toBe("a 1 km");
    expect(textoDistancia(1240)).toBe("a 1,2 km");
  });
});

describe("textoResumenCercanos", () => {
  it("usa singular y plural", () => {
    expect(textoResumenCercanos(1)).toBe(
      "Hay 1 reporte parecido cerca del punto marcado.",
    );
    expect(textoResumenCercanos(3)).toBe(
      "Hay 3 reportes parecidos cerca del punto marcado.",
    );
  });
});

describe("sinDescartados", () => {
  it("quita los descartados y conserva el orden", () => {
    const reportes = [{ id: "a" }, { id: "b" }, { id: "c" }];
    expect(sinDescartados(reportes, new Set(["b"]))).toEqual([
      { id: "a" },
      { id: "c" },
    ]);
    expect(sinDescartados(reportes, new Set())).toEqual(reportes);
  });
});
