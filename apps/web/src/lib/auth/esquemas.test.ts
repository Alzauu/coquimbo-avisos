import { describe, expect, it } from "vitest";

import { esquemaCorreo, esquemaNombreVisible } from "./esquemas";

describe("esquemaCorreo", () => {
  it("acepta un correo y quita espacios", () => {
    expect(esquemaCorreo.parse("  vecina@example.cl ")).toBe(
      "vecina@example.cl",
    );
  });

  it.each(["", "sin-arroba", "a@b", null, 123])("rechaza %s", (valor) => {
    expect(esquemaCorreo.safeParse(valor).success).toBe(false);
  });
});

describe("esquemaNombreVisible", () => {
  it("normaliza espacios", () => {
    expect(esquemaNombreVisible.parse("  María   José ")).toBe("María José");
  });

  it("cuenta caracteres, no unidades UTF-16", () => {
    expect(esquemaNombreVisible.safeParse("🙂").success).toBe(false);
    expect(esquemaNombreVisible.safeParse("🙂🙂").success).toBe(true);
    expect(esquemaNombreVisible.safeParse("ñ".repeat(50)).success).toBe(true);
    expect(esquemaNombreVisible.safeParse("ñ".repeat(51)).success).toBe(false);
  });

  it.each([
    ["vacío", "   "],
    ["un carácter", "a"],
    ["carácter de control", "Ana\u0000"],
    ["inversión de texto", "Ana‮abc"],
  ])("rechaza %s", (_caso, valor) => {
    expect(esquemaNombreVisible.safeParse(valor).success).toBe(false);
  });
});
