import { describe, expect, it } from "vitest";

import {
  datosParaCompartir,
  enlaceWhatsApp,
  LARGO_TITULO_IMAGEN,
  type ReporteCompartible,
  resumenParaCompartir,
  textoMeAfecta,
  textoParaCompartir,
} from "./compartir";

const REPORTE: ReporteCompartible = {
  titulo: "Bache profundo frente al colegio",
  categoriaNombre: "Calles",
  categoriaCodigo: "calles",
  estado: "recibido",
  direccion_referencia: "Av. del Mar, frente al Faro",
  me_afecta: 3,
};

describe("textoMeAfecta", () => {
  it("omite el cero y usa singular y plural", () => {
    expect(textoMeAfecta(0)).toBeNull();
    expect(textoMeAfecta(1)).toBe("1 persona dice «Me afecta»");
    expect(textoMeAfecta(1500)).toBe("1.500 personas dicen «Me afecta»");
  });
});

describe("resumenParaCompartir", () => {
  it("junta categoría, estado y votos", () => {
    expect(resumenParaCompartir(REPORTE)).toBe(
      "Calles · Recibido · 3 personas dicen «Me afecta»",
    );
  });

  it("sin votos ni categoría conocida no deja huecos", () => {
    expect(
      resumenParaCompartir({
        ...REPORTE,
        categoriaNombre: null,
        me_afecta: 0,
      }),
    ).toBe("Reporte vecinal · Recibido");
  });
});

describe("texto y enlace para compartir", () => {
  it("cita el título y nombra la app", () => {
    expect(textoParaCompartir("Luminaria apagada")).toMatch(
      /^«Luminaria apagada»: reporte vecinal en .+\.$/,
    );
  });

  it("el enlace de WhatsApp codifica texto y URL", () => {
    const enlace = enlaceWhatsApp(
      "«Calle & vereda»",
      "https://avisos.example.cl/reporte/1?x=1",
    );
    expect(enlace.startsWith("https://wa.me/?text=")).toBe(true);
    expect(decodeURIComponent(enlace.split("text=")[1]!)).toBe(
      "«Calle & vereda» https://avisos.example.cl/reporte/1?x=1",
    );
    expect(enlace).not.toContain("&vereda");
  });
});

describe("datosParaCompartir", () => {
  it("sin reporte (inexistente u oculto) entrega la imagen genérica", () => {
    expect(datosParaCompartir(null)).toEqual({ tipo: "generico" });
  });

  it("arma los datos de un reporte público", () => {
    expect(datosParaCompartir(REPORTE)).toMatchObject({
      tipo: "reporte",
      titulo: REPORTE.titulo,
      categoriaNombre: "Calles",
      estado: "Recibido",
      resuelto: false,
      referencia: "Av. del Mar, frente al Faro",
      meAfecta: "3 personas dicen «Me afecta»",
    });
  });

  it("recorta títulos largos y omite una referencia vacía", () => {
    const datos = datosParaCompartir({
      ...REPORTE,
      titulo: "palabra ".repeat(30).trim(),
      direccion_referencia: "   ",
      estado: "resuelto",
    });
    if (datos.tipo !== "reporte") throw new Error("esperaba un reporte");
    expect(Array.from(datos.titulo).length).toBeLessThanOrEqual(
      LARGO_TITULO_IMAGEN + 1,
    );
    expect(datos.titulo.endsWith("…")).toBe(true);
    expect(datos.referencia).toBeNull();
    expect(datos.resuelto).toBe(true);
  });

  it("una categoría desconocida usa la ficha de Otros", () => {
    const datos = datosParaCompartir({
      ...REPORTE,
      categoriaCodigo: "semaforo",
    });
    if (datos.tipo !== "reporte") throw new Error("esperaba un reporte");
    expect(datos.categoria.codigo).toBe("otros");
  });
});
