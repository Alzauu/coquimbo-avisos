import Link from "next/link";
import type { ReactNode } from "react";

import {
  BOTON_CHICO,
  FOCO,
  TARJETA,
  TEXTO_SUAVE,
} from "@/components/ui/estilos";
import { pasosDeAvance } from "@/lib/reportes/avance";
import { type EstadoPublico, NOMBRE_ESTADO } from "@/lib/reportes/presentacion";

// Piezas del detalle de un reporte (/reporte/[id]), dirección «Ficha»: la
// ficha de categoría arriba, el estado con su línea de avance y los datos
// en tarjetas.

// Etiqueta de sección y de dato: 13 px, mayúsculas con aire y tinta suave
// (AA en los dos temas). Una voz distinta del cuerpo sin otra familia.
export const ETIQUETA =
  "text-[0.8125rem] leading-5 font-semibold tracking-[0.08em] text-(--tinta-suave) uppercase";

// Texto de cuerpo: 16 px, interlineado 1,625 y como máximo ~65 caracteres.
export const CUERPO =
  "max-w-[65ch] text-base leading-relaxed break-words whitespace-pre-line";

// Sobre este largo el título baja un paso: uno de 140 caracteres no debe
// ocupar media pantalla del teléfono.
const LARGO_TITULO_LARGO = 80;

export function claseTitulo(titulo: string): string {
  const tamano =
    Array.from(titulo).length > LARGO_TITULO_LARGO
      ? "text-2xl md:text-[1.75rem]"
      : "text-[1.75rem] md:text-[2.125rem]";
  return `${tamano} leading-[1.15] font-bold tracking-[-0.01em] break-words`;
}

// --- Íconos (decorativos: el texto de al lado dice lo mismo) ----------

function Icono({
  children,
  tamano = 16,
}: {
  children: ReactNode;
  tamano?: number;
}) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 16 16"
      width={tamano}
      height={tamano}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      {children}
    </svg>
  );
}

const IconoFlecha = () => (
  <Icono>
    <path d="M13 8H3.5M7.5 4 3.5 8l4 4" />
  </Icono>
);

const IconoUbicacion = () => (
  <Icono>
    <path d="M8 14.5s5-4.2 5-8.2a5 5 0 1 0-10 0c0 4 5 8.2 5 8.2Z" />
    <path d="M6.5 6.3a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0" />
  </Icono>
);

const IconoCheck = ({ tamano = 16 }: { tamano?: number }) => (
  <Icono tamano={tamano}>
    <path d="M3.5 8.5 6.5 11.5 12.5 4.5" strokeWidth="2.25" />
  </Icono>
);

// --- Navegación --------------------------------------------------------

export function VolverAlMapa() {
  return (
    <Link
      href="/"
      className={`inline-flex min-h-11 items-center gap-2 self-start text-sm font-semibold text-(--tinta) underline-offset-4 hover:underline ${FOCO}`}
    >
      <IconoFlecha />
      Volver al mapa
    </Link>
  );
}

// Lleva a la portada con el reporte abierto y a nivel de calle.
export function VerEnElMapa({ reporteId }: { reporteId: string }) {
  return (
    <Link
      href={`/?reporte=${reporteId}`}
      className={`${BOTON_CHICO} self-start`}
    >
      <IconoUbicacion />
      Ver en el mapa
    </Link>
  );
}

// --- Estado ------------------------------------------------------------

// Resuelto usa el color de éxito (es un estado, no decoración) y además
// lleva ✓: no depende solo del color.
export function EtiquetaEstado({ estado }: { estado: EstadoPublico }) {
  const resuelto = estado === "resuelto";
  return (
    <span
      className={`inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 text-sm font-semibold ${
        resuelto
          ? "bg-(--exito-fondo) text-(--exito-tinta)"
          : "border border-(--borde-control) bg-(--superficie) text-(--tinta)"
      }`}
    >
      {resuelto && <IconoCheck tamano={14} />}
      <span className="sr-only">Estado: </span>
      {NOMBRE_ESTADO[estado]}
    </span>
  );
}

// Los cuatro pasos con su nombre. Hecho = relleno de tinta con ✓; actual =
// anillo grueso y nombre en negrita; pendiente = anillo de borde de
// control (3:1). Sin el acento.
export function LineaAvance({ estado }: { estado: EstadoPublico }) {
  return (
    <ol className="grid grid-cols-4">
      {pasosDeAvance(estado).map((paso, indice) => {
        const alcanzado = paso.hecho || paso.actual;
        return (
          <li
            key={paso.estado}
            aria-current={paso.actual ? "step" : undefined}
            className="relative flex flex-col items-center gap-2 text-center"
          >
            {indice > 0 && (
              <span
                aria-hidden="true"
                className={`absolute top-3 right-1/2 h-0.5 w-full -translate-y-1/2 ${
                  alcanzado ? "bg-(--tinta)" : "bg-(--borde-control)"
                }`}
              />
            )}
            <span
              aria-hidden="true"
              className={`relative flex size-6 items-center justify-center rounded-full ${
                paso.hecho
                  ? "bg-(--tinta) text-(--superficie)"
                  : paso.actual
                    ? "border-[3px] border-(--tinta) bg-(--superficie)"
                    : "border-2 border-(--borde-control) bg-(--superficie)"
              }`}
            >
              {paso.hecho && <IconoCheck tamano={14} />}
            </span>
            <span
              className={`text-[0.8125rem] leading-4 ${
                paso.actual
                  ? "font-bold text-(--tinta)"
                  : alcanzado
                    ? "text-(--tinta)"
                    : TEXTO_SUAVE
              }`}
            >
              {NOMBRE_ESTADO[paso.estado]}
              <span className="sr-only">
                {paso.actual
                  ? " (actual)"
                  : paso.hecho
                    ? " (completado)"
                    : " (pendiente)"}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

// --- Datos -------------------------------------------------------------

export function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className={`flex flex-col gap-1 p-3 ${TARJETA}`}>
      <dt className={ETIQUETA}>{etiqueta}</dt>
      <dd className="font-semibold break-words">{valor}</dd>
    </div>
  );
}

// --- Fotos -------------------------------------------------------------
// Solo URLs firmadas de la app (mediana para mostrar, completa al abrir),
// con carga diferida. Cada foto abre la completa en otra pestaña: sin visor
// modal. El enlace es relative: así su texto sr-only (absolute) no se sale
// de su caja.

export type FotoDetalle = {
  id: number;
  mediana: string;
  completa: string;
};

export const textoFoto = (numero: number, total: number, titulo: string) =>
  `Foto ${numero} de ${total} del reporte «${titulo}»`;

export function EnlaceFoto({
  foto,
  alt,
  imagen,
}: {
  foto: FotoDetalle;
  alt: string;
  imagen: string;
}) {
  return (
    <a
      href={foto.completa}
      target="_blank"
      rel="noopener noreferrer"
      className={`relative block overflow-hidden rounded-(--radio-control) bg-(--superficie-2) ${FOCO}`}
    >
      {/* URL firmada de corta duración: next/image no debe optimizarla. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={foto.mediana} alt={alt} loading="lazy" className={imagen} />
      <span className="sr-only"> (abre la foto completa en otra pestaña)</span>
    </a>
  );
}

export function FotosGrilla({
  fotos,
  titulo,
}: {
  fotos: FotoDetalle[];
  titulo: string;
}) {
  return (
    <ul className="grid grid-cols-3 gap-2">
      {fotos.map((foto, indice) => (
        <li key={foto.id}>
          <EnlaceFoto
            foto={foto}
            alt={textoFoto(indice + 1, fotos.length, titulo)}
            imagen="aspect-square w-full object-cover"
          />
        </li>
      ))}
    </ul>
  );
}
