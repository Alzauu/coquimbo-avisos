"use client";

import {
  type FilterSpecification,
  type GeoJSONSource,
  type MapLayerMouseEvent,
  Popup,
} from "maplibre-gl";
import { useEffect, useRef } from "react";

import { registrarFichas } from "@/components/mapa/fichas-mapa";
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

// Por sobre este zoom no se agrupa: si el reporte elegido en la lista está
// dentro de un grupo, se acerca hasta aquí.
const ZOOM_MAX_GRUPOS = 15;
const ZOOM_REPORTE = 16;

// Marca de los movimientos que hace la lista (no la persona): no cambian
// la zona consultada, así la lista no se recalcula al elegir un reporte.
const DESDE_LISTA = { desdeLista: true };

// En el teléfono la tarjeta es una hoja abajo de hasta 65dvh (ver
// tarjeta-reporte.tsx): el reporte elegido se centra en la franja de mapa
// que queda visible sobre ella.
const ALTO_TARJETA_TELEFONO = 0.65;
const CONSULTA_ESCRITORIO = "(min-width: 48rem)"; // md de Tailwind

function desplazamientoTarjeta(lienzo: HTMLCanvasElement): [number, number] {
  if (window.matchMedia(CONSULTA_ESCRITORIO).matches) return [0, 0];
  const visible = lienzo.clientHeight * (1 - ALTO_TARJETA_TELEFONO);
  return [0, visible / 2 - lienzo.clientHeight / 2];
}

// Anillo del reporte elegido (3:1 sobre el mapa claro y el oscuro).
const COLOR_SELECCION = { claro: "#111827", oscuro: "#f8fafc" };

// Cortes de luz de CGE (tabla cortes_luz, la llena scripts/cge_cortes.py
// cada minuto): el área afectada en rojo, como en el mapa de CGE, y un
// círculo pequeño si solo se conoce el punto. Van debajo de los reportes
// para no taparlos.
const FUENTE_CORTES = "cortes-luz";
const CAPA_CORTES_RELLENO = "cortes-luz-relleno";
const CAPA_CORTES_BORDE = "cortes-luz-borde";
const CAPA_CORTES_PUNTOS = "cortes-luz-puntos";
const CAPA_CORTES_CONTORNO = "cortes-luz-contorno";
// En el mapa oscuro el rojo se aclara (#dc2626 da 2,4:1 sobre su fondo) y
// el borde va sobre un contorno oscuro: así llega a 3:1 también sobre
// edificios y calles, que en ese mapa son más claros.
const COLOR_CORTE = { claro: "#dc2626", oscuro: "#f87171" };
const COLOR_CONTORNO_CORTE = "#0e1013";
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
  // Código de cada categoría (para la ficha); un código desconocido usa la
  // de Otros.
  codigoPorCategoria: ReadonlyMap<number, string>;
  seleccionadoId: string | null;
  // Cada objeto nuevo centra el mapa en ese reporte (al elegir en la lista).
  destino: { id: string; lng: number; lat: number } | null;
  onSeleccionar: (id: string) => void;
  onCambioZona: (zona: Zona) => void;
};

export default function MapaReportes({
  reportes,
  codigoPorCategoria,
  seleccionadoId,
  destino,
  onSeleccionar,
  onCambioZona,
}: Props) {
  const { contenedor, mapa, oscuro, falloCarga } = useMapa({
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
  // La zona inicial se avisa una sola vez: al cambiar de tema el mapa se
  // crea de nuevo y eso no debe recalcular la lista.
  const zonaInicialAvisada = useRef(false);

  useEffect(() => {
    if (!mapa) return;
    const tema = oscuro ? "oscuro" : "claro";

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
      paint: { "fill-color": COLOR_CORTE[tema], "fill-opacity": 0.4 },
    });
    if (oscuro) {
      mapa.addLayer({
        id: CAPA_CORTES_CONTORNO,
        type: "line",
        source: FUENTE_CORTES,
        filter: ES_AREA,
        paint: { "line-color": COLOR_CONTORNO_CORTE, "line-width": 5 },
      });
    }
    mapa.addLayer({
      id: CAPA_CORTES_BORDE,
      type: "line",
      source: FUENTE_CORTES,
      filter: ES_AREA,
      paint: { "line-color": COLOR_CORTE[tema], "line-width": 2 },
    });
    mapa.addLayer({
      id: CAPA_CORTES_PUNTOS,
      type: "circle",
      source: FUENTE_CORTES,
      filter: ES_PUNTO,
      paint: {
        "circle-color": COLOR_CORTE[tema],
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
    // Cada reporte se dibuja con la ficha de su categoría (ícono y color),
    // registrada como imagen. Se permite que se superpongan, como los
    // círculos de antes: ninguna ficha se oculta por choque con otra.
    registrarFichas(mapa);
    mapa.addLayer({
      id: CAPA_PUNTOS,
      type: "symbol",
      source: FUENTE,
      filter: ["!", ["has", "point_count"]],
      layout: {
        "icon-image": ["get", "icono"],
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
      },
    });
    mapa.addLayer({
      id: CAPA_SELECCION,
      type: "circle",
      source: FUENTE,
      filter: ["==", ["get", "id"], ""],
      paint: {
        "circle-color": "transparent",
        // Rodea la ficha de 28 px.
        "circle-radius": 18,
        "circle-stroke-color": COLOR_SELECCION[tema],
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
    mapa.on("moveend", (evento) => {
      if (!(evento as { desdeLista?: boolean }).desdeLista) avisarZona();
    });
    if (!zonaInicialAvisada.current) {
      zonaInicialAvisada.current = true;
      avisarZona();
    }

    // El mapa se destruye junto con el componente (useMapa); aquí solo se
    // cancela el aviso pendiente.
    return () => clearTimeout(espera);
  }, [mapa, oscuro]);

  useEffect(() => {
    mapa
      ?.getSource<GeoJSONSource>(FUENTE)
      ?.setData(aGeoJSON(reportes, codigoPorCategoria));
  }, [mapa, reportes, codigoPorCategoria]);

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

  // Centra el reporte elegido en la lista sin cambiar el zoom. Si al
  // terminar no se dibuja suelto (está dentro de un grupo), acerca hasta
  // que se separe.
  useEffect(() => {
    if (!mapa || !destino) return;
    const centro: [number, number] = [destino.lng, destino.lat];
    const lienzo = mapa.getCanvas();
    const offset = desplazamientoTarjeta(lienzo);
    const revisarGrupo = () => {
      // Si la persona movió el mapa mientras tanto, no se acerca.
      const punto = mapa.project(centro);
      const enElCentro =
        Math.abs(punto.x - (lienzo.clientWidth / 2 + offset[0])) < 2 &&
        Math.abs(punto.y - (lienzo.clientHeight / 2 + offset[1])) < 2;
      const suelto =
        mapa.querySourceFeatures(FUENTE, {
          filter: ["==", ["get", "id"], destino.id],
        }).length > 0;
      if (enElCentro && !suelto) {
        mapa.easeTo(
          { center: centro, zoom: ZOOM_REPORTE, offset },
          DESDE_LISTA,
        );
      }
    };
    const alTerminar = () => mapa.once("idle", revisarGrupo);

    mapa.once("moveend", alTerminar);
    mapa.easeTo({ center: centro, offset }, DESDE_LISTA);
    return () => {
      mapa.off("moveend", alTerminar);
      mapa.off("idle", revisarGrupo);
    };
  }, [mapa, destino]);

  return (
    <MarcoMapa
      contenedor={contenedor}
      falloCarga={falloCarga}
      alternativa="La lista de reportes sigue funcionando."
    />
  );
}
