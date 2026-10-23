import { createHmac, timingSafeEqual } from "node:crypto";

// URLs propias y de corta duración para las fotos públicas:
// /fotos/<id>?exp=<segundos unix>&firma=<HMAC-SHA256 en base64url>.
// No llevan la ruta en Storage (que incluye el id del autor) y el
// vencimiento lo fija el servidor, no quien pide la URL.
// Funciones puras (el secreto se recibe como argumento) para poder
// probarlas sin variables de entorno.

export const DURACION_URL_FOTO = 10 * 60; // segundos

const mensaje = (fotoId: number, expira: number) => `foto:${fotoId}:${expira}`;

export function firmarFoto(
  fotoId: number,
  expira: number,
  secreto: string,
): string {
  return createHmac("sha256", secreto)
    .update(mensaje(fotoId, expira))
    .digest("base64url");
}

export type ParametrosFoto = {
  fotoId: number;
  expira: number;
  firma: string;
};

// Lee el id de la ruta y los parámetros de la URL; null si no tienen
// la forma esperada.
export function leerParametrosFoto(
  id: string,
  exp: string | null,
  firma: string | null,
): ParametrosFoto | null {
  if (!/^[1-9]\d{0,15}$/.test(id) || !exp || !/^\d{1,12}$/.test(exp)) {
    return null;
  }
  if (!firma || !/^[A-Za-z0-9_-]{43}$/.test(firma)) return null;
  return { fotoId: Number(id), expira: Number(exp), firma };
}

// La firma debe coincidir (comparación en tiempo constante) y la URL no
// debe haber vencido ni vencer más allá de lo que el servidor entrega.
export function verificarFirmaFoto(
  { fotoId, expira, firma }: ParametrosFoto,
  secreto: string,
  ahora = Math.floor(Date.now() / 1000),
): boolean {
  if (expira <= ahora || expira > ahora + DURACION_URL_FOTO) return false;
  const esperada = Buffer.from(firmarFoto(fotoId, expira, secreto));
  const recibida = Buffer.from(firma);
  return (
    esperada.length === recibida.length && timingSafeEqual(esperada, recibida)
  );
}
