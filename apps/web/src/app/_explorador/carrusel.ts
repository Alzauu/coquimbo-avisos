// Lógica del carrusel de fotos de la tarjeta, separada para probarla.

// Distancia horizontal mínima (px) para que un gesto cuente como deslizar.
export const UMBRAL_DESLIZAR = 40;

// Paso que corresponde a un gesto: deslizar el dedo hacia la izquierda
// muestra la foto siguiente (1); hacia la derecha, la anterior (-1). Un
// gesto corto o más vertical que horizontal no hace nada (0).
export function pasoDeslizar(dx: number, dy: number): -1 | 0 | 1 {
  if (Math.abs(dx) < UMBRAL_DESLIZAR || Math.abs(dx) <= Math.abs(dy)) return 0;
  return dx < 0 ? 1 : -1;
}

// El carrusel no da la vuelta: en los extremos se queda donde está.
export function moverIndice(indice: number, paso: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(Math.max(indice + paso, 0), total - 1);
}
