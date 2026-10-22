import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const verifyOtp = vi.fn();
const exchangeCodeForSession = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { verifyOtp, exchangeCodeForSession } }),
}));

// redirect() de Next.js lanza una excepción; aquí la imitamos con la ruta.
class Redireccion extends Error {
  constructor(readonly destino: string) {
    super(destino);
  }
}

vi.mock("next/navigation", () => ({
  redirect: (destino: string) => {
    throw new Redireccion(destino);
  },
}));

const ERROR_ENLACE = "/ingresar?error=enlace";

async function destinoDe(parametros: Record<string, string>) {
  const url = new URL("http://localhost:3000/auth/confirmar");
  for (const [clave, valor] of Object.entries(parametros)) {
    url.searchParams.set(clave, valor);
  }
  try {
    await GET(new NextRequest(url));
  } catch (error) {
    if (error instanceof Redireccion) return error.destino;
    throw error;
  }
  throw new Error("GET no redirigió");
}

beforeEach(() => {
  verifyOtp.mockReset().mockResolvedValue({ error: null });
  exchangeCodeForSession.mockReset().mockResolvedValue({ error: null });
});

describe("GET /auth/confirmar con token_hash", () => {
  it("verifica el token y redirige a siguiente", async () => {
    const destino = await destinoDe({
      token_hash: "abc",
      type: "email",
      siguiente: "/perfil?x=1",
    });
    expect(verifyOtp).toHaveBeenCalledWith({
      type: "email",
      token_hash: "abc",
    });
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(destino).toBe("/perfil?x=1");
  });

  it("ignora un siguiente externo", async () => {
    const destino = await destinoDe({
      token_hash: "abc",
      type: "magiclink",
      siguiente: "//malicioso.example",
    });
    expect(destino).toBe("/perfil");
  });

  it("muestra error si el token no es válido", async () => {
    verifyOtp.mockResolvedValue({ error: new Error("otp_expired") });
    expect(await destinoDe({ token_hash: "abc", type: "email" })).toBe(
      ERROR_ENLACE,
    );
  });

  it("rechaza un type no permitido sin llamar a Supabase", async () => {
    expect(await destinoDe({ token_hash: "abc", type: "recovery" })).toBe(
      ERROR_ENLACE,
    );
    expect(verifyOtp).not.toHaveBeenCalled();
  });
});

describe("GET /auth/confirmar con code", () => {
  it("canjea el código y redirige a siguiente", async () => {
    const destino = await destinoDe({ code: "xyz", siguiente: "/perfil" });
    expect(exchangeCodeForSession).toHaveBeenCalledWith("xyz");
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(destino).toBe("/perfil");
  });

  it("ignora un siguiente externo", async () => {
    const destino = await destinoDe({
      code: "xyz",
      siguiente: "https://malicioso.example",
    });
    expect(destino).toBe("/perfil");
  });

  it("muestra error si el código no es válido", async () => {
    exchangeCodeForSession.mockResolvedValue({
      error: new Error("invalid_grant"),
    });
    expect(await destinoDe({ code: "xyz" })).toBe(ERROR_ENLACE);
  });
});

describe("GET /auth/confirmar sin credenciales", () => {
  it("muestra error si no hay token_hash ni code", async () => {
    expect(await destinoDe({ siguiente: "/perfil" })).toBe(ERROR_ENLACE);
  });

  it("muestra error si Supabase redirige con un error", async () => {
    const destino = await destinoDe({
      error: "access_denied",
      error_code: "otp_expired",
    });
    expect(destino).toBe(ERROR_ENLACE);
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
  });
});
