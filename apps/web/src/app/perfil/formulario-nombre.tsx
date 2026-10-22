"use client";

import { useActionState } from "react";

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
        <label htmlFor="nombre_visible" className="font-medium">
          Nombre visible
        </label>
        <p
          id="ayuda-nombre"
          className="text-sm text-zinc-600 dark:text-zinc-400"
        >
          Es el nombre que verán otras personas. Entre 2 y 50 caracteres.
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
          className="rounded-md border border-zinc-400 bg-transparent px-3 py-2 dark:border-zinc-600"
        />
      </div>

      <div aria-live="polite">
        {estado.estado === "error" && (
          <p id="error-nombre" className="text-red-700 dark:text-red-400">
            {estado.mensaje}
          </p>
        )}
        {estado.estado === "guardado" && (
          <p className="text-green-800 dark:text-green-300">Nombre guardado.</p>
        )}
      </div>

      <button
        type="submit"
        disabled={guardando}
        className="self-start rounded-md bg-zinc-900 px-4 py-2 font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {guardando ? "Guardando…" : "Guardar"}
      </button>
    </form>
  );
}
