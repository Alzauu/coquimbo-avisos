import { describe, expect, it } from "vitest";

import {
  CATEGORIAS,
  categoriaDe,
  imagenDeCategoria,
  ordenDeCategoria,
  RADIO_DUPLICADOS_DEFECTO,
  RADIO_DUPLICADOS_MAX,
  RADIO_DUPLICADOS_MIN,
  radioDuplicados,
} from "./categorias";

// Contraste WCAG entre dos colores #rrggbb.
function contraste(a: string, b: string) {
  const luminancia = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    }) as [number, number, number];
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [claro, oscuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (claro! + 0.05) / (oscuro! + 0.05);
}

describe("catálogo de categorías", () => {
  it("tiene las ocho categorías, en orden", () => {
    expect(CATEGORIAS.map((c) => c.nombre)).toEqual([
      "Calles",
      "Basura",
      "Filtración o alcantarillado",
      "Áreas verdes",
      "Vehículos",
      "Iluminación",
      "Veredas",
      "Otros",
    ]);
  });

  it("no repite códigos ni colores", () => {
    expect(new Set(CATEGORIAS.map((c) => c.codigo)).size).toBe(8);
    expect(new Set(CATEGORIAS.map((c) => c.color.toLowerCase())).size).toBe(8);
  });

  it.each(CATEGORIAS.map((c) => [c.nombre, c.color]))(
    "%s deja el ícono blanco legible (contraste ≥ 4,5:1) y se ve sobre el mapa claro",
    (_nombre, color) => {
      expect(contraste(color, "#ffffff")).toBeGreaterThanOrEqual(4.5);
      expect(contraste(color, "#f2efe9")).toBeGreaterThanOrEqual(3);
    },
  );

  it("todas tienen ícono menos Otros, que es el punto", () => {
    for (const categoria of CATEGORIAS) {
      if (categoria.codigo === "otros") {
        expect(categoria.trazos).toBeNull();
      } else {
        expect(categoria.trazos?.length).toBeGreaterThan(0);
        for (const d of categoria.trazos ?? []) expect(d).toMatch(/^M/);
      }
    }
  });
});

describe("categoriaDe e imagenDeCategoria", () => {
  it("una categoría desconocida o ausente cae en Otros", () => {
    for (const codigo of ["semaforo", "", null, undefined, "toString"]) {
      expect(categoriaDe(codigo).codigo).toBe("otros");
      expect(imagenDeCategoria(codigo)).toBe("categoria-otros");
    }
    expect(imagenDeCategoria("veredas")).toBe("categoria-veredas");
  });

  it("ordena según el catálogo y deja lo desconocido al final", () => {
    expect(ordenDeCategoria("calles")).toBe(0);
    expect(ordenDeCategoria("otros")).toBe(7);
    expect(ordenDeCategoria("semaforo")).toBe(8);
  });
});

describe("radioDuplicados", () => {
  it("usa 75 m por defecto y el radio propio de cada categoría", () => {
    expect(RADIO_DUPLICADOS_DEFECTO).toBe(75);
    expect(radioDuplicados("calles")).toBe(75);
    expect(radioDuplicados("vehiculos")).toBe(40);
    expect(radioDuplicados("areas_verdes")).toBe(100);
  });

  it("una categoría desconocida usa el radio de Otros", () => {
    for (const codigo of ["semaforo", null, undefined, "toString"]) {
      expect(radioDuplicados(codigo)).toBe(radioDuplicados("otros"));
    }
  });

  it("todos los radios caben en el rango que acepta la base", () => {
    for (const { codigo } of CATEGORIAS) {
      const radio = radioDuplicados(codigo);
      expect(radio).toBeGreaterThanOrEqual(RADIO_DUPLICADOS_MIN);
      expect(radio).toBeLessThanOrEqual(RADIO_DUPLICADOS_MAX);
    }
  });
});
