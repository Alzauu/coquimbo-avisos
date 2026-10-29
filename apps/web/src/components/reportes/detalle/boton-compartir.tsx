"use client";

import { useId, useState } from "react";

import {
  BOTON_CHICO,
  BOTON_SECUNDARIO,
  ENLACE,
  TEXTO_SUAVE,
} from "@/components/ui/estilos";
import { enlaceWhatsApp, textoParaCompartir } from "@/lib/reportes/compartir";

// Compartir un reporte público. En el teléfono abre la hoja de compartir
// del sistema (WhatsApp, Telegram, correo…). Donde no existe (por ejemplo,
// en el computador), despliega dos opciones: WhatsApp y copiar el enlace.
// El enlace es siempre el del reporte, sin parámetros (?aviso=…).

type Copia = "nada" | "copiado" | "fallo";

export function BotonCompartir({
  reporteId,
  titulo,
}: {
  reporteId: string;
  titulo: string;
}) {
  const idOpciones = useId();
  const [abierto, setAbierto] = useState(false);
  const [copia, setCopia] = useState<Copia>("nada");

  // Solo en el navegador (al hacer clic): el servidor no conoce el origen.
  const urlReporte = () => `${window.location.origin}/reporte/${reporteId}`;
  const texto = textoParaCompartir(titulo);

  async function compartir() {
    const url = urlReporte();
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: titulo, text: texto, url });
        return;
      } catch (error) {
        // Cerrar la hoja sin elegir no es un error.
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        // Otro fallo (por ejemplo, permiso denegado): opciones manuales.
      }
    }
    setCopia("nada");
    setAbierto((actual) => !actual);
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(urlReporte());
      setCopia("copiado");
    } catch {
      // Sin permiso de portapapeles (o sin HTTPS): se muestra el enlace
      // para copiarlo a mano.
      setCopia("fallo");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={compartir}
        aria-expanded={abierto}
        aria-controls={idOpciones}
        className={`${BOTON_SECUNDARIO} self-start`}
      >
        <IconoCompartir />
        Compartir
      </button>

      <div id={idOpciones} hidden={!abierto} className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <a
            href={abierto ? enlaceWhatsApp(texto, urlReporte()) : undefined}
            target="_blank"
            rel="noopener noreferrer"
            className={BOTON_CHICO}
          >
            WhatsApp
            <span className="sr-only"> (se abre en otra pestaña)</span>
          </a>
          <button type="button" onClick={copiar} className={BOTON_CHICO}>
            Copiar enlace
          </button>
        </div>
        <p role="status" className={`min-h-5 text-sm ${TEXTO_SUAVE}`}>
          {copia === "copiado" && "Enlace copiado."}
          {copia === "fallo" && (
            <>
              No pudimos copiarlo. Copia este enlace:{" "}
              <a href={urlReporte()} className={`${ENLACE} break-all`}>
                {urlReporte()}
              </a>
            </>
          )}
        </p>
      </div>
    </div>
  );
}

// Decorativo: el texto del botón dice lo mismo.
function IconoCompartir() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      <path d="M8 10V2.5M5 5.5l3-3 3 3" />
      <path d="M3.5 8.5v4a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1v-4" />
    </svg>
  );
}
