import type { Map as MapaLibre } from "maplibre-gl";

import {
  CATEGORIAS,
  type CategoriaVisual,
  GROSOR_ICONO,
  imagenDeCategoria,
} from "@/lib/reportes/categorias";

// Imágenes de las fichas de categoría para la capa de símbolos del mapa.
// Se dibujan una vez en un canvas, con los mismos trazos de
// lib/reportes/categorias.ts, a la densidad de la pantalla (nítidas en
// teléfonos). La GPU las dibuja desde un solo atlas: el costo es el mismo
// que el de los círculos de antes.

// Tamaños en px CSS: igual que FichaCategoria con tamano 28 (con ícono) y
// el punto de siempre (sin ícono).
export const DIAMETRO_FICHA = 28;
const DIAMETRO_PUNTO = 20;
const BORDE = 2;
const LADO_ICONO = 16;

function imagenFicha(categoria: CategoriaVisual, escala: number): ImageData {
  const lado = categoria.trazos ? DIAMETRO_FICHA : DIAMETRO_PUNTO;
  const px = Math.ceil(lado * escala);
  const canvas = document.createElement("canvas");
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("El navegador no permite dibujar en un canvas.");
  ctx.scale(escala, escala);

  ctx.beginPath();
  ctx.arc(lado / 2, lado / 2, lado / 2 - BORDE / 2, 0, Math.PI * 2);
  ctx.fillStyle = categoria.color;
  ctx.fill();
  ctx.lineWidth = BORDE;
  ctx.strokeStyle = "#ffffff";
  ctx.stroke();

  if (categoria.trazos) {
    const margen = (lado - LADO_ICONO) / 2;
    ctx.translate(margen, margen);
    ctx.scale(LADO_ICONO / 24, LADO_ICONO / 24);
    ctx.lineWidth = GROSOR_ICONO;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const d of categoria.trazos) ctx.stroke(new Path2D(d));
  }
  return ctx.getImageData(0, 0, px, px);
}

// Registra una imagen por categoría (imagenDeCategoria) en un mapa recién
// cargado, antes de agregar la capa que las usa.
export function registrarFichas(mapa: MapaLibre) {
  const escala = Math.min(Math.max(window.devicePixelRatio || 1, 1), 3);
  for (const categoria of CATEGORIAS) {
    const id = imagenDeCategoria(categoria.codigo);
    if (!mapa.hasImage(id)) {
      mapa.addImage(id, imagenFicha(categoria, escala), { pixelRatio: escala });
    }
  }
}
