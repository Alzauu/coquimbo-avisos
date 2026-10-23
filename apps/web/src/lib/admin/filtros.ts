import { z } from "zod";

import { ESTADOS_PUBLICOS } from "@/lib/reportes/presentacion";
import { Constants } from "@/lib/supabase/database.types";

// Filtros de /admin/reportes. Viven en la URL (formulario GET), así que
// llegan de cualquiera: un valor no válido se ignora en vez de fallar.

// Debe coincidir con listar_reportes_admin.
export const POR_PAGINA = 25;
export const LARGO_BUSQUEDA_MAX = 100;

export const MODERACIONES = Constants.public.Enums.estado_moderacion;

// "" (sin elegir): todo menos archivados, igual que la base sin filtro.
export const TODAS_LAS_MODERACIONES = "todas";

const unico = (valor: unknown) => (Array.isArray(valor) ? valor[0] : valor);

export const esquemaFiltros = z.object({
  q: z.preprocess(
    unico,
    z
      .string()
      // Recorta (no descarta) una búsqueda larga; el campo ya limita el
      // largo. Cuenta caracteres, como char_length en la base.
      .transform((t) =>
        Array.from(t.trim().replace(/\s+/g, " "))
          .slice(0, LARGO_BUSQUEDA_MAX)
          .join("")
          .trim(),
      )
      .catch(""),
  ),
  moderacion: z.preprocess(
    unico,
    z
      .enum([TODAS_LAS_MODERACIONES, ...MODERACIONES] as const)
      .optional()
      .catch(undefined),
  ),
  estado: z.preprocess(
    unico,
    z.enum(ESTADOS_PUBLICOS).optional().catch(undefined),
  ),
  categoria: z.preprocess(
    unico,
    z.coerce.number().int().min(1).max(32767).optional().catch(undefined),
  ),
  pagina: z.preprocess(
    unico,
    z.coerce.number().int().min(1).max(10000).catch(1),
  ),
});

export type Filtros = z.infer<typeof esquemaFiltros>;

export function leerFiltros(parametros: Record<string, unknown>): Filtros {
  return esquemaFiltros.parse(parametros);
}

// Argumentos de listar_reportes_admin.
export function argumentosDeFiltros(filtros: Filtros) {
  return {
    busqueda: filtros.q || undefined,
    moderaciones:
      filtros.moderacion === TODAS_LAS_MODERACIONES
        ? [...MODERACIONES]
        : filtros.moderacion
          ? [filtros.moderacion]
          : undefined,
    estados: filtros.estado ? [filtros.estado] : undefined,
    categoria: filtros.categoria,
    pagina: filtros.pagina,
  };
}

// Consulta (sin "?") con los filtros que no son los predeterminados.
export function consultaDeFiltros(
  filtros: Filtros,
  cambios: Partial<Filtros> = {},
): string {
  const final = { ...filtros, ...cambios };
  const consulta = new URLSearchParams();
  if (final.q) consulta.set("q", final.q);
  if (final.moderacion) consulta.set("moderacion", final.moderacion);
  if (final.estado) consulta.set("estado", final.estado);
  if (final.categoria) consulta.set("categoria", String(final.categoria));
  if (final.pagina > 1) consulta.set("pagina", String(final.pagina));
  return consulta.toString();
}

// Ruta de la lista con los mismos filtros y un aviso. La consulta que
// manda el formulario se vuelve a validar: el destino siempre es la lista.
export function rutaDeLista(consulta: unknown, aviso?: string): string {
  const parametros = Object.fromEntries(
    new URLSearchParams(typeof consulta === "string" ? consulta : ""),
  );
  const limpia = new URLSearchParams(
    consultaDeFiltros(leerFiltros(parametros)),
  );
  if (aviso) limpia.set("aviso", aviso);
  const texto = limpia.toString();
  return `/admin/reportes${texto ? `?${texto}` : ""}`;
}
