"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";

import {
  BOTON_CHICO,
  BOTON_PRINCIPAL,
  ENLACE,
  FOCO,
  TEXTO_SUAVE,
} from "@/components/ui/estilos";
import { categoriaDe } from "@/lib/reportes/categorias";
import {
  type Categoria,
  type EstadoPublico,
  ESTADOS_PUBLICOS,
  filtroDeSeleccion,
  prepararCategorias,
  type ReportePublico,
  ZONA_INICIAL,
} from "@/lib/reportes/presentacion";
import { createClient } from "@/lib/supabase/client";

import { FiltrosReportes } from "./filtros-reportes";
import { ListaReportes } from "./lista-reportes";
import { ID_TARJETA, TarjetaReporte } from "./tarjeta-reporte";

// MapLibre necesita el navegador (WebGL): no se prerenderiza.
const MapaReportes = dynamic(() => import("./mapa-reportes"), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-(--superficie-2)" />,
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

// categorias: todas las de reportes, también las inactivas (ver
// prepararCategorias).
export function ExploradorReportes({
  categorias,
}: {
  categorias: Categoria[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const { porId: categoriasPorId, filtrables } = useMemo(
    () => prepararCategorias(categorias),
    [categorias],
  );
  // Con todas las filtrables marcadas no se filtra por categoría: así
  // también se ven los reportes de categorías inactivas.
  const idsCategorias = useMemo(
    () => filtrables.map((categoria) => categoria.id),
    [filtrables],
  );
  const codigoPorCategoria = useMemo(
    () =>
      new Map(
        [...categoriasPorId.values()].map((c) => [c.id, c.codigo] as const),
      ),
    [categoriasPorId],
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
  // Se guarda el reporte completo: la tarjeta sigue abierta aunque el
  // reporte salga de la zona visible al mover el mapa.
  const [seleccionado, setSeleccionado] = useState<ReportePublico | null>(null);
  const seleccionadoId = seleccionado?.id ?? null;
  // Dónde estaba el foco al abrir la tarjeta, para devolverlo al cerrarla.
  const origenFoco = useRef<HTMLElement | null>(null);
  const contenedorMapa = useRef<HTMLDivElement>(null);
  const [destino, setDestino] = useState<{
    id: string;
    lng: number;
    lat: number;
  } | null>(null);
  const [panelAbierto, setPanelAbierto] = useState(false);
  // En el teléfono la lista y la tarjeta son hojas abajo: mientras la
  // tarjeta está abierta la lista se pliega, y al cerrarla vuelve a abrirse.
  const listaPlegadaPorTarjeta = useRef(false);

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

  // Recuerda el foco previo, salvo que ya esté dentro de la tarjeta.
  function recordarFoco() {
    const activo = document.activeElement;
    if (activo instanceof HTMLElement && !activo.closest(`#${ID_TARJETA}`)) {
      origenFoco.current = activo;
    }
  }

  // Devuelve el foco a donde estaba (el reporte en la lista o el mapa).
  // Si ya no está visible, por ejemplo con la lista plegada en el
  // teléfono, lo deja en el mapa.
  function cerrarTarjeta() {
    setSeleccionado(null);
    if (listaPlegadaPorTarjeta.current) {
      listaPlegadaPorTarjeta.current = false;
      // Se abre antes de devolver el foco al reporte de la lista.
      flushSync(() => setPanelAbierto(true));
    }
    const origen = origenFoco.current;
    origenFoco.current = null;
    if (origen?.isConnected && origen.checkVisibility()) origen.focus();
    else contenedorMapa.current?.querySelector<HTMLElement>("canvas")?.focus();
  }

  const plegarListaEnTelefono = useCallback(() => {
    if (!panelAbierto || window.matchMedia("(min-width: 48rem)").matches) {
      return;
    }
    listaPlegadaPorTarjeta.current = true;
    setPanelAbierto(false);
  }, [panelAbierto]);

  const seleccionarEnMapa = useCallback(
    (id: string) => {
      const reporte = reportes.find((r) => r.id === id);
      if (!reporte) return;
      recordarFoco();
      setSeleccionado(reporte);
      plegarListaEnTelefono();
    },
    [reportes, plegarListaEnTelefono],
  );

  function seleccionarEnLista(reporte: ReportePublico) {
    if (reporte.id === seleccionadoId) {
      cerrarTarjeta();
      return;
    }
    recordarFoco();
    setSeleccionado(reporte);
    plegarListaEnTelefono();
    setDestino({
      id: reporte.id,
      lng: reporte.longitud,
      lat: reporte.latitud,
    });
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
    // Mapa a pantalla completa; la lista y la tarjeta flotan encima. En el
    // teléfono la lista es una hoja abajo (plegada al empezar); desde md,
    // un panel a la izquierda, bajo el encabezado de la portada.
    <div className="relative min-h-0 flex-1">
      <section
        aria-labelledby="titulo-reportes"
        // bottom-9: deja visibles los créditos del mapa (abajo a la derecha).
        className="absolute inset-x-3 bottom-9 z-10 flex max-h-[60dvh] min-h-0 flex-col rounded-(--radio) border border-(--borde) bg-(--vidrio) shadow-(--sombra) backdrop-blur md:inset-x-auto md:top-19 md:bottom-3 md:left-3 md:max-h-none md:w-80 lg:w-96"
      >
        <div className="flex flex-col gap-2 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-0.5">
              <h2 id="titulo-reportes" className="font-bold">
                Reportes
              </h2>
              <p
                aria-live="polite"
                aria-busy={cargando}
                className={`text-sm ${TEXTO_SUAVE}`}
              >
                {resumen}
              </p>
              {fallo && (
                <button
                  type="button"
                  onClick={() => setIntento((n) => n + 1)}
                  className={`${ENLACE} self-start text-sm`}
                >
                  Reintentar
                </button>
              )}
            </div>
            {/* Sin sesión, el proxy lleva a ingresar y luego de vuelta. */}
            <Link
              href="/reportar"
              className={`${BOTON_PRINCIPAL} min-h-11 shrink-0 rounded-full px-4`}
            >
              <span aria-hidden="true">+</span> Reportar
            </Link>
          </div>
          <button
            type="button"
            aria-expanded={panelAbierto}
            aria-controls="contenido-reportes"
            onClick={() => {
              listaPlegadaPorTarjeta.current = false;
              setPanelAbierto((abierto) => !abierto);
            }}
            className={`${BOTON_CHICO} self-start md:hidden`}
          >
            {panelAbierto ? "Ocultar lista" : "Ver lista y filtros"}
          </button>
        </div>

        <div
          id="contenido-reportes"
          className={`${panelAbierto ? "flex" : "hidden"} min-h-0 flex-col gap-3 overflow-y-auto px-3 pb-3 md:flex`}
        >
          <details className="rounded-(--radio-control) border border-(--borde) bg-(--superficie)">
            <summary
              className={`flex min-h-11 cursor-pointer items-center rounded-(--radio-control) px-3 font-semibold ${FOCO}`}
            >
              Filtros
              {filtrosActivos > 0 &&
                ` (${filtrosActivos} ${filtrosActivos === 1 ? "activo" : "activos"})`}
            </summary>
            <div className="px-3 pb-3">
              <FiltrosReportes
                categorias={filtrables}
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
            seleccionadoId={seleccionadoId}
            onSeleccionar={seleccionarEnLista}
          />
        </div>
      </section>

      <div ref={contenedorMapa} className="absolute inset-0">
        <MapaReportes
          reportes={reportes}
          codigoPorCategoria={codigoPorCategoria}
          seleccionadoId={seleccionadoId}
          destino={destino}
          onSeleccionar={seleccionarEnMapa}
          onCambioZona={setZona}
        />
        {seleccionado && (
          <TarjetaReporte
            key={seleccionado.id}
            reporte={seleccionado}
            nombreCategoria={
              categoriasPorId.get(seleccionado.categoria_id)?.nombre ??
              "Sin categoría"
            }
            categoria={categoriaDe(
              categoriasPorId.get(seleccionado.categoria_id)?.codigo,
            )}
            onCerrar={cerrarTarjeta}
          />
        )}
      </div>
    </div>
  );
}
