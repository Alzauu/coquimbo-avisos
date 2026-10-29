import { describe, expect, it } from "vitest";

import { urlBaseMetadatos, urlDelSitio } from "./sitio";

describe("urlDelSitio", () => {
  it("acepta URLs http y https", () => {
    expect(urlDelSitio("https://avisos.example.cl")?.origin).toBe(
      "https://avisos.example.cl",
    );
    expect(urlDelSitio("http://localhost:3000")?.origin).toBe(
      "http://localhost:3000",
    );
  });

  it("sin valor o con un valor inválido no entrega URL", () => {
    for (const valor of ["", "avisos.example.cl", "javascript:alert(1)"]) {
      expect(urlDelSitio(valor)).toBeUndefined();
    }
  });
});

describe("urlBaseMetadatos", () => {
  const SITIO = "https://avisos.example.cl";

  it("en producción usa NEXT_PUBLIC_SITIO_URL", () => {
    expect(
      urlBaseMetadatos({
        NEXT_PUBLIC_SITIO_URL: SITIO,
        VERCEL_ENV: "production",
        VERCEL_PROJECT_PRODUCTION_URL: "otro.vercel.app",
      })?.origin,
    ).toBe(SITIO);
  });

  it("en un preview usa la URL del preview, aunque haya sitio definido", () => {
    expect(
      urlBaseMetadatos({
        NEXT_PUBLIC_SITIO_URL: SITIO,
        VERCEL_ENV: "preview",
        VERCEL_BRANCH_URL: "app-git-rama.vercel.app",
        VERCEL_URL: "app-abc123.vercel.app",
      })?.origin,
    ).toBe("https://app-git-rama.vercel.app");
    expect(
      urlBaseMetadatos({
        VERCEL_ENV: "preview",
        VERCEL_URL: "app-abc.vercel.app",
      })?.origin,
    ).toBe("https://app-abc.vercel.app");
  });

  it("sin sitio definido usa el dominio de producción de Vercel", () => {
    expect(
      urlBaseMetadatos({
        VERCEL_ENV: "production",
        VERCEL_PROJECT_PRODUCTION_URL: "app.vercel.app",
      })?.origin,
    ).toBe("https://app.vercel.app");
  });

  it("en desarrollo, sin variables, no entrega URL", () => {
    expect(urlBaseMetadatos({})).toBeUndefined();
  });
});
