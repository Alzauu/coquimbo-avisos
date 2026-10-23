// Textos de moderación: errores de la base traducidos y avisos de éxito
// (se pasan en la URL como ?aviso=<código> al volver de una acción).

type ErrorBase = { code?: string; hint?: string };

const POR_PISTA: Record<string, string> = {
  ya_revisado:
    "Otra persona ya revisó este reporte. Recarga la página para ver la lista al día.",
  motivo_invalido: "El motivo debe tener entre 5 y 500 caracteres.",
  foto_no_disponible: "La foto ya estaba oculta o ya no existe.",
  no_publicado: "El reporte ya no está publicado.",
  estado_invalido: "Elige un estado de la lista.",
};

export function mensajeDeErrorModeracion(error: ErrorBase): string {
  if (error.hint && error.hint in POR_PISTA) return POR_PISTA[error.hint]!;
  if (error.code === "42501") {
    return "No tienes permiso para moderar reportes. Si crees que es un error, vuelve a ingresar.";
  }
  return "No pudimos guardar la decisión. Inténtalo de nuevo en unos minutos.";
}

export const AVISOS_MODERACION = {
  aprobado: "Reporte aprobado: ya se muestra en el mapa público.",
  rechazado: "Reporte rechazado. Su autor verá el motivo en Mis reportes.",
  foto_oculta: "Foto ocultada: ya no se muestra al público.",
  reporte_oculto: "Reporte ocultado: ya no se muestra en el mapa público.",
  estado: "Estado del problema actualizado.",
} as const;

export type CodigoAviso = keyof typeof AVISOS_MODERACION;

// Texto del aviso, solo si el código es uno de los conocidos.
export function textoDeAviso(codigo: unknown): string | null {
  return typeof codigo === "string" && Object.hasOwn(AVISOS_MODERACION, codigo)
    ? AVISOS_MODERACION[codigo as CodigoAviso]
    : null;
}
