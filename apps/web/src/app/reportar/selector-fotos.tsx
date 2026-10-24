"use client";

import { type ChangeEvent, useEffect, useRef, useState } from "react";

import {
  BOTON_CHICO,
  TEXTO_ERROR,
  TEXTO_SUAVE,
  TITULO_SECCION,
} from "@/components/ui/estilos";
import { MAX_FOTOS } from "@/lib/reportes/esquemas";

import { reducirFoto } from "./reducir-foto";

export type FotoElegida = { id: string; archivo: File; vistaPrevia: string };

type Props = {
  fotos: FotoElegida[];
  onCambio: (fotos: FotoElegida[]) => void;
  onProcesando: (procesando: boolean) => void;
  error?: string;
};

export function SelectorFotos({ fotos, onCambio, onProcesando, error }: Props) {
  const [aviso, setAviso] = useState("");
  const [procesando, setProcesando] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);

  // Libera las vistas previas al salir de la página.
  const actuales = useRef(fotos);
  useEffect(() => {
    actuales.current = fotos;
  });
  useEffect(
    () => () => {
      for (const foto of actuales.current)
        URL.revokeObjectURL(foto.vistaPrevia);
    },
    [],
  );

  async function agregar(evento: ChangeEvent<HTMLInputElement>) {
    const elegidas = [...(evento.target.files ?? [])];
    // Permite volver a elegir el mismo archivo después de quitarlo.
    evento.target.value = "";
    if (elegidas.length === 0) return;

    const disponibles = MAX_FOTOS - fotos.length;
    const aProcesar = elegidas.slice(0, disponibles);
    setProcesando(true);
    onProcesando(true);
    setAviso("Preparando las fotos…");

    const nuevas: FotoElegida[] = [];
    const ilegibles: string[] = [];
    for (const archivo of aProcesar) {
      try {
        const reducida = await reducirFoto(archivo);
        nuevas.push({
          id: crypto.randomUUID(),
          archivo: reducida,
          vistaPrevia: URL.createObjectURL(reducida),
        });
      } catch {
        ilegibles.push(archivo.name);
      }
    }

    onCambio([...fotos, ...nuevas]);
    setProcesando(false);
    onProcesando(false);

    const mensajes: string[] = [];
    if (nuevas.length > 0) {
      mensajes.push(
        nuevas.length === 1
          ? "Se agregó 1 foto."
          : `Se agregaron ${nuevas.length} fotos.`,
      );
    }
    if (elegidas.length > disponibles) {
      mensajes.push(
        `Puedes subir hasta ${MAX_FOTOS} fotos; no se agregaron las demás.`,
      );
    }
    for (const nombre of ilegibles) {
      mensajes.push(
        `No pudimos leer «${nombre}». Prueba con una foto JPEG o PNG.`,
      );
    }
    setAviso(mensajes.join(" "));
  }

  function quitar(foto: FotoElegida, numero: number) {
    URL.revokeObjectURL(foto.vistaPrevia);
    onCambio(fotos.filter((otra) => otra.id !== foto.id));
    setAviso(`Se quitó la foto ${numero}.`);
    entrada.current?.focus();
  }

  const lleno = fotos.length >= MAX_FOTOS;

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className={TITULO_SECCION}>Fotos (opcional)</legend>
      <p id="ayuda-fotos" className={`text-sm ${TEXTO_SUAVE}`}>
        Hasta {MAX_FOTOS} fotos. Evita que se vean rostros o patentes: el equipo
        de moderación puede ocultarlas.
      </p>

      <label
        className={`flex min-h-20 items-center justify-center rounded-(--radio-control) border-2 border-dashed border-(--borde-control) bg-(--superficie) px-4 font-bold ${
          lleno || procesando
            ? "cursor-not-allowed opacity-60"
            : "cursor-pointer has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-(--foco)"
        }`}
      >
        {lleno
          ? `Ya agregaste ${MAX_FOTOS} fotos`
          : fotos.length === 0
            ? "Agregar fotos"
            : "Agregar otra foto"}
        <input
          ref={entrada}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/*"
          multiple
          disabled={lleno || procesando}
          onChange={agregar}
          aria-describedby={`ayuda-fotos${error ? " error-fotos" : ""}`}
          aria-invalid={Boolean(error)}
          className="sr-only"
        />
      </label>

      <p aria-live="polite" className="text-sm">
        {aviso}
      </p>
      {error && (
        <p id="error-fotos" className={TEXTO_ERROR}>
          {error}
        </p>
      )}

      {fotos.length > 0 && (
        <ul className="grid grid-cols-3 gap-2">
          {fotos.map((foto, indice) => (
            <li key={foto.id} className="flex flex-col gap-1">
              {/* Vista previa local (blob:), no pasa por next/image. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={foto.vistaPrevia}
                alt={`Foto ${indice + 1} elegida`}
                className="aspect-square w-full rounded-(--radio-control) border border-(--borde) object-cover"
              />
              <button
                type="button"
                onClick={() => quitar(foto, indice + 1)}
                // Mientras se preparan otras fotos la lista no debe cambiar.
                disabled={procesando}
                className={`${BOTON_CHICO} px-2`}
              >
                Quitar foto {indice + 1}
              </button>
            </li>
          ))}
        </ul>
      )}
    </fieldset>
  );
}
