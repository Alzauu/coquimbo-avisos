import { describe, expect, it } from "vitest";

import {
  argumentosDeFiltros,
  consultaDeFiltros,
  leerFiltros,
  MODERACIONES,
  rutaDeLista,
} from "./filtros";

describe("leerFiltros", () => {
  it("sin parámetros usa los valores predeterminados", () => {
    expect(leerFiltros({})).toEqual({
      q: "",
      moderacion: undefined,
      estado: undefined,
      categoria: undefined,
      pagina: 1,
    });
  });

  it("lee filtros válidos", () => {
    expect(
      leerFiltros({
        q: "  bache   grande ",
        moderacion: "archivado",
        estado: "resuelto",
        categoria: "3",
        pagina: "2",
      }),
    ).toEqual({
      q: "bache grande",
      moderacion: "archivado",
      estado: "resuelto",
      categoria: 3,
      pagina: 2,
    });
  });

  it("ignora valores no válidos en vez de fallar", () => {
    expect(
      leerFiltros({
        moderacion: "borrado",
        estado: "rechazado",
        categoria: "abc",
        pagina: "-4",
      }),
    ).toEqual({
      q: "",
      moderacion: undefined,
      estado: undefined,
      categoria: undefined,
      pagina: 1,
    });
    expect(leerFiltros({ pagina: "99999" }).pagina).toBe(1);
    expect(leerFiltros({ categoria: "0" }).categoria).toBeUndefined();
  });

  it("usa el primer valor si un parámetro viene repetido", () => {
    expect(leerFiltros({ estado: ["derivado", "resuelto"] }).estado).toBe(
      "derivado",
    );
  });

  it("recorta una búsqueda larga a 100 caracteres, sin partir emojis", () => {
    expect(leerFiltros({ q: "x".repeat(150) }).q).toHaveLength(100);
    expect(Array.from(leerFiltros({ q: "🚧".repeat(150) }).q)).toHaveLength(
      100,
    );
  });
});

describe("argumentosDeFiltros", () => {
  it("sin filtro de moderación deja que la base omita los archivados", () => {
    expect(argumentosDeFiltros(leerFiltros({}))).toEqual({
      busqueda: undefined,
      moderaciones: undefined,
      estados: undefined,
      categoria: undefined,
      pagina: 1,
    });
  });

  it("«todas» incluye los archivados; un valor filtra solo ese", () => {
    expect(
      argumentosDeFiltros(leerFiltros({ moderacion: "todas" })).moderaciones,
    ).toEqual([...MODERACIONES]);
    expect(
      argumentosDeFiltros(leerFiltros({ moderacion: "pendiente", q: "luz" })),
    ).toMatchObject({ busqueda: "luz", moderaciones: ["pendiente"] });
  });
});

describe("consultaDeFiltros y rutaDeLista", () => {
  it("omite los valores predeterminados y aplica cambios", () => {
    const filtros = leerFiltros({ q: "luz", pagina: "3" });
    expect(consultaDeFiltros(filtros)).toBe("q=luz&pagina=3");
    expect(consultaDeFiltros(filtros, { pagina: 1 })).toBe("q=luz");
    expect(consultaDeFiltros(leerFiltros({}))).toBe("");
  });

  it("siempre vuelve a la lista y descarta lo que no es un filtro", () => {
    expect(rutaDeLista("q=luz&pagina=2", "archivado")).toBe(
      "/admin/reportes?q=luz&pagina=2&aviso=archivado",
    );
    expect(rutaDeLista("siguiente=https://otro.sitio&estado=nada")).toBe(
      "/admin/reportes",
    );
    expect(rutaDeLista(null, "eliminado")).toBe(
      "/admin/reportes?aviso=eliminado",
    );
  });
});
