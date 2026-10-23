import Link from "next/link";
import { useEffect, useRef } from "react";

import {
  type Categoria,
  COLOR_SIN_CATEGORIA,
  formatearFecha,
  NOMBRE_ESTADO,
  type ReportePublico,
} from "@/lib/reportes/presentacion";

type Props = {
  reportes: readonly ReportePublico[];
  categoriasPorId: ReadonlyMap<number, Categoria>;
  colorPorCategoria: ReadonlyMap<number, string>;
  seleccionadoId: string | null;
  onSeleccionar: (reporte: ReportePublico) => void;
};

// Alternativa accesible al mapa: la misma información, navegable con
// teclado y lector de pantalla.
export function ListaReportes({
  reportes,
  categoriasPorId,
  colorPorCategoria,
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
            className={`rounded-md border ${
              elegido
                ? "border-zinc-900 dark:border-zinc-100"
                : "border-zinc-300 dark:border-zinc-700"
            }`}
          >
            <button
              type="button"
              aria-expanded={elegido}
              aria-controls={`detalle-${reporte.id}`}
              onClick={() => onSeleccionar(reporte)}
              className="flex w-full items-start gap-3 rounded-md p-3 text-left"
            >
              <span
                aria-hidden="true"
                className="mt-1 size-3.5 shrink-0 rounded-full"
                style={{
                  backgroundColor:
                    colorPorCategoria.get(reporte.categoria_id) ??
                    COLOR_SIN_CATEGORIA,
                }}
              />
              <span className="flex flex-col gap-0.5">
                <span className="font-medium">{reporte.titulo}</span>
                <span className="text-sm text-zinc-700 dark:text-zinc-300">
                  {categoria?.nombre ?? "Sin categoría"} ·{" "}
                  {NOMBRE_ESTADO[reporte.estado]}
                </span>
                {reporte.direccion_referencia && (
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">
                    {reporte.direccion_referencia}
                  </span>
                )}
              </span>
            </button>

            <div
              id={`detalle-${reporte.id}`}
              hidden={!elegido}
              className="flex flex-col gap-1 px-3 pb-3 pl-9 text-sm"
            >
              {reporte.descripcion && <p>{reporte.descripcion}</p>}
              <p className="text-zinc-600 dark:text-zinc-400">
                Reportado el {formatearFecha(reporte.creado_en)}
                {reporte.resuelto_en &&
                  `. Resuelto el ${formatearFecha(reporte.resuelto_en)}`}
                .
              </p>
              {/* Al elegir un punto en el mapa se abre este mismo detalle. */}
              <Link
                href={`/reporte/${reporte.id}`}
                className="mt-1 self-start font-medium underline"
              >
                Ver detalle
                <span className="sr-only"> de «{reporte.titulo}»</span>
              </Link>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
