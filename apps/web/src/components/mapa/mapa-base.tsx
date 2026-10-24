"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import { Map as MapaLibre, NavigationControl, setWorkerUrl } from "maplibre-gl";
import { type RefObject, useEffect, useRef, useState } from "react";

// Configuración común de los mapas de la app (MapTiler + MapLibre).

// Copiado por scripts/copiar-worker-maplibre.mjs.
setWorkerUrl("/vendor/maplibre-gl-worker.mjs");

const CLAVE_MAPTILER = process.env.NEXT_PUBLIC_MAPTILER_KEY;

const TEXTOS_CONTROLES: Record<string, string> = {
  "NavigationControl.ZoomIn": "Acercar",
  "NavigationControl.ZoomOut": "Alejar",
  "NavigationControl.ResetBearing": "Orientar hacia el norte",
  "AttributionControl.ToggleAttribution": "Mostrar u ocultar créditos",
  "AttributionControl.MapFeedback": "Informar un error del mapa",
  "Popup.Close": "Cerrar",
};

const IMAGEN_VACIA = { width: 1, height: 1, data: new Uint8Array(4) };

type OpcionesMapa = {
  // Nombre accesible del mapa (lo leen los lectores de pantalla).
  titulo: string;
  centro: [number, number];
  zoom: number;
};

// Crea el mapa una sola vez con las opciones iniciales y lo entrega cuando
// termina de cargar el estilo; antes de eso `mapa` es null.
export function useMapa(opciones: OpcionesMapa) {
  const contenedor = useRef<HTMLDivElement>(null);
  const [mapa, setMapa] = useState<MapaLibre | null>(null);
  const [falloCarga, setFalloCarga] = useState(false);
  const [iniciales] = useState(opciones);

  useEffect(() => {
    if (!CLAVE_MAPTILER || !contenedor.current) return;

    let nuevo: MapaLibre;
    try {
      nuevo = new MapaLibre({
        container: contenedor.current,
        style: `https://api.maptiler.com/maps/streets-v2/style.json?key=${encodeURIComponent(CLAVE_MAPTILER)}`,
        center: iniciales.centro,
        zoom: iniciales.zoom,
        // Créditos de MapTiler y OpenStreetMap siempre visibles.
        attributionControl: { compact: false },
        locale: { ...TEXTOS_CONTROLES, "Map.Title": iniciales.titulo },
      });
    } catch (error) {
      // Por ejemplo, un navegador sin WebGL.
      console.error("MapLibre", error);
      // Ocurre una sola vez, al fallar el sistema externo: no hay renders en cadena.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFalloCarga(true);
      return;
    }
    nuevo.addControl(new NavigationControl({ showCompass: false }));

    // El estilo de MapTiler usa íconos que su sprite no trae (por ejemplo,
    // "office"). Una imagen transparente evita el aviso en consola.
    nuevo.setMissingStyleImageResolver((id) => {
      if (!nuevo.hasImage(id)) nuevo.addImage(id, IMAGEN_VACIA);
    });

    nuevo.on("load", () => setMapa(nuevo));

    // Sin estilo (clave inválida, sin conexión) el mapa queda en blanco.
    nuevo.on("error", (evento) => {
      console.error("MapLibre", evento.error);
      if (!nuevo.isStyleLoaded()) setFalloCarga(true);
    });

    return () => {
      nuevo.remove();
      setMapa(null);
    };
  }, [iniciales]);

  return { contenedor, mapa, falloCarga };
}

type PropsMarco = {
  contenedor: RefObject<HTMLDivElement | null>;
  falloCarga: boolean;
  // Qué puede hacer la persona si el mapa no está disponible.
  alternativa: string;
  // Elementos sobre el mapa (por ejemplo, un pin fijo al centro).
  children?: React.ReactNode;
};

// Ocupa todo su contenedor, que debe tener position: relative y alto.
export function MarcoMapa({
  contenedor,
  falloCarga,
  alternativa,
  children,
}: PropsMarco) {
  if (!CLAVE_MAPTILER) {
    return (
      <AvisoMapa>
        El mapa no está disponible: falta configurar la clave de MapTiler.{" "}
        {alternativa}
      </AvisoMapa>
    );
  }

  return (
    <>
      {/* MapLibre agrega .maplibregl-map (position: relative, fuera de las
          capas de Tailwind) al contenedor y anularía "absolute". Por eso la
          posición va en este div y el contenedor solo ocupa el 100 %. */}
      <div className="absolute inset-0">
        <div ref={contenedor} className="h-full w-full" />
      </div>
      {children}
      {falloCarga && (
        <AvisoMapa>
          No pudimos cargar el mapa. Revisa tu conexión. {alternativa}
        </AvisoMapa>
      )}
    </>
  );
}

function AvisoMapa({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-(--superficie-2) p-6">
      <p role="status" className="max-w-sm text-center">
        {children}
      </p>
    </div>
  );
}
