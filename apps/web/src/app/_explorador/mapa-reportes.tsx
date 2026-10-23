"use client";

import type { GeoJSONSource } from "maplibre-gl";
import { useEffect, useRef } from "react";

import { MarcoMapa, useMapa } from "@/components/mapa/mapa-base";
import {
  aGeoJSON,
  CENTRO_LA_SERENA,
  type ReportePublico,
  type Zona,
  zonaValida,
} from "@/lib/reportes/presentacion";

const FUENTE = "reportes";
const CAPA_GRUPOS = "reportes-grupos";
const CAPA_CONTEO = "reportes-conteo";
const CAPA_PUNTOS = "reportes-puntos";
const CAPA_SELECCION = "reportes-seleccion";

// Por sobre este zoom no se agrupa: al elegir un reporte se acerca más.
const ZOOM_MAX_GRUPOS = 15;
const ZOOM_REPORTE = 16;

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
  const { contenedor, mapa, falloCarga } = useMapa({
    titulo: "Mapa de reportes",
    centro: CENTRO_LA_SERENA,
    zoom: 12.5,
  });

  // Los manejadores del mapa se registran una vez; leen siempre la última
  // versión de los callbacks.
  const callbacks = useRef({ onSeleccionar, onCambioZona });
  useEffect(() => {
    callbacks.current = { onSeleccionar, onCambioZona };
  });

  useEffect(() => {
    if (!mapa) return;

    mapa.addSource(FUENTE, {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
      cluster: true,
      clusterRadius: 45,
      clusterMaxZoom: ZOOM_MAX_GRUPOS,
    });

    mapa.addLayer({
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
    mapa.addLayer({
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
    mapa.addLayer({
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
    mapa.addLayer({
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

    mapa.on("click", CAPA_GRUPOS, async (evento) => {
      const grupo = evento.features?.[0];
      const idGrupo = grupo?.properties.cluster_id;
      if (grupo?.geometry.type !== "Point" || typeof idGrupo !== "number") {
        return;
      }
      const fuente = mapa.getSource<GeoJSONSource>(FUENTE);
      const zoom = await fuente?.getClusterExpansionZoom(idGrupo);
      mapa.easeTo({
        center: grupo.geometry.coordinates as [number, number],
        zoom,
      });
    });

    mapa.on("click", CAPA_PUNTOS, (evento) => {
      const id = evento.features?.[0]?.properties.id;
      if (typeof id === "string") callbacks.current.onSeleccionar(id);
    });

    for (const capa of [CAPA_GRUPOS, CAPA_PUNTOS]) {
      mapa.on("mouseenter", capa, () => {
        mapa.getCanvas().style.cursor = "pointer";
      });
      mapa.on("mouseleave", capa, () => {
        mapa.getCanvas().style.cursor = "";
      });
    }

    let espera: ReturnType<typeof setTimeout> | undefined;
    const avisarZona = () => {
      clearTimeout(espera);
      espera = setTimeout(() => {
        const limites = mapa.getBounds();
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
    mapa.on("moveend", avisarZona);
    avisarZona();

    // El mapa se destruye junto con el componente (useMapa); aquí solo se
    // cancela el aviso pendiente.
    return () => clearTimeout(espera);
  }, [mapa]);

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

  return (
    <MarcoMapa
      contenedor={contenedor}
      falloCarga={falloCarga}
      alternativa="La lista de reportes sigue funcionando."
    />
  );
}
