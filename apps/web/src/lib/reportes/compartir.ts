import { MARCA } from "@/lib/marca";

import { type CategoriaVisual, categoriaDe } from "./categorias";
import {
  type EstadoPublico,
  NOMBRE_ESTADO,
  recortarTexto,
} from "./presentacion";

// Compartir un reporte público: texto para WhatsApp y la hoja de compartir,
// y los datos de la imagen de vista previa (opengraph-image). La vista
// previa queda guardada en WhatsApp y otras apps aunque el reporte se
// oculte después, así que nunca lleva fotos ni datos del autor: solo lo
// que ya es público y pasó por moderación.

export type ReporteCompartible = {
  titulo: string;
  categoriaNombre: string | null;
  categoriaCodigo: string | null;
  estado: EstadoPublico;
  direccion_referencia: string | null;
  me_afecta: number;
};

// La imagen tiene espacio para unas tres líneas de título.
export const LARGO_TITULO_IMAGEN = 90;
export const LARGO_REFERENCIA_IMAGEN = 70;

// "1 persona dice «Me afecta»", "3 personas dicen «Me afecta»". Sin votos,
// null: no se muestra un cero.
export function textoMeAfecta(cantidad: number): string | null {
  if (cantidad <= 0) return null;
  const numero = cantidad.toLocaleString("es-CL");
  return cantidad === 1
    ? `${numero} persona dice «Me afecta»`
    : `${numero} personas dicen «Me afecta»`;
}

// Línea de resumen: categoría, estado y votos. También es la descripción
// de los metadatos de la página.
export function resumenParaCompartir(reporte: ReporteCompartible): string {
  return [
    reporte.categoriaNombre ?? "Reporte vecinal",
    NOMBRE_ESTADO[reporte.estado],
    textoMeAfecta(reporte.me_afecta),
  ]
    .filter(Boolean)
    .join(" · ");
}

// Texto que acompaña al enlace al compartir.
export function textoParaCompartir(titulo: string): string {
  return `«${titulo}»: reporte vecinal en ${MARCA.nombre}.`;
}

// Enlace para compartir por WhatsApp cuando el navegador no tiene la hoja
// de compartir (por ejemplo, en el computador).
export function enlaceWhatsApp(texto: string, url: string): string {
  return `https://wa.me/?text=${encodeURIComponent(`${texto} ${url}`)}`;
}

export type DatosImagen =
  | {
      tipo: "reporte";
      titulo: string;
      categoria: CategoriaVisual;
      categoriaNombre: string;
      estado: string;
      resuelto: boolean;
      referencia: string | null;
      meAfecta: string | null;
    }
  // Reporte inexistente, oculto o no publicado: imagen de la marca, sin
  // revelar nada del reporte.
  | { tipo: "generico" };

export function datosParaCompartir(
  reporte: ReporteCompartible | null,
): DatosImagen {
  if (!reporte) return { tipo: "generico" };
  const referencia = reporte.direccion_referencia?.trim() || null;
  return {
    tipo: "reporte",
    titulo:
      recortarTexto(reporte.titulo, LARGO_TITULO_IMAGEN) ?? reporte.titulo,
    categoria: categoriaDe(reporte.categoriaCodigo),
    categoriaNombre: reporte.categoriaNombre ?? "Reporte vecinal",
    estado: NOMBRE_ESTADO[reporte.estado],
    resuelto: reporte.estado === "resuelto",
    referencia: referencia
      ? (recortarTexto(referencia, LARGO_REFERENCIA_IMAGEN) ?? referencia)
      : null,
    meAfecta: textoMeAfecta(reporte.me_afecta),
  };
}
