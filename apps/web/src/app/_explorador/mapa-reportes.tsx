"use client";

import {
  type FilterSpecification,
  type GeoJSONSource,
  type MapLayerMouseEvent,
  Popup,
} from "maplibre-gl";
import { useEffect, useRef } from "react";

import { MarcoMapa, useMapa } from "@/components/mapa/mapa-base";
import {
  aGeoJSON,
  CENTRO_LA_SERENA,
  type ReportePublico,
  type Zona,
  zonaValida,
} from "@/lib/reportes/presentacion";
import { createClient } from "@/lib/supabase/client";

const FUENTE = "reportes";
const CAPA_GRUPOS = "reportes-grupos";
const CAPA_CONTEO = "reportes-conteo";
const CAPA_PUNTOS = "reportes-puntos";
const CAPA_SELECCION = "reportes-seleccion";

// Por sobre este zoom no se agrupa: al elegir un reporte se acerca más.
const ZOOM_MAX_GRUPOS = 15;
const ZOOM_REPORTE = 16;

// Cortes de luz de CGE (tabla cortes_luz, la llena scripts/cge_cortes.py
// cada minuto): el área afectada en rojo, como en el mapa de CGE, y un
// círculo pequeño si solo se conoce el punto. Van debajo de los reportes
// para no taparlos.
const FUENTE_CORTES = "cortes-luz";
const CAPA_CORTES_RELLENO = "cortes-luz-relleno";
const CAPA_CORTES_BORDE = "cortes-luz-borde";
const CAPA_CORTES_PUNTOS = "cortes-luz-puntos";
const COLOR_CORTE = "#dc2626";
const INTERVALO_CORTES_MS = 60_000;
const MAX_CORTES = 2000;

// "geometry-type" devuelve Polygon o MultiPolygon según la versión de
// MapLibre: se aceptan los dos.
const ES_AREA: FilterSpecification = [
  "in",
  ["geometry-type"],
  ["literal", ["Polygon", "MultiPolygon"]],
];
const ES_PUNTO: FilterSpecification = ["==", ["geometry-type"], "Point"];

type CorteLuz = {
  id: number;
  nombre: string;
  descripcion: string | null;
  latitud: number;
  longitud: number;
  // GeoJSON guardado por el script; se revisa antes de dibujarlo.
  geometria: unknown;
  creado_en: string;
};

type Posicion = [number, number];
type GeometriaCorte =
  | { type: "Point"; coordinates: Posicion }
  | { type: "Polygon"; coordinates: Posicion[][] }
  | { type: "MultiPolygon"; coordinates: Posicion[][][] };

const esPosicion = (valor: unknown): valor is Posicion =>
  Array.isArray(valor) &&
  valor.length >= 2 &&
  Number.isFinite(valor[0]) &&
  Number.isFinite(valor[1]);

// Un anillo cerrado tiene al menos 4 posiciones.
const esPoligono = (valor: unknown): valor is Posicion[][] =>
  Array.isArray(valor) &&
  valor.length > 0 &&
  valor.every(
    (anillo) =>
      Array.isArray(anillo) && anillo.length >= 4 && anillo.every(esPosicion),
  );

// La geometría solo se usa si tiene la forma esperada; si no, null (y se
// dibuja el punto de referencia).
function leerGeometria(valor: unknown): GeometriaCorte | null {
  if (typeof valor !== "object" || valor === null) return null;
  const { type, coordinates } = valor as {
    type?: unknown;
    coordinates?: unknown;
  };
  if (type === "Point" && esPosicion(coordinates)) {
    return { type, coordinates };
  }
  if (type === "Polygon" && esPoligono(coordinates)) {
    return { type, coordinates };
  }
  if (
    type === "MultiPolygon" &&
    Array.isArray(coordinates) &&
    coordinates.length > 0 &&
    coordinates.every(esPoligono)
  ) {
    return { type, coordinates };
  }
  return null;
}

const HORA = new Intl.DateTimeFormat("es-CL", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Santiago",
});

type ColeccionCortes = {
  type: "FeatureCollection";
  features: {
    type: "Feature";
    geometry: GeometriaCorte;
    properties: { nombre: string; descripcion: string; creado_en: string };
  }[];
};

function cortesAGeoJSON(cortes: readonly CorteLuz[]): ColeccionCortes {
  return {
    type: "FeatureCollection",
    features: cortes.map((corte) => ({
      type: "Feature",
      geometry: leerGeometria(corte.geometria) ?? {
        type: "Point",
        coordinates: [corte.longitud, corte.latitud],
      },
      properties: {
        nombre: corte.nombre,
        descripcion: corte.descripcion ?? "",
        creado_en: corte.creado_en,
      },
    })),
  };
}

// Contenido del popup. Los textos vienen de un tercero (CGE): se insertan
// con textContent, nunca como HTML.
function contenidoPopupCorte(propiedades: Record<string, unknown>) {
  const texto = (valor: unknown) => (typeof valor === "string" ? valor : "");
  const contenido = document.createElement("div");
  contenido.style.color = "#18181b";
  contenido.style.maxWidth = "16rem";

  const titulo = document.createElement("p");
  titulo.style.fontWeight = "700";
  titulo.style.paddingRight = "1.25rem"; // espacio para el botón Cerrar
  titulo.textContent = texto(propiedades.nombre) || "Corte de luz";
  contenido.append(titulo);

  const descripcion = texto(propiedades.descripcion);
  if (descripcion) {
    const parrafo = document.createElement("p");
    parrafo.style.whiteSpace = "pre-line";
    parrafo.style.marginTop = "0.25rem";
    parrafo.textContent = descripcion;
    contenido.append(parrafo);
  }

  const fuente = document.createElement("p");
  fuente.style.marginTop = "0.5rem";
  fuente.style.fontSize = "0.75rem";
  fuente.style.color = "#52525b";
  const creado = Date.parse(texto(propiedades.creado_en));
  fuente.textContent = Number.isNaN(creado)
    ? "Fuente: CGE"
    : `Fuente: CGE · actualizado a las ${HORA.format(creado)}`;
  contenido.append(fuente);
  return contenido;
}

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

    // Primero los cortes: las capas que se agregan después quedan encima.
    mapa.addSource(FUENTE_CORTES, {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
    mapa.addLayer({
      id: CAPA_CORTES_RELLENO,
      type: "fill",
      source: FUENTE_CORTES,
      filter: ES_AREA,
      paint: { "fill-color": COLOR_CORTE, "fill-opacity": 0.4 },
    });
    mapa.addLayer({
      id: CAPA_CORTES_BORDE,
      type: "line",
      source: FUENTE_CORTES,
      filter: ES_AREA,
      paint: { "line-color": COLOR_CORTE, "line-width": 2 },
    });
    mapa.addLayer({
      id: CAPA_CORTES_PUNTOS,
      type: "circle",
      source: FUENTE_CORTES,
      filter: ES_PUNTO,
      paint: {
        "circle-color": COLOR_CORTE,
        "circle-radius": 6,
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 2,
      },
    });

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

    // Popup del corte donde se hizo clic. Si ahí también hay un reporte o
    // un grupo, manda el reporte: un clic no hace dos cosas.
    const abrirCorte = (evento: MapLayerMouseEvent) => {
      const corte = evento.features?.[0];
      if (!corte) return;
      const reportes = mapa.queryRenderedFeatures(evento.point, {
        layers: [CAPA_GRUPOS, CAPA_PUNTOS],
      });
      if (reportes.length > 0) return;
      new Popup({ maxWidth: "18rem" })
        .setLngLat(evento.lngLat)
        .setDOMContent(contenidoPopupCorte(corte.properties))
        .addTo(mapa);
    };
    mapa.on("click", CAPA_CORTES_RELLENO, abrirCorte);
    mapa.on("click", CAPA_CORTES_PUNTOS, abrirCorte);

    // Cursor de mano sobre lo que se puede tocar. Se calcula en cada
    // movimiento porque las capas se superponen (un reporte dentro de un
    // corte).
    const INTERACTIVAS = [
      CAPA_GRUPOS,
      CAPA_PUNTOS,
      CAPA_CORTES_RELLENO,
      CAPA_CORTES_PUNTOS,
    ];
    mapa.on("mousemove", (evento) => {
      const encima = mapa.queryRenderedFeatures(evento.point, {
        layers: INTERACTIVAS,
      });
      mapa.getCanvas().style.cursor = encima.length > 0 ? "pointer" : "";
    });

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

  // Cortes de luz: se consultan al cargar el mapa y cada minuto, salvo con
  // la pestaña oculta (al volver se consulta de inmediato). Si una consulta
  // falla, quedan los últimos datos dibujados.
  useEffect(() => {
    if (!mapa) return;
    const supabase = createClient();
    let vigente = true;

    async function cargarCortes() {
      if (document.hidden) return;
      const { data, error } = await supabase
        .from("cortes_luz")
        .select(
          "id, nombre, descripcion, latitud, longitud, geometria, creado_en",
        )
        .limit(MAX_CORTES);
      if (!vigente || !mapa) return;
      if (error) {
        console.error("cortes_luz", error.code);
        return;
      }
      mapa
        .getSource<GeoJSONSource>(FUENTE_CORTES)
        ?.setData(cortesAGeoJSON(data));
    }

    const alCambiarVisibilidad = () => {
      if (!document.hidden) void cargarCortes();
    };

    void cargarCortes();
    const intervalo = setInterval(
      () => void cargarCortes(),
      INTERVALO_CORTES_MS,
    );
    document.addEventListener("visibilitychange", alCambiarVisibilidad);
    return () => {
      vigente = false;
      clearInterval(intervalo);
      document.removeEventListener("visibilitychange", alCambiarVisibilidad);
    };
  }, [mapa]);

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
