"use client";

import { useActionState, useId, useState } from "react";

import {
  BOTON_PRINCIPAL,
  BOTON_SECUNDARIO,
  CAMPO,
  FOCO,
} from "@/components/ui/estilos";
import type { Origen } from "@/lib/moderacion/esquemas";
import { LARGO_MOTIVO } from "@/lib/moderacion/esquemas";
import {
  type EstadoPublico,
  ESTADOS_PUBLICOS,
  NOMBRE_ESTADO,
} from "@/lib/reportes/presentacion";

import {
  aprobarReporte,
  cambiarEstado,
  type EstadoAccion,
  ocultarFoto,
  ocultarReporte,
  rechazarReporte,
} from "./acciones";

// Formularios de moderación. Si la acción resulta, la Server Action
// redirige con un aviso (role="status") en la página; si falla, el error
// se muestra junto al formulario con role="alert".

const INICIAL: EstadoAccion = { estado: "inicial" };

const BOTON_PELIGRO = `min-h-11 rounded-(--radio-control) bg-red-700 px-4 py-2 font-bold text-white disabled:opacity-60 dark:bg-red-600 ${FOCO}`;

function ErrorAccion({ estado, id }: { estado: EstadoAccion; id?: string }) {
  if (estado.estado !== "error") return null;
  return (
    <p id={id} role="alert" className="text-sm text-red-700 dark:text-red-400">
      {estado.mensaje}
    </p>
  );
}

// Nombre del reporte para lectores de pantalla: en una lista hay muchos
// botones "Aprobar" iguales.
function Contexto({ titulo }: { titulo: string }) {
  return <span className="sr-only"> «{titulo}»</span>;
}

export function FormAprobar({
  reporteId,
  titulo,
}: {
  reporteId: string;
  titulo: string;
}) {
  const [estado, accion, enviando] = useActionState(aprobarReporte, INICIAL);
  return (
    <form action={accion} className="flex flex-col gap-2">
      <input type="hidden" name="reporte_id" value={reporteId} />
      <button type="submit" disabled={enviando} className={BOTON_PRINCIPAL}>
        {enviando ? "Aprobando…" : "Aprobar y publicar"}
        <Contexto titulo={titulo} />
      </button>
      <ErrorAccion estado={estado} />
    </form>
  );
}

export function FormRechazar({
  reporteId,
  titulo,
}: {
  reporteId: string;
  titulo: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [estado, accion, enviando] = useActionState(rechazarReporte, INICIAL);
  const id = useId();

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className={BOTON_SECUNDARIO}
      >
        Rechazar…
        <Contexto titulo={titulo} />
      </button>
    );
  }

  const hayError = estado.estado === "error";
  return (
    <form
      action={accion}
      className="flex flex-col gap-2 rounded-md border border-zinc-300 p-3 dark:border-zinc-700"
    >
      <input type="hidden" name="reporte_id" value={reporteId} />
      <label htmlFor={`${id}-motivo`} className="font-medium">
        Motivo del rechazo
      </label>
      <p
        id={`${id}-ayuda`}
        className="text-sm text-zinc-600 dark:text-zinc-400"
      >
        Quien hizo el reporte lo verá en Mis reportes (no verá quién lo
        rechazó). Entre {LARGO_MOTIVO.min} y {LARGO_MOTIVO.max} caracteres.
      </p>
      <textarea
        id={`${id}-motivo`}
        name="motivo"
        rows={3}
        required
        minLength={LARGO_MOTIVO.min}
        maxLength={LARGO_MOTIVO.max}
        // Se abre a pedido de la persona: llevar el foco al campo es lo
        // esperado.
        autoFocus
        aria-invalid={hayError}
        aria-describedby={hayError ? `${id}-ayuda ${id}-error` : `${id}-ayuda`}
        className={CAMPO}
      />
      <ErrorAccion estado={estado} id={`${id}-error`} />
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={enviando} className={BOTON_PELIGRO}>
          {enviando ? "Rechazando…" : "Confirmar rechazo"}
        </button>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className={BOTON_SECUNDARIO}
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

export function FormOcultarFoto({
  reporteId,
  fotoId,
  origen,
  descripcion,
}: {
  reporteId: string;
  fotoId: number;
  origen: Origen;
  // Por ejemplo, "foto 2 de «Bache en…»".
  descripcion: string;
}) {
  const [estado, accion, enviando] = useActionState(ocultarFoto, INICIAL);
  return (
    <form action={accion} className="flex flex-col gap-1">
      <input type="hidden" name="reporte_id" value={reporteId} />
      <input type="hidden" name="foto_id" value={fotoId} />
      <input type="hidden" name="origen" value={origen} />
      <button
        type="submit"
        disabled={enviando}
        className="min-h-11 rounded-md border border-red-700 px-2 py-1 text-sm font-medium text-red-800 disabled:opacity-60 dark:border-red-400 dark:text-red-300"
      >
        {enviando ? "Ocultando…" : "Ocultar foto"}
        <span className="sr-only"> ({descripcion})</span>
      </button>
      <ErrorAccion estado={estado} />
    </form>
  );
}

export function FormOcultarReporte({ reporteId }: { reporteId: string }) {
  const [abierto, setAbierto] = useState(false);
  const [estado, accion, enviando] = useActionState(ocultarReporte, INICIAL);
  const id = useId();

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className={`${BOTON_SECUNDARIO} self-start`}
      >
        Ocultar reporte…
      </button>
    );
  }

  const hayError = estado.estado === "error";
  return (
    <form action={accion} className="flex flex-col gap-2">
      <input type="hidden" name="reporte_id" value={reporteId} />
      <label htmlFor={`${id}-motivo`} className="font-medium">
        Motivo (opcional, solo para moderación)
      </label>
      <p
        id={`${id}-ayuda`}
        className="text-sm text-zinc-600 dark:text-zinc-400"
      >
        El reporte dejará de verse en el mapa público. Si escribes un motivo,
        entre {LARGO_MOTIVO.min} y {LARGO_MOTIVO.max} caracteres.
      </p>
      <textarea
        id={`${id}-motivo`}
        name="motivo"
        rows={2}
        maxLength={LARGO_MOTIVO.max}
        autoFocus
        aria-invalid={hayError}
        aria-describedby={hayError ? `${id}-ayuda ${id}-error` : `${id}-ayuda`}
        className={CAMPO}
      />
      <ErrorAccion estado={estado} id={`${id}-error`} />
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={enviando} className={BOTON_PELIGRO}>
          {enviando ? "Ocultando…" : "Confirmar: ocultar reporte"}
        </button>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className={BOTON_SECUNDARIO}
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

export function FormCambiarEstado({
  reporteId,
  estadoActual,
}: {
  reporteId: string;
  estadoActual: EstadoPublico;
}) {
  const [estado, accion, enviando] = useActionState(cambiarEstado, INICIAL);
  const id = useId();
  return (
    <form action={accion} className="flex flex-col gap-2">
      <input type="hidden" name="reporte_id" value={reporteId} />
      <label htmlFor={`${id}-estado`} className="font-medium">
        Estado del problema
      </label>
      <div className="flex flex-wrap gap-2">
        <select
          id={`${id}-estado`}
          name="estado"
          defaultValue={estadoActual}
          className={CAMPO}
        >
          {ESTADOS_PUBLICOS.map((valor) => (
            <option key={valor} value={valor}>
              {NOMBRE_ESTADO[valor]}
            </option>
          ))}
        </select>
        <button type="submit" disabled={enviando} className={BOTON_PRINCIPAL}>
          {enviando ? "Guardando…" : "Guardar estado"}
        </button>
      </div>
      <ErrorAccion estado={estado} />
    </form>
  );
}
