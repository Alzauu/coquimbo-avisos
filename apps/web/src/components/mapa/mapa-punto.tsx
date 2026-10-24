"use client";

import { Marker } from "maplibre-gl";
import { useEffect } from "react";

import { MarcoMapa, useMapa } from "@/components/mapa/mapa-base";

type Props = {
  latitud: number;
  longitud: number;
  // Nombre accesible del mapa.
  titulo: string;
};

// El mismo pin de reportar (selector-ubicacion.tsx), con los colores del
// tema y no rojo: en el mapa el rojo es de los cortes de luz. SVG fijo,
// sin datos de nadie.
function crearPin() {
  const pin = document.createElement("div");
  pin.innerHTML = `<svg width="36" height="48" viewBox="0 0 36 48" style="filter: drop-shadow(0 1px 2px rgb(0 0 0 / 0.3))">
    <path d="M18 47C18 47 34 29.5 34 18A16 16 0 0 0 2 18C2 29.5 18 47 18 47Z" fill="var(--tinta)" stroke="var(--superficie)" stroke-width="2"/>
    <circle cx="18" cy="18" r="6" fill="var(--superficie)"/>
  </svg>`;
  return pin;
}

// Mapa pequeño con un solo punto marcado. Debe ir en un contenedor con
// position: relative y alto. Quien lo use debe mostrar también la
// ubicación en texto: el mapa no es accesible para todas las personas.
export default function MapaPunto({ latitud, longitud, titulo }: Props) {
  const { contenedor, mapa, falloCarga } = useMapa({
    titulo,
    centro: [longitud, latitud],
    zoom: 16,
  });

  useEffect(() => {
    if (!mapa) return;
    const marcador = new Marker({ element: crearPin(), anchor: "bottom" })
      .setLngLat([longitud, latitud])
      .addTo(mapa);
    // El marcador es decorativo: la ubicación se da también en texto.
    marcador.getElement().setAttribute("aria-hidden", "true");
    return () => {
      marcador.remove();
    };
  }, [mapa, latitud, longitud]);

  return (
    <MarcoMapa
      contenedor={contenedor}
      falloCarga={falloCarga}
      alternativa="Usa la dirección y las coordenadas de arriba."
    />
  );
}
