import { z } from "zod";

// Duración de una URL firmada de foto (segundos). La usan el servidor al
// firmar y la tarjeta del mapa para renovarlas antes de que venzan.
export const DURACION_URL_FOTO = 10 * 60;

// Respuesta de GET /reporte/[id]/fotos: URLs firmadas (de corta duración)
// de las fotos visibles de un reporte publicado, en orden. Sin rutas de
// Storage. El navegador la valida antes de usarla.
const urlFoto = z.string().regex(/^\/fotos\/\d+\?/);

export const esquemaFotosReporte = z.object({
  fotos: z.array(
    z.object({
      id: z.number().int().positive(),
      orden: z.number().int(),
      mediana: urlFoto,
      completa: urlFoto,
    }),
  ),
});

export type FotosReporte = z.infer<typeof esquemaFotosReporte>;
export type FotoReporte = FotosReporte["fotos"][number];
