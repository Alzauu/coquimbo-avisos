import { z } from "zod";

import { largo, sinControles, textoLargo } from "@/lib/reportes/esquemas";
import { ESTADOS_PUBLICOS } from "@/lib/reportes/presentacion";

// Validaciones de las acciones de moderación. La base vuelve a validar
// (validar_nota_moderacion); estos límites deben coincidir con los suyos.
export const LARGO_MOTIVO = { min: 5, max: 500 } as const;

const MENSAJE_LARGO_MOTIVO = `El motivo debe tener entre ${LARGO_MOTIVO.min} y ${LARGO_MOTIVO.max} caracteres.`;

const textoMotivo = z
  .string()
  .refine((t) => largo(t) >= LARGO_MOTIVO.min && largo(t) <= LARGO_MOTIVO.max, {
    error: MENSAJE_LARGO_MOTIVO,
  })
  .refine((t) => sinControles(t, true), {
    error: "El motivo tiene caracteres no permitidos.",
  });

const motivoObligatorio = z.preprocess(
  (valor) => textoLargo(valor ?? ""),
  textoMotivo,
);

// Vacío o ausente equivale a "sin motivo".
const motivoOpcional = z.preprocess((valor) => {
  const limpio = textoLargo(valor ?? "");
  return limpio === "" ? null : limpio;
}, textoMotivo.nullable());

const idReporte = z.uuid("El reporte no es válido.");

// Desde dónde se modera: decide a qué página se vuelve.
export const ORIGENES = ["panel", "detalle"] as const;
export type Origen = (typeof ORIGENES)[number];

export const esquemaAprobacion = z.object({ reporte_id: idReporte });

export const esquemaRechazo = z.object({
  reporte_id: idReporte,
  motivo: motivoObligatorio,
});

export const esquemaOcultarReporte = z.object({
  reporte_id: idReporte,
  motivo: motivoOpcional,
});

export const esquemaOcultarFoto = z.object({
  reporte_id: idReporte,
  foto_id: z.coerce
    .number("La foto no es válida.")
    .int("La foto no es válida.")
    .positive("La foto no es válida."),
  origen: z.enum(ORIGENES, "Origen no válido."),
});

export const esquemaCambioEstado = z.object({
  reporte_id: idReporte,
  estado: z.enum(ESTADOS_PUBLICOS, "Elige un estado de la lista."),
});
