import { describe, expect, it } from "vitest";

import { RUTA_TRAS_INGRESO, rutaSegura } from "./redireccion";

describe("rutaSegura", () => {
  it.each([
    ["/perfil", "/perfil"],
    ["/perfil?x=1", "/perfil?x=1"],
    ["/a/b#seccion", "/a/b#seccion"],
    ["/", "/"],
    ["/a/../perfil", "/perfil"],
  ])("acepta la ruta interna %s", (ruta, esperada) => {
    expect(rutaSegura(ruta)).toBe(esperada);
  });

  it.each([
    ["URL absoluta", "https://malicioso.example/perfil"],
    ["protocolo relativo", "//malicioso.example"],
    ["barra invertida", "/\\malicioso.example"],
    ["barra invertida inicial", "\\\\malicioso.example"],
    ["tabulación", "/\t/malicioso.example"],
    ["salto de línea", "/perfil\nSet-Cookie: x=1"],
    ["javascript:", "javascript:alert(1)"],
    ["sin barra inicial", "perfil"],
    ["vacío", ""],
    ["demasiado larga", "/" + "a".repeat(600)],
  ])("rechaza %s", (_caso, ruta) => {
    expect(rutaSegura(ruta)).toBe(RUTA_TRAS_INGRESO);
  });

  it("usa el valor por defecto si no es un string", () => {
    expect(rutaSegura(null)).toBe(RUTA_TRAS_INGRESO);
    expect(rutaSegura(undefined, "/")).toBe("/");
  });
});
