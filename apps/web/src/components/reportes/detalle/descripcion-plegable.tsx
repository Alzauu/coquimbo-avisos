"use client";

import { useId, useState } from "react";

import { ENLACE } from "@/components/ui/estilos";
import { recortarTexto } from "@/lib/reportes/presentacion";

import { CUERPO } from "./piezas";

// Una descripción larga (hasta 1.000 caracteres) se muestra recortada con
// «Ver más», como en la tarjeta del mapa. El botón dice si está abierta
// (aria-expanded) y qué controla.
const LARGO_RESUMEN = 360;

export function DescripcionPlegable({ texto }: { texto: string }) {
  const [completa, setCompleta] = useState(false);
  const id = useId();
  const resumen = recortarTexto(texto, LARGO_RESUMEN);

  return (
    <div className="flex flex-col items-start gap-2">
      <p id={id} className={CUERPO}>
        {resumen && !completa ? resumen : texto}
      </p>
      {resumen && (
        <button
          type="button"
          aria-expanded={completa}
          aria-controls={id}
          onClick={() => setCompleta((abierta) => !abierta)}
          className={`${ENLACE} min-h-11 text-sm`}
        >
          {completa ? "Ver menos" : "Ver más"}
        </button>
      )}
    </div>
  );
}
