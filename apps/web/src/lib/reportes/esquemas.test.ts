import { describe, expect, it } from "vitest";

import {
  erroresDeValidacion,
  esquemaFotos,
  esquemaReporte,
  estaEnLaSerena,
  LARGO_DESCRIPCION_MAX,
  LARGO_REFERENCIA_MAX,
  LARGO_TITULO,
  MAX_BYTES_FOTO_ENVIADA,
  RECTANGULO_LA_SERENA,
} from "./esquemas";

// Así llegan los campos desde el formulario: todo como texto.
const valido = {
  categoria_id: "1",
  titulo: "Bache en la esquina",
  descripcion: "Hoyo grande en la pista derecha.",
  direccion_referencia: "Frente al colegio",
  latitud: "-29.905",
  longitud: "-71.25",
};

function errores(datos: Record<string, unknown>) {
  return erroresDeValidacion(esquemaReporte.safeParse(datos).error, undefined);
}

describe("esquemaReporte", () => {
  it("acepta un reporte válido y convierte los números", () => {
    expect(esquemaReporte.parse(valido)).toEqual({
      categoria_id: 1,
      titulo: "Bache en la esquina",
      descripcion: "Hoyo grande en la pista derecha.",
      direccion_referencia: "Frente al colegio",
      latitud: -29.905,
      longitud: -71.25,
    });
  });

  it("recorta el título y junta espacios repetidos", () => {
    const { titulo } = esquemaReporte.parse({
      ...valido,
      titulo: "  Bache   en   la  esquina  ",
    });
    expect(titulo).toBe("Bache en la esquina");
  });

  it("conserva los saltos de línea de la descripción", () => {
    const { descripcion } = esquemaReporte.parse({
      ...valido,
      descripcion: " Línea 1\r\nLínea 2 ",
    });
    expect(descripcion).toBe("Línea 1\nLínea 2");
  });

  it.each(["descripcion", "direccion_referencia"])(
    "trata %s vacía o ausente como null",
    (campo) => {
      expect(
        esquemaReporte.parse({ ...valido, [campo]: "   " })[
          campo as "descripcion"
        ],
      ).toBeNull();
      expect(
        esquemaReporte.parse({ ...valido, [campo]: null })[
          campo as "descripcion"
        ],
      ).toBeNull();
    },
  );

  describe("largos (en caracteres, no en unidades UTF-16)", () => {
    it.each([
      ["título mínimo", "titulo", "a".repeat(LARGO_TITULO.min), true],
      ["título corto", "titulo", "a".repeat(LARGO_TITULO.min - 1), false],
      ["título máximo", "titulo", "ñ".repeat(LARGO_TITULO.max), true],
      ["título largo", "titulo", "ñ".repeat(LARGO_TITULO.max + 1), false],
      ["título con emojis", "titulo", "🚧".repeat(LARGO_TITULO.max), true],
      [
        "descripción máxima",
        "descripcion",
        "a".repeat(LARGO_DESCRIPCION_MAX),
        true,
      ],
      [
        "descripción larga",
        "descripcion",
        "a".repeat(LARGO_DESCRIPCION_MAX + 1),
        false,
      ],
      [
        "referencia máxima",
        "direccion_referencia",
        "a".repeat(LARGO_REFERENCIA_MAX),
        true,
      ],
      [
        "referencia larga",
        "direccion_referencia",
        "a".repeat(LARGO_REFERENCIA_MAX + 1),
        false,
      ],
    ])("%s", (_caso, campo, valor, aceptado) => {
      expect(
        esquemaReporte.safeParse({ ...valido, [campo]: valor }).success,
      ).toBe(aceptado);
    });
  });

  it.each([
    ["título con carácter de control", "titulo", "Bache\u0000 oculto"],
    ["título con inversión de texto", "titulo", "Bache ‮oculto"],
    [
      "referencia con salto de línea oculto",
      "direccion_referencia",
      "Calle\u0007",
    ],
  ])("rechaza %s", (_caso, campo, valor) => {
    expect(
      esquemaReporte.safeParse({ ...valido, [campo]: valor }).success,
    ).toBe(false);
  });

  it.each(["", "0", "-1", "1.5", "abc", null])(
    "pide elegir una categoría si llega %s",
    (categoria) => {
      expect(errores({ ...valido, categoria_id: categoria })).toEqual({
        categoria_id: "Elige una categoría.",
      });
    },
  );

  describe("ubicación dentro del rectángulo provisorio de La Serena", () => {
    const r = RECTANGULO_LA_SERENA;

    it.each([
      ["esquina suroeste", r.sur, r.oeste],
      ["esquina noreste", r.norte, r.este],
      ["Plaza de Armas", -29.9027, -71.252],
    ])("acepta %s (bordes incluidos)", (_caso, latitud, longitud) => {
      expect(
        esquemaReporte.safeParse({
          ...valido,
          latitud: String(latitud),
          longitud: String(longitud),
        }).success,
      ).toBe(true);
    });

    it.each([
      ["Santiago", "-33.4378", "-70.6506"],
      ["apenas al oeste", "-29.9", String(r.oeste - 0.0001)],
      ["apenas al norte", String(r.norte + 0.0001), "-71.25"],
      ["latitud y longitud invertidas", "-71.25", "-29.905"],
    ])("rechaza %s", (_caso, latitud, longitud) => {
      expect(errores({ ...valido, latitud, longitud })).toEqual({
        ubicacion:
          "La ubicación está fuera de La Serena. Por ahora solo recibimos reportes de La Serena.",
      });
    });

    it.each([
      ["vacía", ""],
      ["no numérica", "abc"],
      ["infinita", "Infinity"],
      ["ausente", undefined],
    ])("rechaza una coordenada %s", (_caso, latitud) => {
      expect(Object.keys(errores({ ...valido, latitud }))).toEqual([
        "ubicacion",
      ]);
    });
  });

  it("estaEnLaSerena coincide con el rectángulo", () => {
    expect(estaEnLaSerena({ latitud: -29.9, longitud: -71.25 })).toBe(true);
    expect(estaEnLaSerena({ latitud: -29.9, longitud: -70.6 })).toBe(false);
  });
});

describe("esquemaFotos", () => {
  const foto = (bytes: number, tipo = "image/jpeg") =>
    new File([new Uint8Array(bytes)], "foto.jpg", { type: tipo });

  it("acepta de 0 a 3 fotos", () => {
    expect(esquemaFotos.safeParse([]).success).toBe(true);
    expect(esquemaFotos.safeParse([foto(10), foto(10), foto(10)]).success).toBe(
      true,
    );
  });

  it("rechaza una cuarta foto", () => {
    const resultado = esquemaFotos.safeParse([
      foto(10),
      foto(10),
      foto(10),
      foto(10),
    ]);
    expect(erroresDeValidacion(undefined, resultado.error)).toEqual({
      fotos: "Puedes subir hasta 3 fotos.",
    });
  });

  it.each(["image/jpeg", "image/png", "image/webp"])("acepta %s", (tipo) => {
    expect(esquemaFotos.safeParse([foto(10, tipo)]).success).toBe(true);
  });

  it.each(["image/gif", "image/svg+xml", "application/pdf", ""])(
    "rechaza el tipo «%s»",
    (tipo) => {
      expect(esquemaFotos.safeParse([foto(10, tipo)]).success).toBe(false);
    },
  );

  it("acepta una foto en el límite de peso y rechaza una más pesada", () => {
    expect(esquemaFotos.safeParse([foto(MAX_BYTES_FOTO_ENVIADA)]).success).toBe(
      true,
    );
    expect(
      esquemaFotos.safeParse([foto(MAX_BYTES_FOTO_ENVIADA + 1)]).success,
    ).toBe(false);
  });

  it("rechaza algo que no es un archivo", () => {
    expect(esquemaFotos.safeParse(["foto.jpg"]).success).toBe(false);
  });
});
