import { useEffect, useRef } from "react";

import { FichaCategoria } from "@/components/categorias/ficha-categoria";
import { FOCO, TEXTO_SUAVE } from "@/components/ui/estilos";
import { categoriaDe } from "@/lib/reportes/categorias";
import {
  type Categoria,
  NOMBRE_ESTADO,
  type ReportePublico,
} from "@/lib/reportes/presentacion";

import { ID_TARJETA } from "./tarjeta-reporte";

type Props = {
  reportes: readonly ReportePublico[];
  categoriasPorId: ReadonlyMap<number, Categoria>;
  seleccionadoId: string | null;
  onSeleccionar: (reporte: ReportePublico) => void;
};

// Alternativa accesible al mapa: la misma información, navegable con
// teclado y lector de pantalla. Elegir un reporte abre su tarjeta, igual
// que tocar su marcador.
export function ListaReportes({
  reportes,
  categoriasPorId,
  seleccionadoId,
  onSeleccionar,
}: Props) {
  const seleccionado = useRef<HTMLLIElement>(null);

  // Si se eligió en el mapa, muestra el reporte en la lista.
  useEffect(() => {
    seleccionado.current?.scrollIntoView({ block: "nearest" });
  }, [seleccionadoId]);

  return (
    <ul className="flex flex-col gap-2">
      {reportes.map((reporte) => {
        const elegido = reporte.id === seleccionadoId;
        const categoria = categoriasPorId.get(reporte.categoria_id);
        return (
          <li
            key={reporte.id}
            ref={elegido ? seleccionado : undefined}
            // Borde de control (3:1): se ve dónde tocar también en oscuro.
            // El elegido se distingue además por el fondo.
            className={`rounded-(--radio-control) border-2 ${
              elegido
                ? "border-(--tinta) bg-(--superficie-2)"
                : "border-(--borde-control) bg-(--superficie)"
            }`}
          >
            <button
              type="button"
              aria-expanded={elegido}
              aria-controls={elegido ? ID_TARJETA : undefined}
              onClick={() => onSeleccionar(reporte)}
              className={`flex w-full items-start gap-3 rounded-(--radio-control) p-3 text-left ${FOCO}`}
            >
              <FichaCategoria
                categoria={categoriaDe(categoria?.codigo)}
                tamano={24}
              />
              <span className="flex flex-col gap-0.5">
                <span className="font-semibold">{reporte.titulo}</span>
                <span className={`text-sm ${TEXTO_SUAVE}`}>
                  {categoria?.nombre ?? "Sin categoría"} ·{" "}
                  {NOMBRE_ESTADO[reporte.estado]}
                </span>
                {reporte.direccion_referencia && (
                  <span className={`text-sm ${TEXTO_SUAVE}`}>
                    {reporte.direccion_referencia}
                  </span>
                )}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
