import {
  BOTON_CHICO,
  CAMPO as CAMPO_COMUN,
  FOCO,
} from "@/components/ui/estilos";

// Clases compartidas por las páginas y los formularios de administración.
// Van aparte porque un componente de servidor no puede importar valores
// (que no sean componentes) de un archivo "use client".

export const BOTON_PRINCIPAL = `inline-flex min-h-11 items-center justify-center rounded-(--radio-control) bg-(--primario) px-4 py-2 font-bold text-(--sobre-primario) disabled:opacity-60 ${FOCO}`;

export const BOTON_SECUNDARIO = BOTON_CHICO;

export const BOTON_PELIGRO = `inline-flex min-h-11 items-center justify-center rounded-(--radio-control) bg-red-700 px-4 py-2 font-bold text-white disabled:opacity-60 dark:bg-red-600 ${FOCO}`;

export const ENLACE_PELIGRO = `inline-flex min-h-11 items-center rounded-(--radio-control) border-2 border-red-700 px-3 py-2 text-sm font-semibold text-red-700 dark:border-red-400 dark:text-red-400 ${FOCO}`;

export const CAMPO = CAMPO_COMUN;
