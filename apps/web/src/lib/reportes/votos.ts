import { z } from "zod";

// Votos «Me afecta» / «No me afecta». La base (votar_reporte) es la que
// decide: estas funciones solo validan lo que se envía y calculan lo que
// se muestra mientras llega su respuesta.

// 1 = me afecta, -1 = no me afecta (como reporte_votos.valor).
export type Voto = 1 | -1;

export type TotalesVotos = { me_afecta: number; no_me_afecta: number };

// Qué puede hacer quien mira: sin sesión o como autor solo ve los totales.
export type Participacion =
  | { tipo: "sin_sesion" }
  | { tipo: "autor" }
  | { tipo: "votante"; voto: Voto | null };

export const esquemaVoto = z.object({
  reporteId: z.uuid({ error: "El reporte no es válido." }),
  // null quita el voto.
  voto: z.union([z.literal(1), z.literal(-1), z.null()], {
    error: "El voto no es válido.",
  }),
});

// La app envía el voto deseado, no "alternar": tocar la opción ya elegida
// la quita y tocar la otra la cambia.
export function siguienteVoto(actual: Voto | null, pulsado: Voto): Voto | null {
  return actual === pulsado ? null : pulsado;
}

const cuenta = (voto: Voto | null, valor: Voto) => (voto === valor ? 1 : 0);

// Totales que se muestran al instante, antes de que la base confirme. Nunca
// negativos, aunque los totales de partida estén desactualizados.
export function totalesTrasVoto(
  totales: TotalesVotos,
  anterior: Voto | null,
  nuevo: Voto | null,
): TotalesVotos {
  return {
    me_afecta: Math.max(
      0,
      totales.me_afecta - cuenta(anterior, 1) + cuenta(nuevo, 1),
    ),
    no_me_afecta: Math.max(
      0,
      totales.no_me_afecta - cuenta(anterior, -1) + cuenta(nuevo, -1),
    ),
  };
}

type ErrorBase = { code?: string; hint?: string };

const POR_PISTA: Record<string, string> = {
  sin_sesion: "Tu sesión terminó. Vuelve a ingresar para votar.",
  no_existe:
    "No pudimos guardar tu voto: este reporte ya no está publicado. Vuelve al mapa para ver los vigentes.",
  reporte_propio: "No puedes votar tu propio reporte.",
  limite_frecuencia:
    "Alcanzaste el límite de 60 votos por hora. Inténtalo de nuevo más tarde.",
};

export const ERROR_VOTO_GENERICO =
  "No pudimos guardar tu voto. Revisa tu conexión e inténtalo de nuevo.";

export function mensajeDeErrorVoto(error: ErrorBase): string {
  if (error.hint && Object.hasOwn(POR_PISTA, error.hint)) {
    return POR_PISTA[error.hint]!;
  }
  return ERROR_VOTO_GENERICO;
}

// Aviso del detalle tras sumar un «Me afecta» desde los posibles duplicados
// de /reportar (?aviso=me_afecta). Solo se muestra este texto conocido,
// nunca el valor de la URL.
export const AVISO_ME_AFECTA = {
  codigo: "me_afecta",
  texto:
    "Sumamos tu «Me afecta» a este reporte. No necesitas enviar uno nuevo.",
} as const;

// "1 voto", "1.024 votos".
export function textoVotos(cantidad: number): string {
  const numero = cantidad.toLocaleString("es-CL");
  return cantidad === 1 ? `${numero} voto` : `${numero} votos`;
}
