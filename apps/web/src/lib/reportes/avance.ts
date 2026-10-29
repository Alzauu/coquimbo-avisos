import { ESTADOS_PUBLICOS, type EstadoPublico } from "./presentacion";

// Pasos de la línea de avance de un reporte público, en orden. El paso
// actual es el estado del reporte; los anteriores están hechos. Resuelto es
// el último: al llegar ahí todos quedan hechos, y él además es el actual.
export type PasoAvance = {
  estado: EstadoPublico;
  hecho: boolean;
  actual: boolean;
};

export function pasosDeAvance(estado: EstadoPublico): PasoAvance[] {
  const indiceActual = ESTADOS_PUBLICOS.indexOf(estado);
  const resuelto = estado === "resuelto";
  return ESTADOS_PUBLICOS.map((paso, indice) => ({
    estado: paso,
    hecho: resuelto || indice < indiceActual,
    actual: indice === indiceActual,
  }));
}
