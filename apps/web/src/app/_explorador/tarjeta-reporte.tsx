import Link from "next/link";
import {
  type KeyboardEvent,
  type PointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import { FichaCategoria } from "@/components/categorias/ficha-categoria";
import { BOTON_CHICO, ENLACE, TEXTO_SUAVE } from "@/components/ui/estilos";
import {
  DURACION_URL_FOTO,
  esquemaFotosReporte,
  type FotoReporte,
} from "@/lib/fotos/respuesta";
import type { CategoriaVisual } from "@/lib/reportes/categorias";
import {
  formatearFecha,
  NOMBRE_ESTADO,
  recortarTexto,
  type ReportePublico,
} from "@/lib/reportes/presentacion";

import { moverIndice, pasoDeslizar } from "./carrusel";

export const ID_TARJETA = "tarjeta-reporte";

const LARGO_RESUMEN = 160;
// Las URLs se renuevan un minuto antes de vencer, para que «Abrir foto
// completa» siga sirviendo si la tarjeta queda abierta.
const RENOVAR_URLS_MS = (DURACION_URL_FOTO - 60) * 1000;

const PASO_POR_TECLA: Partial<Record<string, number>> = {
  ArrowLeft: -1,
  ArrowRight: 1,
};

type Carga =
  | { estado: "cargando" }
  | { estado: "lista"; fotos: FotoReporte[] }
  | { estado: "error" };

type Props = {
  reporte: ReportePublico;
  nombreCategoria: string;
  categoria: CategoriaVisual;
  onCerrar: () => void;
};

// Resumen de un reporte elegido en el mapa o en la lista. Diálogo no
// modal: el mapa y la lista siguen disponibles. En el teléfono es una hoja
// abajo (si cambias su alto máximo, ajusta ALTO_TARJETA_TELEFONO en
// mapa-reportes.tsx); desde md, arriba a la derecha (la lista va a la izquierda), con
// espacio para los botones de zoom. Se monta de nuevo para
// cada reporte (key), así que su estado parte de cero.
export function TarjetaReporte({
  reporte,
  nombreCategoria,
  categoria,
  onCerrar,
}: Props) {
  const titulo = useRef<HTMLHeadingElement>(null);
  const [descripcionCompleta, setDescripcionCompleta] = useState(false);

  useEffect(() => {
    titulo.current?.focus();
  }, []);

  const resumen = reporte.descripcion
    ? recortarTexto(reporte.descripcion, LARGO_RESUMEN)
    : null;

  function alPresionarTecla(evento: KeyboardEvent) {
    if (evento.key === "Escape") {
      evento.stopPropagation();
      onCerrar();
    }
  }

  return (
    <div
      id={ID_TARJETA}
      role="dialog"
      aria-labelledby="titulo-tarjeta"
      onKeyDown={alPresionarTecla}
      className="fixed inset-x-0 bottom-0 z-20 flex max-h-[65dvh] flex-col gap-3 overflow-y-auto overscroll-contain rounded-t-(--radio) border-t border-(--borde) bg-(--superficie) p-4 shadow-(--sombra) motion-safe:animate-aparecer md:absolute md:inset-x-auto md:top-3 md:right-14 md:bottom-auto md:max-h-[calc(100%-1.5rem)] md:w-80 md:rounded-(--radio) md:border lg:w-96"
    >
      <div className="flex items-start justify-between gap-3">
        <h2
          id="titulo-tarjeta"
          ref={titulo}
          tabIndex={-1}
          className="text-lg font-bold break-words"
        >
          {reporte.titulo}
        </h2>
        <button
          type="button"
          onClick={onCerrar}
          className={`${BOTON_CHICO} shrink-0`}
        >
          Cerrar
        </button>
      </div>

      <p className={`flex items-center gap-2 text-sm ${TEXTO_SUAVE}`}>
        <FichaCategoria categoria={categoria} tamano={24} />
        <span>
          {nombreCategoria} · Estado: {NOMBRE_ESTADO[reporte.estado]}
        </span>
      </p>

      <FotosReporte reporteId={reporte.id} tituloReporte={reporte.titulo} />

      {reporte.descripcion && (
        <div className="flex flex-col items-start gap-1">
          <p
            id="descripcion-tarjeta"
            className="break-words whitespace-pre-line"
          >
            {resumen && !descripcionCompleta ? resumen : reporte.descripcion}
          </p>
          {resumen && (
            <button
              type="button"
              aria-expanded={descripcionCompleta}
              aria-controls="descripcion-tarjeta"
              onClick={() => setDescripcionCompleta((completa) => !completa)}
              className={`${ENLACE} text-sm`}
            >
              {descripcionCompleta ? "Ver menos" : "Ver más"}
            </button>
          )}
        </div>
      )}

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        {reporte.direccion_referencia && (
          <>
            <dt className="font-semibold">Referencia</dt>
            <dd className="break-words">{reporte.direccion_referencia}</dd>
          </>
        )}
        <dt className="font-semibold">Reportado</dt>
        <dd>{formatearFecha(reporte.creado_en)}</dd>
        {reporte.resuelto_en && (
          <>
            <dt className="font-semibold">Resuelto</dt>
            <dd>{formatearFecha(reporte.resuelto_en)}</dd>
          </>
        )}
      </dl>

      <Link href={`/reporte/${reporte.id}`} className={`${ENLACE} self-start`}>
        Ver detalle
        <span className="sr-only"> de «{reporte.titulo}»</span>
      </Link>
    </div>
  );
}

// Carrusel de fotos. Las URLs se piden al abrir la tarjeta, nunca al
// cargar el mapa. Si no hay fotos no se muestra nada.
function FotosReporte({
  reporteId,
  tituloReporte,
}: {
  reporteId: string;
  tituloReporte: string;
}) {
  const [carga, setCarga] = useState<Carga>({ estado: "cargando" });
  const [intento, setIntento] = useState(0);
  const [indice, setIndice] = useState(0);
  const [fallidas, setFallidas] = useState<ReadonlySet<number>>(new Set());
  // Si una foto no carga (por ejemplo, la URL venció), se piden URLs
  // nuevas una sola vez.
  const yaRenovo = useRef(false);
  const toque = useRef<{ x: number; y: number; id: number } | null>(null);

  useEffect(() => {
    const control = new AbortController();
    fetch(`/reporte/${reporteId}/fotos`, {
      signal: control.signal,
      cache: "no-store",
    })
      .then(async (respuesta) => {
        // 404: el reporte ya no está publicado; se muestra sin fotos.
        if (respuesta.status === 404) return { fotos: [] };
        if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
        return esquemaFotosReporte.parse(await respuesta.json());
      })
      .then(({ fotos }) => setCarga({ estado: "lista", fotos }))
      .catch((error: unknown) => {
        if (control.signal.aborted) return;
        console.error("fotos del reporte", error);
        setCarga({ estado: "error" });
      });
    return () => control.abort();
  }, [reporteId, intento]);

  // Con la tarjeta abierta, renueva las URLs antes de que venzan.
  useEffect(() => {
    if (carga.estado !== "lista" || carga.fotos.length === 0) return;
    const espera = setTimeout(() => setIntento((n) => n + 1), RENOVAR_URLS_MS);
    return () => clearTimeout(espera);
  }, [carga]);

  const fotos = carga.estado === "lista" ? carga.fotos : [];
  const total = fotos.length;
  // Si al renovar llegaron menos fotos (se ocultó una), el índice se ajusta.
  const actual = moverIndice(indice, 0, total);
  const foto = fotos[actual];
  const siguiente = fotos[actual + 1]?.mediana;

  // Precarga la foto siguiente (la respuesta queda en la caché del navegador).
  useEffect(() => {
    if (!siguiente) return;
    const imagen = new Image();
    imagen.src = siguiente;
  }, [siguiente]);

  if (carga.estado === "cargando") {
    return (
      <p className={`text-sm ${TEXTO_SUAVE}`} role="status">
        Cargando fotos…
      </p>
    );
  }
  if (carga.estado === "error") {
    return (
      <p className={`text-sm ${TEXTO_SUAVE}`} role="status">
        No pudimos cargar las fotos.{" "}
        <button
          type="button"
          onClick={() => {
            setCarga({ estado: "cargando" });
            setIntento((n) => n + 1);
          }}
          className={ENLACE}
        >
          Reintentar
        </button>
      </p>
    );
  }
  if (!foto) return null;

  const ir = (paso: number) => setIndice(moverIndice(actual, paso, total));

  function alFallarFoto(id: number) {
    if (!yaRenovo.current) {
      yaRenovo.current = true;
      setIntento((n) => n + 1);
      return;
    }
    setFallidas((actuales) => new Set(actuales).add(id));
  }

  function alPresionarTecla(evento: KeyboardEvent) {
    const paso = PASO_POR_TECLA[evento.key];
    if (paso === undefined) return;
    evento.preventDefault();
    ir(paso);
  }

  // Solo gestos táctiles y solo sobre la foto: con el mouse se usan los
  // botones, y el resto de la tarjeta se desplaza con normalidad.
  function alTocar(evento: PointerEvent) {
    if (evento.pointerType === "mouse") return;
    toque.current = {
      x: evento.clientX,
      y: evento.clientY,
      id: evento.pointerId,
    };
  }
  function alSoltar(evento: PointerEvent) {
    const inicio = toque.current;
    toque.current = null;
    if (!inicio || inicio.id !== evento.pointerId) return;
    ir(pasoDeslizar(evento.clientX - inicio.x, evento.clientY - inicio.y));
  }

  const posicion = `Foto ${actual + 1} de ${total}`;

  return (
    <section
      aria-roledescription="carrusel"
      aria-label="Fotos del reporte"
      onKeyDown={alPresionarTecla}
      className="flex flex-col gap-2"
    >
      {/* touch-pan-y: el gesto horizontal lo maneja el carrusel; el
          vertical sigue desplazando la tarjeta. */}
      <div
        onPointerDown={alTocar}
        onPointerUp={alSoltar}
        onPointerCancel={() => {
          toque.current = null;
        }}
        className="aspect-[4/3] touch-pan-y overflow-hidden rounded-(--radio-control) bg-(--superficie-2) select-none"
      >
        {fallidas.has(foto.id) ? (
          <p
            className={`flex h-full items-center justify-center p-4 text-center text-sm ${TEXTO_SUAVE}`}
          >
            No pudimos cargar esta foto.
          </p>
        ) : (
          // URL firmada por la app, de corta duración: no conviene que
          // next/image la optimice ni la guarde en caché.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={foto.mediana}
            alt={`${posicion} del reporte «${tituloReporte}»`}
            draggable={false}
            onError={() => alFallarFoto(foto.id)}
            className="h-full w-full object-contain"
          />
        )}
      </div>

      {/* aria-disabled en vez de disabled: en el extremo el botón no hace
          nada, pero no le quita el foco a quien navega con teclado. */}
      <div className="flex items-center justify-between gap-2">
        {total > 1 ? (
          <button
            type="button"
            onClick={() => ir(-1)}
            aria-disabled={actual === 0}
            className={BOTON_CHICO}
          >
            Foto anterior
          </button>
        ) : (
          <span />
        )}
        <p aria-live="polite" aria-atomic="true" className="text-sm">
          {posicion}
        </p>
        {total > 1 ? (
          <button
            type="button"
            onClick={() => ir(1)}
            aria-disabled={actual === total - 1}
            className={BOTON_CHICO}
          >
            Foto siguiente
          </button>
        ) : (
          <span />
        )}
      </div>

      <a
        href={foto.completa}
        target="_blank"
        rel="noopener noreferrer"
        className={`${ENLACE} self-start text-sm`}
      >
        Abrir foto completa
        <span className="sr-only">
          {" "}
          ({posicion}, se abre en una pestaña nueva)
        </span>
      </a>
    </section>
  );
}
