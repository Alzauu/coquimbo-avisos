import type { Database } from "@/lib/supabase/database.types";

type FilaZona =
  Database["public"]["Functions"]["reportes_en_zona"]["Returns"][number];

export type EstadoReporte = Database["public"]["Enums"]["estado_reporte"];

// El generador de tipos marca todas las columnas de una función como no
// nulas, pero estas pueden venir NULL desde la base.
export type ReportePublico = Omit<
  FilaZona,
  "descripcion" | "direccion_referencia" | "resuelto_en"
> & {
  descripcion: string | null;
  direccion_referencia: string | null;
  resuelto_en: string | null;
};

export type Categoria = { id: number; codigo: string; nombre: string };

// Estados que puede tener un reporte público: los rechazados nunca se muestran.
export const ESTADOS_PUBLICOS = [
  "recibido",
  "en_revision",
  "derivado",
  "resuelto",
] as const satisfies readonly EstadoReporte[];

export type EstadoPublico = (typeof ESTADOS_PUBLICOS)[number];

export const NOMBRE_ESTADO: Record<EstadoReporte, string> = {
  recibido: "Recibido",
  en_revision: "En revisión",
  derivado: "Derivado",
  resuelto: "Resuelto",
  rechazado: "Rechazado",
};

export type EstadoModeracion = Database["public"]["Enums"]["estado_moderacion"];

export const NOMBRE_MODERACION: Record<EstadoModeracion, string> = {
  pendiente: "Pendiente de revisión",
  aprobado: "Publicado",
  oculto: "Oculto",
};

export const EXPLICACION_MODERACION: Record<EstadoModeracion, string> = {
  pendiente: "Lo revisaremos antes de mostrarlo en el mapa público.",
  aprobado: "Se muestra en el mapa público.",
  oculto: "Moderación lo retiró del mapa público.",
};

// Colores distinguibles entre sí y con buen contraste sobre el mapa. El
// color nunca es la única pista: la lista y los filtros muestran el nombre.
const COLOR_POR_CODIGO: Record<string, string> = {
  bache: "#c2410c",
  luminaria: "#b45309",
  basura: "#7c4a2d",
  semaforo: "#be185d",
  agua_alcantarillado: "#1d4ed8",
  area_verde: "#15803d",
  vehiculo_abandonado: "#6d28d9",
  otro: "#475569",
};

export const COLOR_SIN_CATEGORIA = "#475569";

export function colorDeCategoria(codigo: string): string {
  return COLOR_POR_CODIGO[codigo] ?? COLOR_SIN_CATEGORIA;
}

export type Zona = { oeste: number; sur: number; este: number; norte: number };

// Plaza de Armas de La Serena, como [longitud, latitud].
export const CENTRO_LA_SERENA: [number, number] = [-71.252, -29.907];

// Zona aproximada del mapa inicial; permite cargar la lista antes que el mapa.
export const ZONA_INICIAL: Zona = {
  oeste: -71.31,
  sur: -29.95,
  este: -71.19,
  norte: -29.86,
};

const limitar = (valor: number, minimo: number, maximo: number) =>
  Math.min(Math.max(valor, minimo), maximo);

// Ajusta los límites del mapa a rangos que acepta geography (al alejar
// mucho el mapa, MapLibre puede entregar longitudes fuera de ±180).
export function zonaValida(zona: Zona): Zona {
  return {
    oeste: limitar(zona.oeste, -180, 180),
    sur: limitar(zona.sur, -90, 90),
    este: limitar(zona.este, -180, 180),
    norte: limitar(zona.norte, -90, 90),
  };
}

// Convierte las casillas marcadas en el argumento de reportes_en_zona:
// undefined si están todas (sin filtro) y [] si no hay ninguna.
export function filtroDeSeleccion<T>(
  marcadas: ReadonlySet<T>,
  todas: readonly T[],
): T[] | undefined {
  if (todas.every((valor) => marcadas.has(valor))) return undefined;
  return todas.filter((valor) => marcadas.has(valor));
}

// Subconjunto de GeoJSON que entiende la fuente del mapa.
export type ColeccionReportes = {
  type: "FeatureCollection";
  features: {
    type: "Feature";
    geometry: { type: "Point"; coordinates: [number, number] };
    properties: { id: string; color: string };
  }[];
};

export function aGeoJSON(
  reportes: readonly ReportePublico[],
  colorPorCategoria: ReadonlyMap<number, string>,
): ColeccionReportes {
  return {
    type: "FeatureCollection",
    features: reportes.map((reporte) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [reporte.longitud, reporte.latitud],
      },
      properties: {
        id: reporte.id,
        color:
          colorPorCategoria.get(reporte.categoria_id) ?? COLOR_SIN_CATEGORIA,
      },
    })),
  };
}

const FORMATO_FECHA = new Intl.DateTimeFormat("es-CL", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "America/Santiago",
});

export function formatearFecha(iso: string): string {
  return FORMATO_FECHA.format(new Date(iso));
}
