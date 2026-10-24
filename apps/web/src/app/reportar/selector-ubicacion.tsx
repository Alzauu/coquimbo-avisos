"use client";

import { useEffect, useRef } from "react";

import { MarcoMapa, useMapa } from "@/components/mapa/mapa-base";
import { CENTRO_LA_SERENA } from "@/lib/reportes/presentacion";

export type Punto = { latitud: number; longitud: number };

type Props = {
  // Punto donde parte el mapa (por defecto, el centro de La Serena).
  inicial?: Punto;
  // Cada objeto nuevo mueve el mapa a ese punto (por ejemplo, "Usar mi ubicación").
  destino: (Punto & { zoom: number }) | null;
  onCambio: (punto: Punto) => void;
};

// Mapa con un pin fijo al centro: el punto del reporte es el centro del
// mapa, así que se elige moviendo el mapa con el dedo, el mouse o las
// flechas del teclado (con el mapa enfocado).
export default function SelectorUbicacion({
  inicial,
  destino,
  onCambio,
}: Props) {
  const { contenedor, mapa, falloCarga } = useMapa({
    titulo:
      "Mapa para elegir la ubicación del reporte. El punto elegido es el centro del mapa; muévelo con las flechas del teclado.",
    centro: inicial ? [inicial.longitud, inicial.latitud] : CENTRO_LA_SERENA,
    zoom: inicial ? 16 : 14,
  });

  const alCambiar = useRef(onCambio);
  useEffect(() => {
    alCambiar.current = onCambio;
  });

  useEffect(() => {
    if (!mapa) return;
    const avisar = () => {
      const centro = mapa.getCenter();
      alCambiar.current({ latitud: centro.lat, longitud: centro.lng });
    };
    mapa.on("moveend", avisar);
    avisar();
    return () => {
      mapa.off("moveend", avisar);
    };
  }, [mapa]);

  useEffect(() => {
    if (!mapa || !destino) return;
    mapa.easeTo({
      center: [destino.longitud, destino.latitud],
      zoom: destino.zoom,
    });
  }, [mapa, destino]);

  return (
    <MarcoMapa
      contenedor={contenedor}
      falloCarga={falloCarga}
      alternativa="Usa el botón «Usar mi ubicación» para fijar el punto."
    >
      <PinCentral />
    </MarcoMapa>
  );
}

// La punta del pin queda exactamente en el centro del mapa. Usa los
// colores del tema, no rojo: en el mapa el rojo es de los cortes de luz.
function PinCentral() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full"
    >
      <svg width="36" height="48" viewBox="0 0 36 48" className="drop-shadow">
        <path
          d="M18 47C18 47 34 29.5 34 18A16 16 0 0 0 2 18C2 29.5 18 47 18 47Z"
          fill="var(--tinta)"
          stroke="var(--superficie)"
          strokeWidth="2"
        />
        <circle cx="18" cy="18" r="6" fill="var(--superficie)" />
      </svg>
    </div>
  );
}
