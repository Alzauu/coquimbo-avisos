"use client";

import { useActionState } from "react";

import {
  AVISO_EXITO,
  BOTON_PRINCIPAL,
  CAMPO,
  TEXTO_ERROR,
  TEXTO_SUAVE,
} from "@/components/ui/estilos";

import { actualizarNombre, type EstadoNombre } from "./acciones";

const ESTADO_INICIAL: EstadoNombre = { estado: "inicial" };

export function FormularioNombre({ nombreActual }: { nombreActual: string }) {
  const [estado, accion, guardando] = useActionState(
    actualizarNombre,
    ESTADO_INICIAL,
  );

  return (
    <form action={accion} className="flex flex-col gap-3" noValidate>
      <div className="flex flex-col gap-1">
        <label htmlFor="nombre_visible" className="font-semibold">
          Nombre visible
        </label>
        <p id="ayuda-nombre" className={`text-sm ${TEXTO_SUAVE}`}>
          Es el nombre con que te saludamos. Tus reportes se publican sin tu
          nombre. Entre 2 y 50 caracteres.
        </p>
        <input
          id="nombre_visible"
          name="nombre_visible"
          type="text"
          autoComplete="nickname"
          required
          minLength={2}
          maxLength={50}
          defaultValue={nombreActual}
          aria-invalid={estado.estado === "error"}
          aria-describedby={
            estado.estado === "error"
              ? "ayuda-nombre error-nombre"
              : "ayuda-nombre"
          }
          className={CAMPO}
        />
      </div>

      <div aria-live="polite">
        {estado.estado === "error" && (
          <p id="error-nombre" className={TEXTO_ERROR}>
            {estado.mensaje}
          </p>
        )}
        {estado.estado === "guardado" && (
          <p className={`${AVISO_EXITO} py-2 font-semibold`}>
            Nombre guardado.
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={guardando}
        className={`${BOTON_PRINCIPAL} self-start`}
      >
        {guardando ? "Guardando…" : "Guardar"}
      </button>
    </form>
  );
}
