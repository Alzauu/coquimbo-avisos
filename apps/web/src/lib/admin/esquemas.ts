import { z } from "zod";

import { motivoObligatorio } from "@/lib/moderacion/esquemas";
import { ESTADOS_PUBLICOS } from "@/lib/reportes/presentacion";

// Validaciones de las acciones de administración. Los campos del reporte
// se validan con esquemaReporte, el mismo del formulario de reportar; aquí
// solo va lo propio de cada acción. La base vuelve a validar todo.

const idReporte = z.uuid("El reporte no es válido.");

// Lo que acompaña a los campos del reporte al editar.
export const esquemaMetaEdicion = z.object({
  reporte_id: idReporte,
  // actualizado_en tal como lo entregó la base: se devuelve sin tocar.
  version: z.string("Falta la versión.").min(1).max(64),
  estado: z.enum(ESTADOS_PUBLICOS, "Elige un estado de la lista."),
});

export const esquemaArchivo = z.object({ reporte_id: idReporte });

export const esquemaEliminacion = z.object({
  reporte_id: idReporte,
  motivo: motivoObligatorio,
  confirmacion: z.literal(
    "si",
    "Marca la casilla para confirmar que entiendes que no se puede deshacer.",
  ),
});

// Rutas que devuelve eliminar_reporte: "<usuario>/<reporte>/<uuid>.webp".
// Se validan antes de pedir a Storage que las borre.
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const RUTA_FOTO = new RegExp(`^${UUID}/${UUID}/${UUID}\\.webp$`);

export const esquemaRutasFotos = z
  .array(z.string().regex(RUTA_FOTO, "Ruta de foto no válida."))
  .max(50, "Demasiados archivos.");
