import { describe, expect, it } from "vitest";
import { z } from "zod";

import { esquemaReporte } from "@/lib/reportes/esquemas";

import {
  esquemaArchivo,
  esquemaEliminacion,
  esquemaMetaEdicion,
  esquemaRutasFotos,
} from "./esquemas";
import { mensajeDeErrorAdmin, textoDeAvisoAdmin } from "./mensajes";

const ID = "5eed0000-0000-4000-8000-000000000001";
const VERSION = "2026-10-23T17:18:05.256042+00:00";

describe("esquemaMetaEdicion", () => {
  it("acepta el estado del problema y la versión tal cual", () => {
    expect(
      esquemaMetaEdicion.parse({
        reporte_id: ID,
        version: VERSION,
        estado: "derivado",
      }),
    ).toEqual({ reporte_id: ID, version: VERSION, estado: "derivado" });
  });

  it("rechaza el estado rechazado, una versión vacía y un id no válido", () => {
    for (const datos of [
      { reporte_id: ID, version: VERSION, estado: "rechazado" },
      { reporte_id: ID, version: "", estado: "recibido" },
      { reporte_id: "1", version: VERSION, estado: "recibido" },
    ]) {
      expect(esquemaMetaEdicion.safeParse(datos).success).toBe(false);
    }
  });
});

describe("esquemaEliminacion", () => {
  // Así llega desde el formulario: FormData.get devuelve null si falta.
  const valido = {
    reporte_id: ID,
    motivo: "Duplicado de otro reporte.",
    confirmacion: "si",
  };
  const campoConError = (datos: Record<string, unknown>) =>
    esquemaEliminacion.safeParse(datos).error?.issues.map((i) => i.path[0]);

  it("acepta datos válidos y limpia el motivo", () => {
    expect(
      esquemaEliminacion.parse({ ...valido, motivo: "  Duplicado.\r\n " }),
    ).toEqual({ ...valido, motivo: "Duplicado." });
    // Los límites exactos: 5 y 500 caracteres (no unidades UTF-16).
    for (const motivo of ["x".repeat(5), "x".repeat(500), "🚧".repeat(500)]) {
      expect(esquemaEliminacion.safeParse({ ...valido, motivo }).success).toBe(
        true,
      );
    }
  });

  it.each([
    ["vacío", ""],
    ["solo espacios", "     "],
    ["de 4 caracteres", "abcd"],
    ["de 501 caracteres", "x".repeat(501)],
    ["ausente", null],
  ])("rechaza un motivo %s", (_caso, motivo) => {
    expect(campoConError({ ...valido, motivo })).toEqual(["motivo"]);
  });

  it.each([
    ["ausente (casilla sin marcar)", null],
    ["con otro valor", "on"],
    ["vacía", ""],
  ])("rechaza la confirmación %s", (_caso, confirmacion) => {
    expect(campoConError({ ...valido, confirmacion })).toEqual([
      "confirmacion",
    ]);
  });

  it.each([
    ["no es un uuid", "1"],
    ["vacío", ""],
    ["ausente", null],
    ["con texto extra", `${ID}x`],
  ])("rechaza un id de reporte que %s", (_caso, reporte_id) => {
    expect(campoConError({ ...valido, reporte_id })).toEqual(["reporte_id"]);
  });

  it("da el mensaje del motivo y el de la casilla", () => {
    const resultado = esquemaEliminacion.safeParse({
      ...valido,
      motivo: "abc",
      confirmacion: null,
    });
    expect(resultado.error?.issues.map((i) => i.message)).toEqual([
      "El motivo debe tener entre 5 y 500 caracteres.",
      "Marca la casilla para confirmar que entiendes que no se puede deshacer.",
    ]);
  });
});

// Un import que llega como undefined (por ejemplo, un export renombrado o
// borrado en otro módulo) no falla al crear z.object, sino al validar por
// primera vez. Este test lo detecta antes.
describe("esquemas de las acciones de /admin", () => {
  it.each([
    ["esquemaMetaEdicion", esquemaMetaEdicion],
    ["esquemaArchivo", esquemaArchivo],
    ["esquemaEliminacion", esquemaEliminacion],
  ])("%s solo tiene esquemas de Zod en sus campos", (_nombre, esquema) => {
    for (const [campo, valor] of Object.entries(esquema.shape)) {
      expect(valor, campo).toBeInstanceOf(z.ZodType);
    }
  });

  it("esquemaRutasFotos y esquemaReporte se pueden usar", () => {
    expect(esquemaRutasFotos.safeParse([]).success).toBe(true);
    for (const [campo, valor] of Object.entries(esquemaReporte.shape)) {
      expect(valor, campo).toBeInstanceOf(z.ZodType);
    }
  });
});

describe("esquemaRutasFotos", () => {
  it("solo acepta rutas con la forma de las fotos de reportes", () => {
    const ruta = `${ID}/${ID}/${ID}.webp`;
    expect(esquemaRutasFotos.parse([ruta])).toEqual([ruta]);
    for (const otra of [
      `${ID}/${ID}.webp`,
      `../${ID}/${ID}/${ID}.webp`,
      `${ID}/${ID}/${ID}.png`,
      `${ID}/${ID}/${ID}.webp/x`,
    ]) {
      expect(esquemaRutasFotos.safeParse([otra]).success, otra).toBe(false);
    }
  });
});

describe("mensajes de administración", () => {
  it("traduce los errores de la base", () => {
    expect(mensajeDeErrorAdmin({ hint: "modificado" })).toMatch(/Recarga/);
    expect(mensajeDeErrorAdmin({ code: "42501" })).toMatch(/No tienes/);
    expect(mensajeDeErrorAdmin({ hint: "toString" })).toMatch(
      /No pudimos guardar/,
    );
  });

  it("solo muestra avisos conocidos", () => {
    expect(textoDeAvisoAdmin("eliminado")).toMatch(/eliminado/);
    expect(textoDeAvisoAdmin("constructor")).toBeNull();
    expect(textoDeAvisoAdmin(["editado"])).toBeNull();
  });
});
