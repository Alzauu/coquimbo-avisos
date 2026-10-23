"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";

import { LARGO_MOTIVO } from "@/lib/moderacion/esquemas";

import {
  eliminarReporte,
  type EstadoEliminacion,
  reintentarBorrado,
} from "../../acciones";
import { BOTON_PELIGRO, BOTON_PRINCIPAL, CAMPO } from "../../estilos";

const INICIAL: EstadoEliminacion = { estado: "inicial" };

// Confirmación explícita: motivo obligatorio y una casilla que hay que
// marcar. Si el reporte se elimina pero quedan fotos en Storage, se
// ofrece reintentar el borrado (el reporte ya no existe).
export function FormularioEliminacion({
  reporteId,
  volver,
}: {
  reporteId: string;
  volver: string;
}) {
  const [estado, accion, enviando] = useActionState(eliminarReporte, INICIAL);

  if (estado.estado === "archivos_pendientes") {
    return <ReintentoBorrado inicial={estado} />;
  }

  const hayError = estado.estado === "error";
  return (
    <form action={accion} className="flex flex-col gap-4">
      <input type="hidden" name="reporte_id" value={reporteId} />

      <div className="flex flex-col gap-1">
        <label htmlFor="motivo" className="font-medium">
          Motivo de la eliminación
        </label>
        <p
          id="ayuda-motivo"
          className="text-sm text-zinc-700 dark:text-zinc-300"
        >
          Entre {LARGO_MOTIVO.min} y {LARGO_MOTIVO.max} caracteres. Queda
          guardado después de borrar el reporte:{" "}
          <strong>no incluyas datos personales</strong> (nombres, teléfonos,
          correos, patentes ni direcciones de personas).
        </p>
        <textarea
          id="motivo"
          name="motivo"
          rows={3}
          required
          minLength={LARGO_MOTIVO.min}
          maxLength={LARGO_MOTIVO.max}
          aria-invalid={hayError}
          aria-describedby={
            hayError ? "ayuda-motivo error-eliminacion" : "ayuda-motivo"
          }
          className={CAMPO}
        />
      </div>

      <div className="flex items-start gap-3">
        <input
          id="confirmacion"
          name="confirmacion"
          type="checkbox"
          value="si"
          required
          className="mt-1 size-5 shrink-0"
        />
        <label htmlFor="confirmacion">
          Entiendo que esto borra el reporte, su historial y sus fotos, y que no
          se puede deshacer.
        </label>
      </div>

      {hayError && (
        <p
          id="error-eliminacion"
          role="alert"
          className="text-red-700 dark:text-red-400"
        >
          {estado.mensaje}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={enviando} className={BOTON_PELIGRO}>
          {enviando ? "Eliminando…" : "Eliminar definitivamente"}
        </button>
        <Link
          href={volver}
          className="inline-flex min-h-11 items-center underline"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}

function ReintentoBorrado({
  inicial,
}: {
  inicial: Extract<EstadoEliminacion, { estado: "archivos_pendientes" }>;
}) {
  const [estado, accion, enviando] = useActionState(
    reintentarBorrado,
    inicial as EstadoEliminacion,
  );
  const aviso = useRef<HTMLDivElement>(null);
  useEffect(() => {
    aviso.current?.focus();
  }, [estado]);

  // Mientras queden archivos se siguen ofreciendo los pendientes.
  const pendientes = estado.estado === "archivos_pendientes" ? estado : inicial;
  return (
    <div
      ref={aviso}
      tabIndex={-1}
      role="alert"
      className="flex flex-col gap-3 rounded-md border-2 border-red-700 p-4 dark:border-red-400"
    >
      <p className="font-medium">{pendientes.mensaje}</p>
      {estado.estado === "error" && (
        <p className="text-red-700 dark:text-red-400">{estado.mensaje}</p>
      )}
      <form action={accion} className="flex flex-wrap gap-3">
        {pendientes.rutas.map((ruta) => (
          <input key={ruta} type="hidden" name="ruta" value={ruta} />
        ))}
        <button type="submit" disabled={enviando} className={BOTON_PRINCIPAL}>
          {enviando ? "Reintentando…" : "Reintentar el borrado de fotos"}
        </button>
        <Link
          href="/admin/reportes"
          className="inline-flex min-h-11 items-center underline"
        >
          Volver a la lista
        </Link>
      </form>
    </div>
  );
}
