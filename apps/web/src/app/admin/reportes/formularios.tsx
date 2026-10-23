"use client";

import { useActionState } from "react";

import {
  archivarReporte,
  type EstadoAccion,
  restaurarReporte,
} from "./acciones";
import { BOTON_SECUNDARIO } from "./estilos";

// Archivar o restaurar desde la lista. Si resulta, la Server Action vuelve
// a la misma página de la lista con un aviso; si falla, el error se
// muestra junto al botón con role="alert".

const INICIAL: EstadoAccion = { estado: "inicial" };

type Props = {
  reporteId: string;
  titulo: string;
  archivado: boolean;
  // Consulta actual de la lista (filtros y página), para volver a ella.
  volver: string;
};

export function FormArchivo({ reporteId, titulo, archivado, volver }: Props) {
  const [estado, accion, enviando] = useActionState(
    archivado ? restaurarReporte : archivarReporte,
    INICIAL,
  );
  const texto = archivado
    ? enviando
      ? "Restaurando…"
      : "Restaurar"
    : enviando
      ? "Archivando…"
      : "Archivar";

  return (
    <form action={accion} className="flex flex-col gap-1">
      <input type="hidden" name="reporte_id" value={reporteId} />
      <input type="hidden" name="volver" value={volver} />
      <button type="submit" disabled={enviando} className={BOTON_SECUNDARIO}>
        {texto}
        {/* En la tabla hay muchos botones iguales. */}
        <span className="sr-only"> «{titulo}»</span>
      </button>
      {estado.estado === "error" && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {estado.mensaje}
        </p>
      )}
    </form>
  );
}
