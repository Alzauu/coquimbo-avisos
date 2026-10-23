import { z } from "zod";

// Validaciones de un reporte nuevo. Se usan iguales en el navegador (para
// avisar antes de enviar) y en la Server Action (la que cuenta).

// PROVISORIO: rectángulo amplio de La Serena mientras no se carga el límite
// comunal oficial en comunas.limites. Incluye parte de Coquimbo para no
// rechazar reportes válidos; moderación revisa el resto. Debe coincidir con
// el trigger validar_nuevo_reporte de
// supabase/migrations/20261023013650_crear_reportes.sql.
export const RECTANGULO_LA_SERENA = {
  oeste: -71.4,
  sur: -30.1,
  este: -70.7,
  norte: -29.55,
} as const;

// Única comuna activa por ahora.
export const COMUNA_LA_SERENA = 4101;

// Deben coincidir con los CHECK de reportes (los largos se cuentan en
// caracteres, igual que char_length en la base).
export const LARGO_TITULO = { min: 5, max: 140 } as const;
export const LARGO_DESCRIPCION_MAX = 1000;
export const LARGO_REFERENCIA_MAX = 200;

export const MAX_FOTOS = 3;
export const TIPOS_FOTO = ["image/jpeg", "image/png", "image/webp"] as const;
// Lado mayor de cada foto, en el navegador y en el servidor.
export const LADO_MAX_FOTO = 1600;
// Lo que envía el navegador (ya reducido): 3 × 1,3 MB más los campos caben
// en el límite de 4 MB de la Server Action (next.config.ts).
export const MAX_BYTES_FOTO_ENVIADA = 1.3 * 1024 * 1024;
// Lo que se guarda tras procesar con sharp: igual al límite del bucket.
export const MAX_BYTES_FOTO_GUARDADA = 800 * 1024;

export const largo = (texto: string) => [...texto].length;

// Caracteres de control y de dirección de texto (se usan para disfrazar
// contenido). En textos largos se permiten saltos de línea y tabulaciones.
const CARACTERES_NO_PERMITIDOS = /[\p{Cc}‪-‮⁦-⁩]/u;
export const sinControles = (texto: string, permitirSaltos: boolean) =>
  !CARACTERES_NO_PERMITIDOS.test(
    permitirSaltos ? texto.replace(/[\n\t]/g, "") : texto,
  );

// Texto de una línea: recorta y junta espacios repetidos.
const textoEnLinea = (valor: unknown) =>
  typeof valor === "string" ? valor.trim().replace(/\s+/g, " ") : valor;

// Texto largo: recorta y normaliza saltos de línea de Windows.
export const textoLargo = (valor: unknown) =>
  typeof valor === "string" ? valor.replace(/\r\n?/g, "\n").trim() : valor;

// Campo opcional: vacío o ausente equivale a null.
const vacioANull = (valor: unknown) => (valor === "" ? null : valor);

const coordenada = (nombre: string) =>
  z.preprocess(
    (valor) => (typeof valor === "string" ? valor.trim() : valor),
    z
      .string(`Falta la ${nombre}.`)
      .min(1, `Falta la ${nombre}.`)
      .pipe(z.coerce.number(`La ${nombre} no es válida.`)),
  );

export const esquemaReporte = z
  .object({
    categoria_id: z.coerce
      .number("Elige una categoría.")
      .int("Elige una categoría.")
      .positive("Elige una categoría."),
    titulo: z.preprocess(
      textoEnLinea,
      z
        .string("Escribe un título.")
        .refine((t) => largo(t) >= LARGO_TITULO.min, {
          error: `El título debe tener al menos ${LARGO_TITULO.min} caracteres.`,
        })
        .refine((t) => largo(t) <= LARGO_TITULO.max, {
          error: `El título puede tener hasta ${LARGO_TITULO.max} caracteres.`,
        })
        .refine((t) => sinControles(t, false), {
          error: "El título tiene caracteres no permitidos.",
        }),
    ),
    descripcion: z.preprocess(
      (valor) => vacioANull(textoLargo(valor ?? "")),
      z
        .string()
        .refine((t) => largo(t) <= LARGO_DESCRIPCION_MAX, {
          error: `La descripción puede tener hasta ${LARGO_DESCRIPCION_MAX} caracteres.`,
        })
        .refine((t) => sinControles(t, true), {
          error: "La descripción tiene caracteres no permitidos.",
        })
        .nullable(),
    ),
    direccion_referencia: z.preprocess(
      (valor) => vacioANull(textoEnLinea(valor ?? "")),
      z
        .string()
        .refine((t) => largo(t) <= LARGO_REFERENCIA_MAX, {
          error: `La referencia puede tener hasta ${LARGO_REFERENCIA_MAX} caracteres.`,
        })
        .refine((t) => sinControles(t, false), {
          error: "La referencia tiene caracteres no permitidos.",
        })
        .nullable(),
    ),
    latitud: coordenada("latitud"),
    longitud: coordenada("longitud"),
  })
  .refine(({ latitud, longitud }) => estaEnLaSerena({ latitud, longitud }), {
    path: ["ubicacion"],
    error:
      "La ubicación está fuera de La Serena. Por ahora solo recibimos reportes de La Serena.",
  });

export type DatosReporte = z.infer<typeof esquemaReporte>;

export function estaEnLaSerena({
  latitud,
  longitud,
}: {
  latitud: number;
  longitud: number;
}) {
  const r = RECTANGULO_LA_SERENA;
  return (
    longitud >= r.oeste &&
    longitud <= r.este &&
    latitud >= r.sur &&
    latitud <= r.norte
  );
}

export const esquemaFotos = z
  .array(
    z
      .file("Una de las fotos no es un archivo válido.")
      .mime([...TIPOS_FOTO], "Las fotos deben ser JPEG, PNG o WebP.")
      .max(
        MAX_BYTES_FOTO_ENVIADA,
        "Una de las fotos es demasiado pesada. Prueba con otra.",
      ),
  )
  .max(MAX_FOTOS, `Puedes subir hasta ${MAX_FOTOS} fotos.`);

export type CampoReporte =
  | "categoria_id"
  | "titulo"
  | "descripcion"
  | "direccion_referencia"
  | "ubicacion"
  | "fotos";

export type ErroresReporte = Partial<Record<CampoReporte, string>>;

const CAMPOS_TEXTO = new Set<string>([
  "categoria_id",
  "titulo",
  "descripcion",
  "direccion_referencia",
]);

// Primer mensaje por campo. Latitud y longitud se informan como
// "ubicacion", que es lo que la persona elige en el mapa; todo error de
// esquemaFotos se informa como "fotos".
export function erroresDeValidacion(
  reporte: z.ZodError | undefined,
  fotos: z.ZodError | undefined,
): ErroresReporte {
  const errores: ErroresReporte = {};
  for (const issue of reporte?.issues ?? []) {
    const raiz = String(issue.path[0]);
    if (raiz === "latitud" || raiz === "longitud" || raiz === "ubicacion") {
      errores.ubicacion ??= issue.message;
    } else if (CAMPOS_TEXTO.has(raiz)) {
      errores[raiz as CampoReporte] ??= issue.message;
    }
  }
  const errorFotos = fotos?.issues[0]?.message;
  if (errorFotos) errores.fotos = errorFotos;
  return errores;
}
