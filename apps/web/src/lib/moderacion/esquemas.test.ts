import { describe, expect, it } from "vitest";

import {
  esquemaCambioEstado,
  esquemaOcultarFoto,
  esquemaOcultarReporte,
  esquemaRechazo,
} from "./esquemas";
import { mensajeDeErrorModeracion, textoDeAviso } from "./mensajes";

const ID = "5eed0000-0000-4000-8000-000000000001";

describe("esquemaRechazo", () => {
  it("exige un motivo de 5 a 500 caracteres, sin espacios sobrantes", () => {
    const ok = esquemaRechazo.safeParse({
      reporte_id: ID,
      motivo: "  Es un duplicado.\r\n ",
    });
    expect(ok.data).toEqual({ reporte_id: ID, motivo: "Es un duplicado." });

    for (const motivo of [undefined, "", "    ", "abcd", "x".repeat(501)]) {
      const fallo = esquemaRechazo.safeParse({ reporte_id: ID, motivo });
      expect(fallo.success, String(motivo)).toBe(false);
    }
    expect(
      esquemaRechazo.safeParse({ reporte_id: ID, motivo: "x".repeat(500) })
        .success,
    ).toBe(true);
  });

  it("cuenta caracteres, no unidades UTF-16", () => {
    const emojis = "🚧".repeat(500);
    expect(
      esquemaRechazo.safeParse({ reporte_id: ID, motivo: emojis }).success,
    ).toBe(true);
  });

  it("rechaza caracteres de control e ids no válidos", () => {
    expect(
      esquemaRechazo.safeParse({ reporte_id: ID, motivo: "Motivo‮oculto" })
        .success,
    ).toBe(false);
    expect(
      esquemaRechazo.safeParse({ reporte_id: "1", motivo: "Motivo válido" })
        .success,
    ).toBe(false);
  });
});

describe("esquemaOcultarReporte", () => {
  it("acepta un motivo vacío como null", () => {
    expect(
      esquemaOcultarReporte.safeParse({ reporte_id: ID, motivo: "  " }).data,
    ).toEqual({ reporte_id: ID, motivo: null });
  });

  it("si hay motivo, aplica el mismo largo", () => {
    expect(
      esquemaOcultarReporte.safeParse({ reporte_id: ID, motivo: "abc" })
        .success,
    ).toBe(false);
  });
});

describe("esquemaOcultarFoto y esquemaCambioEstado", () => {
  it("valida id de foto y origen", () => {
    expect(
      esquemaOcultarFoto.safeParse({
        reporte_id: ID,
        foto_id: "12",
        origen: "panel",
      }).data,
    ).toEqual({ reporte_id: ID, foto_id: 12, origen: "panel" });
    for (const foto_id of ["0", "-3", "1.5", "abc"]) {
      expect(
        esquemaOcultarFoto.safeParse({
          reporte_id: ID,
          foto_id,
          origen: "panel",
        }).success,
      ).toBe(false);
    }
    expect(
      esquemaOcultarFoto.safeParse({
        reporte_id: ID,
        foto_id: "12",
        origen: "https://otro.sitio",
      }).success,
    ).toBe(false);
  });

  it("no permite el estado rechazado", () => {
    expect(
      esquemaCambioEstado.safeParse({ reporte_id: ID, estado: "resuelto" })
        .success,
    ).toBe(true);
    expect(
      esquemaCambioEstado.safeParse({ reporte_id: ID, estado: "rechazado" })
        .success,
    ).toBe(false);
  });
});

describe("mensajes", () => {
  it("traduce los errores de la base", () => {
    expect(mensajeDeErrorModeracion({ hint: "ya_revisado" })).toMatch(
      /ya revisó/,
    );
    expect(
      mensajeDeErrorModeracion({ code: "42501", hint: "sin_permiso" }),
    ).toMatch(/No tienes permiso/);
    expect(mensajeDeErrorModeracion({ code: "XX000" })).toMatch(
      /No pudimos guardar/,
    );
  });

  it("solo muestra avisos conocidos", () => {
    expect(textoDeAviso("aprobado")).toMatch(/aprobado/);
    expect(textoDeAviso("toString")).toBeNull();
    expect(textoDeAviso("<script>")).toBeNull();
    expect(textoDeAviso(["aprobado"])).toBeNull();
  });
});
