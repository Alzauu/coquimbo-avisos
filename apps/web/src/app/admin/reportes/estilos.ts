// Clases compartidas por las páginas y los formularios de administración.
// Van aparte porque un componente de servidor no puede importar valores
// (que no sean componentes) de un archivo "use client".

export const BOTON_PRINCIPAL =
  "inline-flex min-h-11 items-center justify-center rounded-md bg-zinc-900 px-4 py-2 font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900";

export const BOTON_SECUNDARIO =
  "inline-flex min-h-11 items-center rounded-md border border-zinc-400 px-3 py-2 text-sm font-medium disabled:opacity-60 dark:border-zinc-600";

export const BOTON_PELIGRO =
  "inline-flex min-h-11 items-center justify-center rounded-md bg-red-700 px-4 py-2 font-medium text-white disabled:opacity-60 dark:bg-red-600";

export const ENLACE_PELIGRO =
  "inline-flex min-h-11 items-center rounded-md border border-red-700 px-3 py-2 text-sm font-medium text-red-700 dark:border-red-400 dark:text-red-400";

export const CAMPO =
  "min-h-11 rounded-md border border-zinc-400 bg-transparent px-3 py-2 dark:border-zinc-600";
