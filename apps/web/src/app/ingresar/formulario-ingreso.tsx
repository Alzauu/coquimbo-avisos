"use client";

import { useActionState } from "react";

import { enviarEnlace, type EstadoIngreso } from "./acciones";

const ESTADO_INICIAL: EstadoIngreso = { estado: "inicial" };

export function FormularioIngreso({ siguiente }: { siguiente: string }) {
  const [estado, accion, enviando] = useActionState(
    enviarEnlace,
    ESTADO_INICIAL,
  );

  if (estado.estado === "enviado") {
    return (
      <p
        role="status"
        className="rounded-md bg-green-50 p-4 text-green-900 dark:bg-green-950 dark:text-green-100"
      >
        Te enviamos un enlace a <strong>{estado.correo}</strong>. Ábrelo en este
        mismo navegador para ingresar.
      </p>
    );
  }

  return (
    <form action={accion} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="siguiente" value={siguiente} />

      <div className="flex flex-col gap-1">
        <label htmlFor="correo" className="font-medium">
          Correo electrónico
        </label>
        <input
          id="correo"
          name="correo"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          aria-invalid={estado.estado === "error"}
          aria-describedby={
            estado.estado === "error" ? "error-correo" : undefined
          }
          className="rounded-md border border-zinc-400 bg-transparent px-3 py-2 dark:border-zinc-600"
        />
      </div>

      {estado.estado === "error" && (
        <p
          id="error-correo"
          role="alert"
          className="text-red-700 dark:text-red-400"
        >
          {estado.mensaje}
        </p>
      )}

      <button
        type="submit"
        disabled={enviando}
        className="rounded-md bg-zinc-900 px-4 py-2 font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {enviando ? "Enviando…" : "Enviarme el enlace"}
      </button>
    </form>
  );
}
