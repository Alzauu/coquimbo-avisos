import { describe, expect, it } from "vitest";

import {
  aGeoJSON,
  COLOR_SIN_CATEGORIA,
  colorDeCategoria,
  filtroDeSeleccion,
  formatearFecha,
  recortarTexto,
  type ReportePublico,
  zonaValida,
} from "./presentacion";

const reporte: ReportePublico = {
  id: "r1",
  categoria_id: 3,
  titulo: "Bache",
  descripcion: null,
  direccion_referencia: null,
  estado: "recibido",
  creado_en: "2026-10-20T15:00:00Z",
  resuelto_en: null,
  latitud: -29.9,
  longitud: -71.25,
};

describe("filtroDeSeleccion", () => {
  const todas = ["a", "b", "c"] as const;

  it("no filtra si están todas marcadas", () => {
    expect(filtroDeSeleccion(new Set(todas), todas)).toBeUndefined();
  });

  it("devuelve las marcadas en el orden original", () => {
    expect(filtroDeSeleccion(new Set(["c", "a"] as const), todas)).toEqual([
      "a",
      "c",
    ]);
  });

  it("devuelve una lista vacía si no hay ninguna marcada", () => {
    expect(filtroDeSeleccion(new Set(), todas)).toEqual([]);
  });
});

describe("zonaValida", () => {
  it("deja igual una zona válida", () => {
    const zona = { oeste: -71.3, sur: -29.95, este: -71.2, norte: -29.86 };
    expect(zonaValida(zona)).toEqual(zona);
  });

  it("recorta longitudes y latitudes fuera de rango", () => {
    expect(zonaValida({ oeste: -400, sur: -95, este: 250, norte: 91 })).toEqual(
      { oeste: -180, sur: -90, este: 180, norte: 90 },
    );
  });
});

describe("aGeoJSON", () => {
  it("usa [longitud, latitud] y el color de la categoría", () => {
    const geojson = aGeoJSON([reporte], new Map([[3, "#123456"]]));
    expect(geojson.features[0]).toEqual({
      type: "Feature",
      geometry: { type: "Point", coordinates: [-71.25, -29.9] },
      properties: { id: "r1", color: "#123456" },
    });
  });

  it("usa un color neutro si la categoría no tiene color", () => {
    const geojson = aGeoJSON([reporte], new Map());
    expect(geojson.features[0]?.properties.color).toBe(COLOR_SIN_CATEGORIA);
  });
});

describe("colorDeCategoria", () => {
  it("usa el color neutro para un código desconocido", () => {
    expect(colorDeCategoria("no-existe")).toBe(COLOR_SIN_CATEGORIA);
  });
});

describe("formatearFecha", () => {
  it("usa la hora de Chile", () => {
    // 02:00 UTC del 21 de octubre todavía es 20 de octubre en Chile.
    expect(formatearFecha("2026-10-21T02:00:00Z")).toBe(
      "20 de octubre de 2026",
    );
  });
});

describe("recortarTexto", () => {
  it("no recorta un texto corto", () => {
    expect(recortarTexto("Hay un bache.", 20)).toBeNull();
    expect(recortarTexto("x".repeat(20), 20)).toBeNull();
  });

  it("corta en el último espacio y agrega puntos suspensivos", () => {
    expect(recortarTexto("Hay un bache grande frente al colegio", 20)).toBe(
      "Hay un bache grande…",
    );
  });

  it("corta en seco si no hay un espacio razonable", () => {
    expect(recortarTexto("a".repeat(30), 10)).toBe(`${"a".repeat(10)}…`);
  });

  it("no parte emojis", () => {
    expect(recortarTexto("🚧".repeat(12), 10)).toBe(`${"🚧".repeat(10)}…`);
  });
});
