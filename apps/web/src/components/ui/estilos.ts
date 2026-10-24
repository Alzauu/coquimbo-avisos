// Clases comunes de la interfaz. Usan solo las variables de diseño de
// globals.css, así que cambian con el tema sin clases dark:. Van en un
// archivo sin "use client" para que también las usen los componentes de
// servidor.

export const FOCO =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--foco)";

export const BOTON_PRINCIPAL = `inline-flex min-h-12 items-center justify-center gap-2 rounded-(--radio-control) bg-(--primario) px-5 font-bold text-(--sobre-primario) disabled:cursor-not-allowed disabled:opacity-60 ${FOCO}`;

export const BOTON_SECUNDARIO = `inline-flex min-h-12 items-center justify-center gap-2 rounded-(--radio-control) border-2 border-(--borde-control) bg-(--superficie) px-5 font-bold text-(--tinta) disabled:cursor-not-allowed disabled:opacity-60 ${FOCO}`;

// Versión compacta del secundario, para acciones dentro de tarjetas y listas.
export const BOTON_CHICO = `inline-flex min-h-11 items-center justify-center gap-2 rounded-(--radio-control) border-2 border-(--borde-control) bg-(--superficie) px-3 text-sm font-semibold text-(--tinta) disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:opacity-50 ${FOCO}`;

// Confirmar una acción destructiva (rechazar, ocultar). Borde y texto de
// error, sin relleno: AA en los dos temas.
export const BOTON_PELIGRO = `inline-flex min-h-12 items-center justify-center gap-2 rounded-(--radio-control) border-2 border-(--error) bg-(--superficie) px-5 font-bold text-(--error) disabled:cursor-not-allowed disabled:opacity-60 ${FOCO}`;

export const BOTON_CHICO_PELIGRO = `inline-flex min-h-11 items-center justify-center gap-2 rounded-(--radio-control) border-2 border-(--error) bg-(--superficie) px-3 text-sm font-semibold text-(--error) disabled:cursor-not-allowed disabled:opacity-60 ${FOCO}`;

export const CAMPO = `min-h-12 w-full rounded-(--radio-control) border-2 border-(--borde-control) bg-(--superficie) px-3 py-2 text-(--tinta) aria-[invalid=true]:border-(--error) ${FOCO}`;

export const ENLACE = `font-semibold text-(--tinta) underline underline-offset-4 ${FOCO}`;

export const TARJETA =
  "rounded-(--radio) border border-(--borde) bg-(--superficie)";

export const TITULO_PAGINA = "text-2xl font-bold tracking-tight";

// Un paso más grande que las etiquetas de campo (16 px, semibold).
export const TITULO_SECCION = "text-xl font-bold tracking-tight";

export const TEXTO_SUAVE = "text-(--tinta-suave)";

export const TEXTO_ERROR = "font-semibold text-(--error)";

// Aviso de error en bloque (por ejemplo, un resumen de errores).
export const AVISO_ERROR =
  "rounded-(--radio-control) border-2 border-(--error) bg-(--superficie) p-4";

export const AVISO_EXITO =
  "rounded-(--radio-control) bg-(--exito-fondo) p-4 text-(--exito-tinta)";

// Contenedor de las páginas de contenido (todas menos la portada).
export const PAGINA =
  "mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8";
