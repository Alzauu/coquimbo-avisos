// Posibles duplicados al reportar: reportes públicos de la misma categoría
// cerca del punto marcado (reportes_cercanos). Solo informan; nunca
// impiden enviar el reporte.

// Lo que se espera antes de consultar tras el último cambio de punto o de
// categoría: mover el mapa dispara varios cambios seguidos.
export const ESPERA_CERCANOS_MS = 400;

// "a menos de 10 m", "a 40 m", "a 1,2 km" (no debería pasar del radio
// máximo de 200 m, pero no se muestra "1200 m" si cambia).
export function textoDistancia(metros: number): string {
  if (metros < 10) return "a menos de 10 m";
  if (metros < 1000) return `a ${Math.round(metros)} m`;
  const km = (metros / 1000).toLocaleString("es-CL", {
    maximumFractionDigits: 1,
  });
  return `a ${km} km`;
}

// Anuncio para lectores de pantalla y encabezado del aviso.
export function textoResumenCercanos(cantidad: number): string {
  return cantidad === 1
    ? "Hay 1 reporte parecido cerca del punto marcado."
    : `Hay ${cantidad} reportes parecidos cerca del punto marcado.`;
}

// Quita los reportes que la persona ya descartó («Es otro problema»).
export function sinDescartados<T extends { id: string }>(
  reportes: readonly T[],
  descartados: ReadonlySet<string>,
): T[] {
  return reportes.filter((reporte) => !descartados.has(reporte.id));
}
