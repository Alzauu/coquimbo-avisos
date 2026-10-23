import { createHmac, timingSafeEqual } from "node:crypto";

import { DURACION_URL_FOTO } from "./respuesta";

// URLs propias y de corta duración para las fotos públicas:
// /fotos/<id>?exp=<segundos unix>&firma=<HMAC-SHA256 en base64url>, más
// &tam=m para la versión mediana. El tamaño va dentro de la firma: una
// URL de la mediana no sirve para pedir la completa, ni al revés.
// No llevan la ruta en Storage (que incluye el id del autor) y el
// vencimiento lo fija el servidor, no quien pide la URL.
// Funciones puras (el secreto se recibe como argumento) para poder
// probarlas sin variables de entorno.

export const TAMANOS_FOTO = ["completa", "mediana"] as const;
export type TamanoFoto = (typeof TAMANOS_FOTO)[number];

// Valor del parámetro tam en la URL (la completa no lo lleva).
const PARAMETRO_TAMANO: Record<TamanoFoto, string | null> = {
  completa: null,
  mediana: "m",
};

const mensaje = (fotoId: number, expira: number, tamano: TamanoFoto) =>
  `foto:${fotoId}:${expira}:${tamano}`;

export function firmarFoto(
  fotoId: number,
  expira: number,
  tamano: TamanoFoto,
  secreto: string,
): string {
  return createHmac("sha256", secreto)
    .update(mensaje(fotoId, expira, tamano))
    .digest("base64url");
}

// Ruta y parámetros de una URL ya firmada.
export function rutaFoto(
  fotoId: number,
  expira: number,
  tamano: TamanoFoto,
  firma: string,
): string {
  const tam = PARAMETRO_TAMANO[tamano];
  return `/fotos/${fotoId}?exp=${expira}&firma=${firma}${tam ? `&tam=${tam}` : ""}`;
}

export type ParametrosFoto = {
  fotoId: number;
  expira: number;
  tamano: TamanoFoto;
  firma: string;
};

// Lee el id de la ruta y los parámetros de la URL; null si no tienen
// la forma esperada.
export function leerParametrosFoto(
  id: string,
  exp: string | null,
  firma: string | null,
  tam: string | null,
): ParametrosFoto | null {
  if (!/^[1-9]\d{0,15}$/.test(id) || !exp || !/^\d{1,12}$/.test(exp)) {
    return null;
  }
  if (!firma || !/^[A-Za-z0-9_-]{43}$/.test(firma)) return null;
  const tamano = TAMANOS_FOTO.find((t) => PARAMETRO_TAMANO[t] === tam);
  if (!tamano) return null;
  return { fotoId: Number(id), expira: Number(exp), tamano, firma };
}

// La firma debe coincidir (comparación en tiempo constante) y la URL no
// debe haber vencido ni vencer más allá de lo que el servidor entrega.
export function verificarFirmaFoto(
  { fotoId, expira, tamano, firma }: ParametrosFoto,
  secreto: string,
  ahora = Math.floor(Date.now() / 1000),
): boolean {
  if (expira <= ahora || expira > ahora + DURACION_URL_FOTO) return false;
  const esperada = Buffer.from(firmarFoto(fotoId, expira, tamano, secreto));
  const recibida = Buffer.from(firma);
  return (
    esperada.length === recibida.length && timingSafeEqual(esperada, recibida)
  );
}
