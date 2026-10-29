// Catálogo de categorías de reportes: nombre, color e ícono de cada una, en
// el orden en que se muestran. Es la única fuente de estos datos en la app;
// los nombres deben coincidir con la tabla categorias (lo comprueba
// tests/rls/reportes.test.ts).
//
// Íconos: trazos SVG propios en una cuadrícula de 24×24, pensados para
// verse en blanco, con línea gruesa y redondeada, dentro de un círculo de
// color de unos 28 px. Los usan la ficha en React (FichaCategoria) y las
// imágenes del mapa (dibujadas en un canvas con Path2D).

export type CodigoCategoria =
  | "calles"
  | "basura"
  | "alcantarillado"
  | "areas_verdes"
  | "vehiculos"
  | "iluminacion"
  | "veredas"
  | "otros";

export type CategoriaVisual = {
  codigo: CodigoCategoria;
  nombre: string;
  color: string;
  // null: sin ícono, se muestra como punto (Otros y categorías desconocidas).
  trazos: readonly string[] | null;
};

// Grosor de línea de los íconos, en unidades de la cuadrícula de 24.
export const GROSOR_ICONO = 2.25;

export const ICONOS: Record<CodigoCategoria, readonly string[] | null> = {
  // Carretera en perspectiva con línea central discontinua.
  calles: [
    "M7 21 10 3",
    "M17 21 14 3",
    "M12 4v2.5",
    "M12 10.5v3",
    "M12 17.5v3",
  ],
  // Tacho con tapa, asa y dos líneas.
  basura: [
    "M4 6.5h16",
    "M9.5 6.5V4h5v2.5",
    "M6.5 6.5 7.7 20h8.6l1.2-13.5",
    "M10.5 10v6.5",
    "M13.5 10v6.5",
  ],
  // Tapa de alcantarilla: disco con anillo interior y dos ranuras cortas
  // (sin las líneas largas paralelas de un ícono de menú).
  alcantarillado: [
    "M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0",
    "M7.5 12a4.5 4.5 0 1 0 9 0a4.5 4.5 0 1 0-9 0",
    "M10.5 10.5h3",
    "M10.5 13.5h3",
  ],
  // Árbol (pino de dos niveles) con su tronco.
  areas_verdes: ["M12 3 7 10h3l-4 6.5h12L14 10h3z", "M12 16.5V21"],
  // Auto visto de lado: carrocería, ventanas y ruedas.
  vehiculos: [
    "M3 17v-4.5L5.5 7h13l2.5 5.5V17",
    "M3 12.5h18",
    "M5.5 17.5a2 2 0 1 0 4 0a2 2 0 1 0-4 0",
    "M14.5 17.5a2 2 0 1 0 4 0a2 2 0 1 0-4 0",
  ],
  // Ampolleta con su base.
  iluminacion: [
    "M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.4 1.1 2.2v1h5v-1c0-.8.4-1.6 1.1-2.2A6 6 0 0 0 12 3z",
    "M9.5 20h5",
  ],
  // Peatón caminando.
  veredas: [
    "M12.2 4.5a1.8 1.8 0 1 0 3.6 0a1.8 1.8 0 1 0-3.6 0",
    "M13.5 8.5 11.5 15l3 2.5 1 4",
    "M11.5 15 9 21",
    "M8 12l3-3.5 3.5 2.5 2.5.5",
  ],
  otros: null,
};

const NOMBRES: Record<CodigoCategoria, string> = {
  calles: "Calles",
  basura: "Basura",
  alcantarillado: "Filtración o alcantarillado",
  areas_verdes: "Áreas verdes",
  vehiculos: "Vehículos",
  iluminacion: "Iluminación",
  veredas: "Veredas",
  otros: "Otros",
};

// Paleta B (elegida con una hoja de muestra). Cada categoría tiene su
// propio tono; la luminosidad se ajustó para que los pares que el
// daltonismo junta sigan distinguiéndose (ΔE2000 mínimo: 11,7 con visión
// normal y 5,1 con protanopía, deuteranopía o tritanopía). Todos dejan el
// ícono blanco con contraste de al menos 4,5:1 y se distinguen de los
// grupos (#1f2937) y de los cortes de luz (#dc2626). El ícono es la pista
// principal; el color, una ayuda.
const COLORES: Record<CodigoCategoria, string> = {
  calles: "#3809c9",
  basura: "#5f0c3e",
  alcantarillado: "#084185",
  areas_verdes: "#1c763b",
  vehiculos: "#1a7085",
  iluminacion: "#b45309",
  veredas: "#3e4f18",
  otros: "#475569",
};

export const ORDEN_CATEGORIAS: readonly CodigoCategoria[] = [
  "calles",
  "basura",
  "alcantarillado",
  "areas_verdes",
  "vehiculos",
  "iluminacion",
  "veredas",
  "otros",
];

export const CATEGORIAS: readonly CategoriaVisual[] = ORDEN_CATEGORIAS.map(
  (codigo) => ({
    codigo,
    nombre: NOMBRES[codigo],
    color: COLORES[codigo],
    trazos: ICONOS[codigo],
  }),
);

const POR_CODIGO = new Map(CATEGORIAS.map((c) => [c.codigo as string, c]));

export const OTROS = POR_CODIGO.get("otros")!;

// Datos visuales de una categoría. Un código desconocido (por ejemplo, una
// categoría nueva en la base que la app aún no conoce) cae en Otros.
export function categoriaDe(
  codigo: string | null | undefined,
): CategoriaVisual {
  return (codigo && POR_CODIGO.get(codigo)) || OTROS;
}

// Radio (en metros) para buscar posibles duplicados al reportar. El GPS del
// teléfono se equivoca entre 20 y 50 m, así que el radio por defecto es
// 75 m. Más chico donde dos problemas distintos suelen estar cerca (autos,
// luminarias, puntos de basura, tramos de vereda); más grande en áreas
// verdes, donde una plaza ocupa una manzana.
// La base acota cualquier radio entre RADIO_DUPLICADOS_MIN y
// RADIO_DUPLICADOS_MAX (reportes_cercanos, en
// supabase/migrations/20261028120000_reportes_cercanos.sql).
export const RADIO_DUPLICADOS_MIN = 10;
export const RADIO_DUPLICADOS_MAX = 200;
export const RADIO_DUPLICADOS_DEFECTO = 75;

const RADIO_DUPLICADOS: Partial<Record<CodigoCategoria, number>> = {
  basura: 50,
  vehiculos: 40,
  iluminacion: 50,
  veredas: 50,
  areas_verdes: 100,
};

export function radioDuplicados(codigo: string | null | undefined): number {
  return (
    RADIO_DUPLICADOS[categoriaDe(codigo).codigo] ?? RADIO_DUPLICADOS_DEFECTO
  );
}

// Nombre de la imagen de la ficha en el mapa (la registra
// components/mapa/fichas-mapa.ts). Un código desconocido usa la de Otros.
export const PREFIJO_IMAGEN = "categoria-";

export function imagenDeCategoria(codigo: string | null | undefined): string {
  return `${PREFIJO_IMAGEN}${categoriaDe(codigo).codigo}`;
}

// Posición en el orden del catálogo; lo desconocido va al final.
export function ordenDeCategoria(codigo: string): number {
  const posicion = ORDEN_CATEGORIAS.indexOf(codigo as CodigoCategoria);
  return posicion === -1 ? ORDEN_CATEGORIAS.length : posicion;
}
