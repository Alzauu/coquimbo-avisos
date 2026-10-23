"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  type Categoria,
  colorDeCategoria,
  type EstadoPublico,
  ESTADOS_PUBLICOS,
  filtroDeSeleccion,
  type ReportePublico,
  ZONA_INICIAL,
} from "@/lib/reportes/presentacion";
import { createClient } from "@/lib/supabase/client";

import { FiltrosReportes } from "./filtros-reportes";
import { ListaReportes } from "./lista-reportes";

// MapLibre necesita el navegador (WebGL): no se prerenderiza.
const MapaReportes = dynamic(() => import("./mapa-reportes"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 bg-zinc-100 dark:bg-zinc-900" />
  ),
});

// Debe coincidir con el LIMIT de reportes_en_zona.
const LIMITE_REPORTES = 500;
const SIN_REPORTES: ReportePublico[] = [];

type Consulta = {
  zona: typeof ZONA_INICIAL;
  categorias: number[] | undefined;
  estados: EstadoPublico[] | undefined;
  intento: number;
};

type Respuesta = {
  consulta: Consulta;
  reportes: ReportePublico[];
  error: boolean;
};

function alternar<T>(conjunto: ReadonlySet<T>, valor: T): ReadonlySet<T> {
  const nuevo = new Set(conjunto);
  if (!nuevo.delete(valor)) nuevo.add(valor);
  return nuevo;
}

export function ExploradorReportes({
  categorias,
}: {
  categorias: Categoria[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const idsCategorias = useMemo(
    () => categorias.map((categoria) => categoria.id),
    [categorias],
  );
  const categoriasPorId = useMemo(
    () => new Map(categorias.map((categoria) => [categoria.id, categoria])),
    [categorias],
  );
  const colorPorCategoria = useMemo(
    () =>
      new Map(
        categorias.map((categoria) => [
          categoria.id,
          colorDeCategoria(categoria.codigo),
        ]),
      ),
    [categorias],
  );

  const [zona, setZona] = useState(ZONA_INICIAL);
  const [categoriasMarcadas, setCategoriasMarcadas] = useState<
    ReadonlySet<number>
  >(() => new Set(idsCategorias));
  const [estadosMarcados, setEstadosMarcados] = useState<
    ReadonlySet<EstadoPublico>
  >(() => new Set(ESTADOS_PUBLICOS));
  const [intento, setIntento] = useState(0);
  const [respuesta, setRespuesta] = useState<Respuesta | null>(null);
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null);
  const [destino, setDestino] = useState<{ lng: number; lat: number } | null>(
    null,
  );
  const [panelAbierto, setPanelAbierto] = useState(false);

  const consulta = useMemo<Consulta>(
    () => ({
      zona,
      categorias: filtroDeSeleccion(categoriasMarcadas, idsCategorias),
      estados: filtroDeSeleccion(estadosMarcados, ESTADOS_PUBLICOS),
      intento,
    }),
    [zona, categoriasMarcadas, idsCategorias, estadosMarcados, intento],
  );
  const sinFiltros =
    consulta.categorias?.length === 0 || consulta.estados?.length === 0;

  useEffect(() => {
    if (sinFiltros) return;
    // Descarta respuestas de consultas anteriores que lleguen tarde.
    let vigente = true;
    supabase
      .rpc("reportes_en_zona", {
        ...consulta.zona,
        categorias: consulta.categorias,
        estados: consulta.estados,
      })
      .then(({ data, error }) => {
        if (!vigente) return;
        if (error) console.error("reportes_en_zona", error.code);
        setRespuesta({ consulta, reportes: data ?? [], error: !!error });
      });
    return () => {
      vigente = false;
    };
  }, [supabase, consulta, sinFiltros]);

  // Mientras carga se siguen mostrando los resultados anteriores.
  const cargando = !sinFiltros && respuesta?.consulta !== consulta;
  const fallo = !sinFiltros && !cargando && respuesta?.error === true;
  const reportes = sinFiltros
    ? SIN_REPORTES
    : (respuesta?.reportes ?? SIN_REPORTES);

  const seleccionarEnMapa = useCallback((id: string) => {
    setSeleccionadoId(id);
    setPanelAbierto(true);
  }, []);

  function seleccionarEnLista(reporte: ReportePublico) {
    if (reporte.id === seleccionadoId) {
      setSeleccionadoId(null);
      return;
    }
    setSeleccionadoId(reporte.id);
    setDestino({ lng: reporte.longitud, lat: reporte.latitud });
  }

  const filtrosActivos =
    (consulta.categorias ? 1 : 0) + (consulta.estados ? 1 : 0);

  let resumen: string;
  if (sinFiltros) resumen = "Marca al menos una categoría y un estado.";
  else if (cargando && !respuesta) resumen = "Buscando reportes…";
  else if (fallo) resumen = "No pudimos cargar los reportes.";
  else if (reportes.length === 0)
    resumen = "No hay reportes en esta zona con los filtros elegidos.";
  else if (reportes.length >= LIMITE_REPORTES)
    resumen = `Se muestran los ${LIMITE_REPORTES} más recientes. Acerca el mapa para ver otros.`;
  else
    resumen =
      reportes.length === 1
        ? "1 reporte en la zona visible."
        : `${reportes.length} reportes en la zona visible.`;

  return (
    <div className="flex min-h-0 flex-1 flex-col md:flex-row">
      <section
        aria-labelledby="titulo-reportes"
        className="order-2 flex max-h-[55dvh] min-h-0 flex-col border-t border-zinc-300 md:order-1 md:max-h-none md:w-96 md:border-t-0 md:border-r dark:border-zinc-700"
      >
        <div className="flex items-start justify-between gap-3 px-4 py-3">
          <div className="flex flex-col gap-1">
            <h2 id="titulo-reportes" className="font-bold">
              Reportes
            </h2>
            <p
              aria-live="polite"
              aria-busy={cargando}
              className="text-sm text-zinc-700 dark:text-zinc-300"
            >
              {resumen}
            </p>
            {fallo && (
              <button
                type="button"
                onClick={() => setIntento((n) => n + 1)}
                className="self-start text-sm font-medium underline"
              >
                Reintentar
              </button>
            )}
          </div>
          <button
            type="button"
            aria-expanded={panelAbierto}
            aria-controls="contenido-reportes"
            onClick={() => setPanelAbierto((abierto) => !abierto)}
            className="shrink-0 rounded-md border border-zinc-400 px-3 py-2 text-sm font-medium md:hidden dark:border-zinc-600"
          >
            {panelAbierto ? "Ocultar lista" : "Ver lista y filtros"}
          </button>
        </div>

        <div
          id="contenido-reportes"
          className={`${panelAbierto ? "flex" : "hidden"} min-h-0 flex-col gap-4 overflow-y-auto px-4 pb-4 md:flex`}
        >
          <details className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700">
            <summary className="cursor-pointer font-medium">
              Filtros
              {filtrosActivos > 0 &&
                ` (${filtrosActivos} ${filtrosActivos === 1 ? "activo" : "activos"})`}
            </summary>
            <div className="pt-3">
              <FiltrosReportes
                categorias={categorias}
                colorPorCategoria={colorPorCategoria}
                categoriasMarcadas={categoriasMarcadas}
                estadosMarcados={estadosMarcados}
                onCambiarCategoria={(id) =>
                  setCategoriasMarcadas((actual) => alternar(actual, id))
                }
                onCambiarEstado={(estado) =>
                  setEstadosMarcados((actual) => alternar(actual, estado))
                }
              />
            </div>
          </details>

          <ListaReportes
            reportes={reportes}
            categoriasPorId={categoriasPorId}
            colorPorCategoria={colorPorCategoria}
            seleccionadoId={seleccionadoId}
            onSeleccionar={seleccionarEnLista}
          />
        </div>
      </section>

      <div className="relative order-1 min-h-64 flex-1 md:order-2">
        <MapaReportes
          reportes={reportes}
          colorPorCategoria={colorPorCategoria}
          seleccionadoId={seleccionadoId}
          destino={destino}
          onSeleccionar={seleccionarEnMapa}
          onCambioZona={setZona}
        />
      </div>
    </div>
  );
}
