import type { CampoReporte } from "@/lib/reportes/esquemas";

// Textos de administración: errores de la base traducidos y avisos de
// éxito (?aviso=<código> al volver de una acción).

type ErrorBase = { code?: string; hint?: string };

const POR_PISTA: Record<string, string> = {
  modificado:
    "Otra persona cambió este reporte mientras lo editabas. Recarga la página para ver la versión actual y vuelve a aplicar tus cambios.",
  no_existe:
    "El reporte ya no existe. Puede que otra persona lo haya eliminado.",
  ya_archivado: "El reporte ya estaba archivado.",
  no_archivado: "El reporte ya no está archivado.",
  titulo_invalido: "El título debe tener entre 5 y 140 caracteres.",
  descripcion_invalida: "La descripción puede tener hasta 1000 caracteres.",
  referencia_invalida: "La referencia puede tener hasta 200 caracteres.",
  estado_invalido: "Elige un estado de la lista.",
  categoria_invalida: "Elige una categoría de la lista.",
  fuera_de_comuna: "La ubicación está fuera de La Serena.",
  motivo_invalido: "El motivo debe tener entre 5 y 500 caracteres.",
  busqueda_invalida: "La búsqueda puede tener hasta 100 caracteres.",
  pagina_invalida: "Esa página no existe.",
};

// Errores de la base que corresponden a un campo del formulario de edición.
export const CAMPO_POR_PISTA: Partial<Record<string, CampoReporte>> = {
  titulo_invalido: "titulo",
  descripcion_invalida: "descripcion",
  referencia_invalida: "direccion_referencia",
  categoria_invalida: "categoria_id",
  fuera_de_comuna: "ubicacion",
};

export function mensajeDeErrorAdmin(error: ErrorBase): string {
  if (error.hint && Object.hasOwn(POR_PISTA, error.hint)) {
    return POR_PISTA[error.hint]!;
  }
  if (error.code === "42501") {
    return "No tienes permiso de administración. Si crees que es un error, vuelve a ingresar.";
  }
  return "No pudimos guardar el cambio. Inténtalo de nuevo en unos minutos.";
}

export const AVISOS_ADMIN = {
  editado: "Cambios guardados.",
  archivado: "Reporte archivado: ya no se muestra en el mapa público.",
  restaurado: "Reporte restaurado a su estado anterior.",
  eliminado: "Reporte eliminado definitivamente, con sus fotos.",
} as const;

export type CodigoAvisoAdmin = keyof typeof AVISOS_ADMIN;

// Texto del aviso, solo si el código es uno de los conocidos.
export function textoDeAvisoAdmin(codigo: unknown): string | null {
  return typeof codigo === "string" && Object.hasOwn(AVISOS_ADMIN, codigo)
    ? AVISOS_ADMIN[codigo as CodigoAvisoAdmin]
    : null;
}
