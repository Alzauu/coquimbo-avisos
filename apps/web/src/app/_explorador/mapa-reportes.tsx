"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import {
  type GeoJSONSource,
  Map as MapaLibre,
  NavigationControl,
  setWorkerUrl,
} from "maplibre-gl";
import { useEffect, useRef, useState } from "react";

import {
  aGeoJSON,
  CENTRO_LA_SERENA,
  type ReportePublico,
  type Zona,
  zonaValida,
} from "@/lib/reportes/presentacion";

// Copiado por scripts/copiar-worker-maplibre.mjs.
setWorkerUrl("/vendor/maplibre-gl-worker.mjs");

const FUENTE = "reportes";
const CAPA_GRUPOS = "reportes-grupos";
const CAPA_CONTEO = "reportes-conteo";
const CAPA_PUNTOS = "reportes-puntos";
const CAPA_SELECCION = "reportes-seleccion";

// Por sobre este zoom no se agrupa: al elegir un reporte se acerca más.
const ZOOM_MAX_GRUPOS = 15;
const ZOOM_REPORTE = 16;

const TEXTOS_MAPA: Record<string, string> = {
  "Map.Title": "Mapa de reportes",
  "NavigationControl.ZoomIn": "Acercar",
  "NavigationControl.ZoomOut": "Alejar",
  "NavigationControl.ResetBearing": "Orientar hacia el norte",
  "AttributionControl.ToggleAttribution": "Mostrar u ocultar créditos",
  "AttributionControl.MapFeedback": "Informar un error del mapa",
};

const CLAVE_MAPTILER = process.env.NEXT_PUBLIC_MAPTILER_KEY;

const IMAGEN_VACIA = { width: 1, height: 1, data: new Uint8Array(4) };

type Props = {
  reportes: readonly ReportePublico[];
  colorPorCategoria: ReadonlyMap<number, string>;
  seleccionadoId: string | null;
  // Cada objeto nuevo mueve el mapa a ese punto (al elegir en la lista).
  destino: { lng: number; lat: number } | null;
  onSeleccionar: (id: string) => void;
  onCambioZona: (zona: Zona) => void;
};

export default function MapaReportes({
  reportes,
  colorPorCategoria,
  seleccionadoId,
  destino,
  onSeleccionar,
  onCambioZona,
}: Props) {
  const contenedor = useRef<HTMLDivElement>(null);
  const [mapa, setMapa] = useState<MapaLibre | null>(null);
  const [falloCarga, setFalloCarga] = useState(false);

  // Los manejadores del mapa se registran una vez; leen siempre la última
  // versión de los callbacks.
  const callbacks = useRef({ onSeleccionar, onCambioZona });
  useEffect(() => {
    callbacks.current = { onSeleccionar, onCambioZona };
  });

  useEffect(() => {
    if (!CLAVE_MAPTILER || !contenedor.current) return;

    let nuevo: MapaLibre;
    try {
      nuevo = new MapaLibre({
        container: contenedor.current,
        style: `https://api.maptiler.com/maps/streets-v2/style.json?key=${encodeURIComponent(CLAVE_MAPTILER)}`,
        center: CENTRO_LA_SERENA,
        zoom: 12.5,
        // Créditos de MapTiler y OpenStreetMap siempre visibles.
        attributionControl: { compact: false },
        locale: TEXTOS_MAPA,
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

    let espera: ReturnType<typeof setTimeout> | undefined;
    const avisarZona = () => {
      clearTimeout(espera);
      espera = setTimeout(() => {
        const limites = nuevo.getBounds();
        callbacks.current.onCambioZona(
          zonaValida({
            oeste: limites.getWest(),
            sur: limites.getSouth(),
            este: limites.getEast(),
            norte: limites.getNorth(),
          }),
        );
      }, 250);
    };

    nuevo.on("load", () => {
      nuevo.addSource(FUENTE, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        cluster: true,
        clusterRadius: 45,
        clusterMaxZoom: ZOOM_MAX_GRUPOS,
      });

      nuevo.addLayer({
        id: CAPA_GRUPOS,
        type: "circle",
        source: FUENTE,
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "#1f2937",
          "circle-radius": ["step", ["get", "point_count"], 16, 10, 20, 50, 26],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
        },
      });
      nuevo.addLayer({
        id: CAPA_CONTEO,
        type: "symbol",
        source: FUENTE,
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["get", "point_count_abbreviated"],
          "text-font": ["Noto Sans Bold"],
          "text-size": 13,
          "text-allow-overlap": true,
        },
        paint: { "text-color": "#ffffff" },
      });
      nuevo.addLayer({
        id: CAPA_PUNTOS,
        type: "circle",
        source: FUENTE,
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": ["get", "color"],
          "circle-radius": 9,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
        },
      });
      nuevo.addLayer({
        id: CAPA_SELECCION,
        type: "circle",
        source: FUENTE,
        filter: ["==", ["get", "id"], ""],
        paint: {
          "circle-color": "transparent",
          "circle-radius": 14,
          "circle-stroke-color": "#111827",
          "circle-stroke-width": 3,
        },
      });

      nuevo.on("click", CAPA_GRUPOS, async (evento) => {
        const grupo = evento.features?.[0];
        const idGrupo = grupo?.properties.cluster_id;
        if (grupo?.geometry.type !== "Point" || typeof idGrupo !== "number") {
          return;
        }
        const fuente = nuevo.getSource<GeoJSONSource>(FUENTE);
        const zoom = await fuente?.getClusterExpansionZoom(idGrupo);
        nuevo.easeTo({
          center: grupo.geometry.coordinates as [number, number],
          zoom,
        });
      });

      nuevo.on("click", CAPA_PUNTOS, (evento) => {
        const id = evento.features?.[0]?.properties.id;
        if (typeof id === "string") callbacks.current.onSeleccionar(id);
      });

      for (const capa of [CAPA_GRUPOS, CAPA_PUNTOS]) {
        nuevo.on("mouseenter", capa, () => {
          nuevo.getCanvas().style.cursor = "pointer";
        });
        nuevo.on("mouseleave", capa, () => {
          nuevo.getCanvas().style.cursor = "";
        });
      }

      nuevo.on("moveend", avisarZona);
      avisarZona();
      setMapa(nuevo);
    });

    // Sin estilo (clave inválida, sin conexión) el mapa queda en blanco.
    nuevo.on("error", (evento) => {
      console.error("MapLibre", evento.error);
      if (!nuevo.isStyleLoaded()) setFalloCarga(true);
    });

    return () => {
      clearTimeout(espera);
      nuevo.remove();
      setMapa(null);
    };
  }, []);

  useEffect(() => {
    mapa
      ?.getSource<GeoJSONSource>(FUENTE)
      ?.setData(aGeoJSON(reportes, colorPorCategoria));
  }, [mapa, reportes, colorPorCategoria]);

  useEffect(() => {
    mapa?.setFilter(CAPA_SELECCION, [
      "==",
      ["get", "id"],
      seleccionadoId ?? "",
    ]);
  }, [mapa, seleccionadoId]);

  useEffect(() => {
    if (!mapa || !destino) return;
    mapa.easeTo({
      center: [destino.lng, destino.lat],
      zoom: Math.max(mapa.getZoom(), ZOOM_REPORTE),
    });
  }, [mapa, destino]);

  if (!CLAVE_MAPTILER) {
    return (
      <AvisoMapa>
        El mapa no está disponible: falta configurar la clave de MapTiler. La
        lista de reportes sigue funcionando.
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
      {falloCarga && (
        <AvisoMapa>
          No pudimos cargar el mapa. Revisa tu conexión; la lista de reportes
          sigue funcionando.
        </AvisoMapa>
      )}
    </>
  );
}

function AvisoMapa({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-zinc-100 p-6 dark:bg-zinc-900">
      <p role="status" className="max-w-sm text-center">
        {children}
      </p>
    </div>
  );
}
